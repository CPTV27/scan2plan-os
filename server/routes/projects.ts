import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { calculateTravelDistance, validateShiftGate, createScanCalendarEvent, getTechnicianAvailability } from "../travel-scheduling";
import { log } from "../lib/logger";
import { generateMissionBrief } from "../missionBrief";
import { generateMissionBriefPdf } from "../missionBriefPdf";
import { uploadFileToDrive, isGoogleDriveConnected } from "../googleDrive";
import { uploadLimiter } from "../middleware/rateLimiter";
import { logSecurityEvent } from "../middleware/securityLogger";
import multer from "multer";
import fs from "fs";
import { z } from "zod";
import { projectService } from "../services/projectService";

const MAX_FIELD_UPLOAD_SIZE = 100 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 20;

const fieldUpload = multer({ 
  dest: "/tmp/field-uploads/",
  limits: { 
    fileSize: MAX_FIELD_UPLOAD_SIZE,
    files: MAX_FILES_PER_REQUEST,
  }
});

const validateFieldUploadSize = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const maxTotalSize = MAX_FIELD_UPLOAD_SIZE * MAX_FILES_PER_REQUEST;
  
  if (contentLength > maxTotalSize) {
    logSecurityEvent({
      type: "suspicious_activity",
      subtype: "oversized_upload",
      ip: req.ip || req.socket.remoteAddress || "unknown",
      path: req.path,
      method: req.method,
      message: `Content-Length ${contentLength} exceeds limit ${maxTotalSize}`,
    });
    return res.status(413).json({ message: "Request payload too large" });
  }
  next();
};

