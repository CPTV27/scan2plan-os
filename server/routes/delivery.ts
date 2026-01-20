import { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { validateBody } from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import {
  generateSignedUploadUrl,
  generateSignedReadUrl,
  listProjectFiles,
  generatePotreeViewerUrl,
} from "../lib/gcs";

function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [delivery] ${message}`);
}

const signUploadSchema = z.object({
  projectId: z.number(),
  fileName: z.string().min(1).max(255),
  contentType: z.string().optional(),
});

const signReadSchema = z.object({
  filePath: z.string().min(1),
});

const potreeConfigSchema = z.object({
  projectId: z.number(),
  potreePath: z.string().min(1),
});

export function registerDeliveryRoutes(app: Express) {
  app.post("/api/delivery/sign-upload", isAuthenticated, requireRole("ceo", "production"), validateBody(signUploadSchema), asyncHandler(async (req, res) => {
    const { projectId, fileName, contentType } = req.body;

    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const upid = project.universalProjectId || `project-${projectId}`;
    const filePath = `${upid}/deliverables/${fileName}`;

    const url = await generateSignedUploadUrl(filePath, contentType || "application/octet-stream");
    if (!url) {
      return res.status(500).json({ error: "Failed to generate upload URL. Check GCS configuration." });
    }

    log(`Generated upload URL for project ${projectId}: ${fileName}`);
    res.json({ url, filePath });
  }));

  app.post("/api/delivery/sign-read", isAuthenticated, requireRole("ceo", "production"), validateBody(signReadSchema), asyncHandler(async (req, res) => {
    const { filePath } = req.body;

    const url = await generateSignedReadUrl(filePath);
    if (!url) {
      return res.status(500).json({ error: "Failed to generate download URL" });
    }

    log(`Generated read URL for ${filePath}`);
    res.json({ url });
  }));

  app.get("/api/delivery/files/:projectId", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const upid = project.universalProjectId || `project-${projectId}`;
    const files = await listProjectFiles(`${upid}/deliverables/`);

    res.json({ 
      projectId, 
      upid,
      files,
      potreePath: project.potreePath,
      viewerUrl: project.viewerUrl,
      deliveryStatus: project.deliveryStatus,
    });
  }));

  app.post("/api/delivery/potree/config", isAuthenticated, requireRole("ceo", "production"), validateBody(potreeConfigSchema), asyncHandler(async (req, res) => {
    const { projectId, potreePath } = req.body;

    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const viewerUrl = await generatePotreeViewerUrl(potreePath);

    await storage.updateProject(projectId, {
      potreePath,
      viewerUrl: viewerUrl || undefined,
      deliveryStatus: viewerUrl ? "ready" : "pending",
    });

    log(`Updated Potree config for project ${projectId}: ${potreePath}`);
    res.json({ 
      success: true, 
      potreePath,
      viewerUrl,
      deliveryStatus: viewerUrl ? "ready" : "pending",
    });
  }));

  app.post("/api/delivery/status/:projectId", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    const { status } = req.body;

    if (!["pending", "processing", "ready", "failed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await storage.updateProject(projectId, { deliveryStatus: status });
    
    log(`Updated delivery status for project ${projectId}: ${status}`);
    res.json({ success: true, status });
  }));

  app.get("/api/delivery/potree/proxy/:projectId/*", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const project = await storage.getProject(projectId);
    if (!project || !project.potreePath) {
      return res.status(404).json({ error: "Potree data not configured for this project" });
    }

    const filePath = req.params[0];
    if (!filePath) {
      return res.status(400).json({ error: "File path required" });
    }

    const gcsPath = `${project.potreePath}/${filePath}`;

    try {
      const { streamGcsFile } = await import("../lib/gcs.js");
      const stream = await streamGcsFile(gcsPath);
      
      if (!stream) {
        return res.status(404).json({ error: "File not found" });
      }

      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        'json': 'application/json',
        'bin': 'application/octet-stream',
        'las': 'application/octet-stream',
        'laz': 'application/octet-stream',
      };
      res.setHeader('Content-Type', contentTypes[ext || ''] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      stream.pipe(res);
    } catch (err) {
      log(`ERROR: Potree proxy stream error - ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream file" });
      }
    }
  }));
}