export function registerProjectRoutes(app: Express): void {
  app.get("/api/projects", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  }));

  app.get("/api/projects/:id", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  }));

  app.post("/api/projects", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const project = await storage.createProject(req.body);
      res.status(201).json(project);
    } catch (err) {
      return res.status(400).json({ message: "Failed to create project" });
    }
  }));

  // Handle both PUT and PATCH for project updates (client uses PUT, PATCH is also valid)
  const updateProjectHandler = asyncHandler(async (req: any, res: any) => {
    const projectId = Number(req.params.id);
    const input = req.body;
    
    const existingProject = await storage.getProject(projectId);
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const actualSqft = input.actualSqft ?? existingProject.actualSqft;
    const estimatedSqft = input.estimatedSqft ?? existingProject.estimatedSqft;
    
    const { variance, auditComplete } = projectService.calculateSqftVariance(actualSqft, estimatedSqft);
    if (variance !== null) {
      (input as any).sqftVariance = variance;
      (input as any).sqftAuditComplete = auditComplete;
    }

    const project = await storage.updateProject(projectId, input);
    
    if (input.actualSqft !== undefined || input.estimatedSqft !== undefined || input.leadId !== undefined) {
      try {
        const { updateProjectMargin } = await import("../services/marginCalculator");
        await updateProjectMargin(projectId);
      } catch (err) {
        log("ERROR: Failed to update project margin - " + (err as any)?.message);
      }
    }
    
    const responseProject = { ...project };
    const sqftAuditAlert = projectService.buildSqftAuditAlert(project.sqftVariance, estimatedSqft, actualSqft);
    if (sqftAuditAlert) {
      (responseProject as any).sqftAuditAlert = sqftAuditAlert;
    }
    
    res.json(responseProject);
  });

  app.put("/api/projects/:id", isAuthenticated, requireRole("ceo", "production"), updateProjectHandler);
  app.patch("/api/projects/:id", isAuthenticated, requireRole("ceo", "production"), updateProjectHandler);

  // Sync scope data from linked lead to project
  app.post("/api/projects/:id/sync-scope", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    if (!project.leadId) {
      return res.status(400).json({ message: "Project has no linked deal to sync from" });
    }
    
    const lead = await storage.getLead(project.leadId);
    if (!lead) {
      return res.status(404).json({ message: "Linked deal not found" });
    }
    
    const updateData = await projectService.buildSyncScopeData(lead);
    const updatedProject = await storage.updateProject(projectId, updateData);
    
    log(`[Sync Scope] Synced scope from lead ${lead.id} to project ${projectId}`);
    
    res.json(updatedProject);
  }));

  app.post("/api/projects/:id/recalculate-margin", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { updateProjectMargin } = await import("../services/marginCalculator");
      const result = await updateProjectMargin(projectId);
      if (!result) {
        return res.status(400).json({ message: "Could not calculate margin - missing sqft or revenue data" });
      }
      res.json(result);
    } catch (error) {
      log("ERROR: Margin calculation error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to calculate margin" });
    }
  }));

  app.post("/api/projects/recalculate-all-margins", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const { recalculateAllProjectMargins } = await import("../services/marginCalculator");
      const count = await recalculateAllProjectMargins();
      res.json({ message: `Recalculated margins for ${count} projects`, count });
    } catch (error) {
      log("ERROR: Batch margin calculation error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to recalculate margins" });
    }
  }));

  app.get("/api/projects/:id/financials", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { calculateProjectProfitability } = await import("../services/financial");
      const profitability = await calculateProjectProfitability(projectId);
      res.json(profitability);
    } catch (error) {
      log("ERROR: Project financials error - " + (error as any)?.message);
      res.status(400).json({ message: (error as any)?.message || "Failed to calculate profitability" });
    }
  }));

  app.get("/api/scantechs", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const scantechs = await storage.getScantechs();
    res.json(scantechs);
  }));

  app.get("/api/scantechs/:id", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const scantech = await storage.getScantech(Number(req.params.id));
    if (!scantech) return res.status(404).json({ message: "ScanTech not found" });
    res.json(scantech);
  }));

  app.post("/api/scantechs", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const scantech = await storage.createScantech(req.body);
      res.status(201).json(scantech);
    } catch (err) {
      return res.status(400).json({ message: "Failed to create ScanTech" });
    }
  }));

  app.patch("/api/scantechs/:id", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const scantech = await storage.updateScantech(Number(req.params.id), req.body);
      res.json(scantech);
    } catch (err) {
      return res.status(400).json({ message: "Failed to update ScanTech" });
    }
  }));

  app.post("/api/travel/calculate", isAuthenticated, requireRole("ceo", "production", "sales"), asyncHandler(async (req, res) => {
    try {
      const { destination, origin } = req.body;
      
      log("[Travel Calculate] Request: " + JSON.stringify({ destination, origin }));
      
      if (!destination) {
        return res.status(400).json({ message: "Destination address is required" });
      }

      const result = await calculateTravelDistance(destination, origin);
      
      log("[Travel Calculate] Result: " + JSON.stringify(result));
      
      if (!result) {
        return res.status(400).json({ message: "Could not calculate travel distance. Check the address." });
      }

      const shiftValidation = validateShiftGate(result.durationMinutes);

      res.json({
        ...result,
        shiftGate: shiftValidation,
      });
    } catch (error) {
      log("ERROR: Travel calculation error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to calculate travel" });
    }
  }));

  app.post("/api/travel/validate-shift", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
      const { travelTimeMinutes, scanDurationHours } = req.body;
      
      if (typeof travelTimeMinutes !== "number") {
        return res.status(400).json({ message: "Travel time in minutes is required" });
      }

      const validation = validateShiftGate(travelTimeMinutes, scanDurationHours);
      res.json(validation);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate shift" });
    }
  }));

  app.get("/api/calendar/availability/:date", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
      const date = new Date(req.params.date);
      const technicianEmail = req.query.technicianEmail as string | undefined;
      
      const availability = await getTechnicianAvailability(date, technicianEmail);
      res.json(availability);
    } catch (error) {
      log("ERROR: Calendar availability error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to fetch calendar availability" });
    }
  }));

  app.post("/api/scheduling/create-scan-event", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
      const { projectId, scanDate, startTime, endTime, technicianEmail, notes } = req.body;
      
      if (!projectId || !scanDate || !startTime || !endTime) {
        return res.status(400).json({ message: "Project ID, date, start time, and end time are required" });
      }

      const project = await storage.getProject(Number(projectId));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      let travelInfo = null;
      let lead = null;
      
      if (project.leadId) {
        lead = await storage.getLead(project.leadId);
        if (lead?.projectAddress) {
          travelInfo = await calculateTravelDistance(lead.projectAddress);
        }
      }

      if (travelInfo) {
        const shiftCheck = validateShiftGate(travelInfo.durationMinutes);
        if (!shiftCheck.valid) {
          return res.status(400).json({ 
            message: "Shift gate violation", 
            details: shiftCheck.message,
            travelInfo,
          });
        }
      }

      const appBaseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : "https://scan2plan-os.replit.app";
      
      const missionBriefUrl = `${appBaseUrl}/projects/${project.id}/mission-brief`;
      const driveFolderUrl = project.driveFolderId 
        ? `https://drive.google.com/drive/folders/${project.driveFolderId}`
        : (lead?.driveFolderId 
            ? `https://drive.google.com/drive/folders/${lead.driveFolderId}`
            : undefined);

      const scanDateObj = new Date(scanDate);
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      
      const startDateTime = new Date(scanDateObj);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      const endDateTime = new Date(scanDateObj);
      endDateTime.setHours(endHour, endMin, 0, 0);
      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const eventResult = await createScanCalendarEvent({
        projectId: project.id,
        projectName: project.name,
        projectAddress: lead?.projectAddress || "Address not available",
        universalProjectId: project.universalProjectId || undefined,
        startDateTime,
        endDateTime,
        technicianEmail,
        travelInfo: travelInfo || undefined,
        notes,
        driveFolderUrl,
        missionBriefUrl,
      });

      if (!eventResult) {
        return res.status(500).json({ message: "Failed to create calendar event" });
      }

      const projectUpdate: Record<string, any> = {
        scanDate: new Date(scanDate),
        calendarEventId: eventResult.eventId,
      };

      if (travelInfo) {
        projectUpdate.travelDistanceMiles = travelInfo.distanceMiles.toString();
        projectUpdate.travelDurationMinutes = travelInfo.durationMinutes;
        projectUpdate.travelScenario = travelInfo.scenario.type;
      }

      await storage.updateProject(project.id, projectUpdate);

      res.json({
        success: true,
        eventId: eventResult.eventId,
        calendarLink: eventResult.htmlLink,
        travelInfo,
      });
    } catch (error) {
      log("ERROR: Create scan event error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to schedule scan" });
    }
  }));

  app.post("/api/site-audit/:projectId", isAuthenticated, requireRole("ceo", "production", "sales"), asyncHandler(async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const lead = project.leadId ? await storage.getLead(project.leadId) : null;
      const address = lead?.projectAddress || project.name;

      if (!address || address.length < 5) {
        return res.status(400).json({ message: "Project address is required for site audit" });
      }

      const { performSiteRealityAudit } = await import("../site-reality-audit");
      
      const auditResult = await performSiteRealityAudit({
        projectAddress: address,
        clientName: lead?.clientName || project.name,
        buildingType: lead?.buildingType || undefined,
        scopeOfWork: lead?.scope || undefined,
        sqft: lead?.sqft || undefined,
        disciplines: lead?.disciplines || undefined,
        notes: lead?.notes || undefined,
      });

      res.json(auditResult);
    } catch (error) {
      log("ERROR: Site reality audit error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to perform site audit" });
    }
  }));

  app.post("/api/site-audit/lead/:leadId", isAuthenticated, requireRole("ceo", "production", "sales"), asyncHandler(async (req, res) => {
    try {
      const leadId = Number(req.params.leadId);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      if (!lead.projectAddress || lead.projectAddress.length < 5) {
        return res.status(400).json({ message: "Project address is required for site audit" });
      }

      const { performSiteRealityAudit } = await import("../site-reality-audit");
      
      const auditResult = await performSiteRealityAudit({
        projectAddress: lead.projectAddress,
        clientName: lead.clientName,
        buildingType: lead.buildingType || undefined,
        scopeOfWork: lead.scope || undefined,
        sqft: lead.sqft || undefined,
        disciplines: lead.disciplines || undefined,
        notes: lead.notes || undefined,
      });

      res.json(auditResult);
    } catch (error) {
      log("ERROR: Site reality audit error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to perform site audit" });
    }
  }));

  app.get("/api/projects/:id/mission-brief", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    const project = await storage.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const brief = generateMissionBrief(project);
    res.json(brief);
  }));

  app.get("/api/projects/:id/mission-brief/pdf", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    const project = await storage.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const brief = generateMissionBrief(project);
    const pdfBuffer = await generateMissionBriefPdf(brief);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Mission-Brief-${project.universalProjectId || project.id}.pdf"`);
    res.send(pdfBuffer);
  }));

  const scheduleSchema = z.object({
    scheduledStart: z.string().datetime(),
    duration: z.coerce.number().min(1).max(12),
  });

  app.post("/api/projects/:id/schedule", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const parseResult = scheduleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: "Invalid request", errors: parseResult.error.flatten() });
    }

    const { scheduledStart, duration } = parseResult.data;
    const startDate = new Date(scheduledStart);
    const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!project.assignedTechId) {
      return res.status(400).json({ message: "No technician assigned to this project" });
    }

    const technician = await storage.getScantech(project.assignedTechId);
    if (!technician) {
      return res.status(400).json({ message: "Assigned technician not found" });
    }

    const lead = project.leadId ? await storage.getLead(project.leadId) : null;
    
    if (!lead?.projectAddress) {
      return res.status(400).json({ 
        message: "Project address is required for scheduling. Please add an address to the lead first." 
      });
    }
    
    const projectAddress = lead.projectAddress;
    
    const appBaseUrl = process.env.REPLIT_DEPLOYMENT_URL 
      ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "https://localhost:5000";

    const missionBriefUrl = `${appBaseUrl}/projects/${projectId}/mission-brief`;
    const driveFolderUrl = project.driveFolderId 
      ? `https://drive.google.com/drive/folders/${project.driveFolderId}` 
      : undefined;

    const result = await createScanCalendarEvent({
      projectId: projectId,
      projectName: project.name,
      projectAddress,
      startDateTime: startDate,
      endDateTime: endDate,
      universalProjectId: project.universalProjectId || undefined,
      technicianEmail: technician.email || undefined,
      missionBriefUrl,
      driveFolderUrl,
    });

    if (!result) {
      return res.status(500).json({ message: "Failed to create calendar event. Please check Google Calendar connection." });
    }

    await storage.updateProject(projectId, {
      scanDate: startDate,
      calendarEventId: result.eventId,
    });

    log(`Scheduled scan for project ${projectId} on ${startDate.toISOString()}, event ID: ${result.eventId}`);

    res.json({
      message: "Scan scheduled successfully",
      eventId: result.eventId,
      eventLink: result.htmlLink,
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
    });
  }));

  let cashflowCache: { data: any; timestamp: number } | null = null;
  const CASHFLOW_CACHE_TTL = 5 * 60 * 1000;
  
  app.get("/api/predictive-cashflow", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      if (cashflowCache && Date.now() - cashflowCache.timestamp < CASHFLOW_CACHE_TTL) {
        return res.json(cashflowCache.data);
      }
      
      const { getPredictiveCashflow } = await import("../predictive-cashflow");
      const result = await getPredictiveCashflow();
      
      cashflowCache = { data: result, timestamp: Date.now() };
      
      res.json(result);
    } catch (error) {
      log("ERROR: Predictive cashflow error - " + (error as any)?.message);
      res.status(500).json({ message: "Failed to generate cashflow forecast" });
    }
  }));

  app.post("/api/projects/:id/data-handover", 
    isAuthenticated, 
    requireRole("ceo", "production"), 
    uploadLimiter,
    validateFieldUploadSize,
    fieldUpload.array("files", MAX_FILES_PER_REQUEST), 
    asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];
    
    const cleanupFiles = () => {
      if (!files) return;
      for (const file of files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {}
      }
    };

    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        cleanupFiles();
        return res.status(404).json({ message: "Project not found" });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      const driveConnected = await isGoogleDriveConnected();
      if (!driveConnected) {
        cleanupFiles();
        return res.status(503).json({ message: "Google Drive not connected. Please connect Google Drive to upload files." });
      }

      const subfolders = project.driveSubfolders as { fieldCapture?: string } | null;
      let targetFolderId = subfolders?.fieldCapture;

      if (!targetFolderId) {
        if (!project.driveFolderId) {
          cleanupFiles();
          return res.status(400).json({ message: "Project does not have a Google Drive folder. Please create one first." });
        }
        targetFolderId = project.driveFolderId;
      }

      let areaDescriptions: string[] = [];
      if (req.body.areaDescriptions) {
        try {
          const parsed = JSON.parse(req.body.areaDescriptions);
          areaDescriptions = Array.isArray(parsed) ? parsed : [];
        } catch {
          log("WARN: Invalid areaDescriptions JSON, using defaults");
        }
      }

      const uploadResults: { fileName: string; fileId: string; webViewLink: string }[] = [];
      const errors: { fileName: string; error: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const areaDesc = (areaDescriptions[i] || "Site_Capture").replace(/[^a-zA-Z0-9_-]/g, "_");
        
        try {
          if (!fs.existsSync(file.path)) {
            errors.push({ fileName: file.originalname, error: "Temp file not found" });
            continue;
          }
          
          const fileBuffer = fs.readFileSync(file.path);
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const sanitizedName = `${areaDesc}_${timestamp}_${sanitizedOriginal}`;
          
          const result = await uploadFileToDrive(
            targetFolderId,
            sanitizedName,
            file.mimetype,
            fileBuffer
          );
          
          uploadResults.push({
            fileName: sanitizedName,
            fileId: result.fileId,
            webViewLink: result.webViewLink,
          });
          
          try { fs.unlinkSync(file.path); } catch {}
        } catch (error: any) {
          log(`ERROR: Failed to upload file ${file.originalname} - ${error.message}`);
          errors.push({ fileName: file.originalname, error: "Upload failed" });
          try { fs.unlinkSync(file.path); } catch {}
        }
      }

      const shouldAdvanceStatus = project.status === "Scanning" && uploadResults.length > 0;
      if (shouldAdvanceStatus) {
        await storage.updateProject(projectId, { status: "Registration" });
      }

      log(`Data handover for project ${projectId}: ${uploadResults.length} files uploaded, ${errors.length} errors`);

      res.json({
        success: true,
        uploadedCount: uploadResults.length,
        errorCount: errors.length,
        uploads: uploadResults,
        errors,
        statusAdvanced: shouldAdvanceStatus,
      });
    } catch (error: any) {
      cleanupFiles();
      log(`ERROR: Data handover failed for project ${projectId} - ${error.message}`);
      res.status(500).json({ message: "Failed to process data handover" });
    }
  }));
}
