import { Router } from "express";
import { storage } from "../../storage";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validation";
import { generateClientCode, generateUniversalProjectId, generateUPID } from "@shared/utils/projectId";
import { isGoogleDriveConnected, createProjectFolder, uploadFileToDrive } from "../../googleDrive";
import { leadService } from "../../services/leadService";
import { log } from "../../lib/logger";
import { z } from "zod";
import fs from "fs";
import path from "path";

export const leadsOperationsRouter = Router();

const DEAL_STAGES = ["Leads", "Contacted", "Proposal", "Negotiation", "On Hold", "Closed Won", "Closed Lost"] as const;

const bulkUpdateStageSchema = z.object({
    leadIds: z.array(z.number().int().positive()).min(1).max(100),
    dealStage: z.enum(DEAL_STAGES),
});

const stageUpdateSchema = z.object({
    dealStage: z.enum(DEAL_STAGES),
});

// POST /api/leads/bulk-update-stage
leadsOperationsRouter.post(
    "/api/leads/bulk-update-stage",
    isAuthenticated,
    requireRole("ceo", "sales"),
    validateBody(bulkUpdateStageSchema),
    asyncHandler(async (req, res) => {
        const { leadIds, dealStage } = req.body;

        // Map stage to probability
        const stageProbability: Record<string, number> = {
            "Leads": 10,
            "Contacted": 20,
            "Proposal": 50,
            "Negotiation": 75,
            "On Hold": 50,
            "Closed Won": 100,
            "Closed Lost": 0,
        };

        let updated = 0;
        const errors: string[] = [];

        for (const id of leadIds) {
            try {
                await storage.updateLead(Number(id), {
                    dealStage,
                    probability: stageProbability[dealStage] || 50
                });
                updated++;
            } catch (err: any) {
                errors.push(`Lead ${id}: ${err.message}`);
            }
        }

        res.json({
            success: true,
            updated,
            errors: errors.length > 0 ? errors : undefined,
            message: `Updated ${updated} leads to ${dealStage}${errors.length > 0 ? `, ${errors.length} errors` : ''}`
        });
    })
);

// PATCH /api/leads/:id/stage - Complex stage update with project/drive creation
leadsOperationsRouter.patch(
    "/api/leads/:id/stage",
    isAuthenticated,
    requireRole("ceo", "sales"),
    validateBody(stageUpdateSchema),
    asyncHandler(async (req, res) => {
        try {
            const leadId = Number(req.params.id);
            const { dealStage } = req.body;

            const previousLead = await storage.getLead(leadId);
            if (!previousLead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            const isClosingWon = dealStage === "Closed Won" && previousLead.dealStage !== "Closed Won";
            const isEnteringProposal = dealStage === "Proposal" && previousLead.dealStage !== "Proposal";

            const updateData: Record<string, any> = { dealStage };

            // Auto-generate Project Code on Proposal
            if (isEnteringProposal && !previousLead.projectCode) {
                const allLeads = await storage.getLeads();
                const currentYear = new Date().getFullYear();
                const yearLeads = allLeads.filter(l => l.createdAt && new Date(l.createdAt).getFullYear() === currentYear);
                const sequenceNumber = yearLeads.length + 1;

                const clientCode = generateClientCode(previousLead.clientName);
                const projectCode = generateUniversalProjectId({
                    clientCode,
                    projectNumber: sequenceNumber,
                    creationDate: new Date(),
                });
                updateData.projectCode = projectCode;
                log(`Auto-generated Project Code for lead ${leadId}: ${projectCode}`);
            }

            const lead = await storage.updateLead(leadId, updateData);

            // On Closed Won: Create Project, Drive Folder, and migrate docs
            if (isClosingWon) {
                const existingProject = await storage.getProjectByLeadId(leadId);
                if (!existingProject) {
                    let universalProjectId = lead.projectCode;

                    if (!universalProjectId) {
                        universalProjectId = generateUPID({
                            clientName: lead.clientName,
                            projectName: lead.projectName || lead.projectAddress || 'Project',
                            closedWonDate: new Date(),
                            leadSource: lead.leadSource,
                        });
                        log(`Generated UPID for lead ${leadId} (source: ${lead.leadSource || 'unknown'}): ${universalProjectId}`);
                        await storage.updateLead(leadId, { projectCode: universalProjectId } as any);
                    }

                    let driveFolderId: string | undefined;
                    let driveFolderUrl: string | undefined;
                    let driveSubfolders: any = undefined;
                    let driveFolderStatus = "pending";

                    try {
                        const driveConnected = await isGoogleDriveConnected();
                        if (driveConnected) {
                            const folderResult = await createProjectFolder(universalProjectId);
                            driveFolderId = folderResult.folderId;
                            driveFolderUrl = folderResult.folderUrl;
                            driveSubfolders = folderResult.subfolders;
                            driveFolderStatus = "success";
                            log(`Created Google Drive folder for project ${universalProjectId}: ${driveFolderUrl}`);
                        }
                    } catch (err) {
                        driveFolderStatus = "failed";
                        log("WARN: Google Drive folder creation failed: " + (err as any)?.message);
                    }

                    const scopeSummaryStage = leadService.generateScopeSummary(lead);

                    await storage.createProject({
                        name: `${lead.clientName} - ${lead.projectAddress || 'Project'}`,
                        leadId: leadId,
                        universalProjectId,
                        status: "Scheduling",
                        priority: "Medium",
                        progress: 0,
                        driveFolderId,
                        driveFolderUrl,
                        driveFolderStatus,
                        driveSubfolders,
                        quotedPrice: lead.value?.toString(),
                        quotedMargin: undefined,
                        quotedAreas: lead.cpqAreas || [],
                        quotedRisks: lead.cpqRisks || {},
                        quotedTravel: lead.cpqTravel || {},
                        quotedServices: lead.cpqServices || {},
                        siteReadiness: lead.siteReadiness || {},
                        clientName: lead.clientName,
                        clientContact: lead.contactName,
                        clientEmail: lead.contactEmail,
                        clientPhone: lead.contactPhone,
                        projectAddress: lead.projectAddress,
                        dispatchLocation: lead.dispatchLocation,
                        distance: lead.distance,
                        scopeSummary: scopeSummaryStage,
                    } as any);

                    log(`Auto-created production project for lead ${leadId} (${lead.clientName}) with UPID: ${universalProjectId}, scope: ${scopeSummaryStage}`);

                    // Migrate lead documents to Google Drive "Additional Documents" folder
                    if (driveFolderStatus === "success" && driveSubfolders?.additionalDocuments) {
                        try {
                            const documents = await storage.getLeadDocuments(leadId);
                            for (const doc of documents) {
                                if (!doc.movedToDriveAt && doc.storageKey) {
                                    try {
                                        const storagePath = path.join(process.cwd(), doc.storageKey);
                                        if (fs.existsSync(storagePath)) {
                                            const fileBuffer = fs.readFileSync(storagePath);
                                            const driveResult = await uploadFileToDrive(
                                                driveSubfolders.additionalDocuments,
                                                doc.originalName,
                                                doc.mimeType,
                                                fileBuffer
                                            );

                                            await storage.updateLeadDocument(doc.id, {
                                                movedToDriveAt: new Date(),
                                                driveFileId: driveResult.fileId,
                                                driveFileUrl: driveResult.webViewLink,
                                            });

                                            log(`Migrated document "${doc.originalName}" to Google Drive for lead ${leadId}`);
                                        }
                                    } catch (docErr) {
                                        log(`WARN: Failed to migrate document ${doc.id}: ${(docErr as any)?.message}`);
                                    }
                                }
                            }
                        } catch (migrationErr) {
                            log(`WARN: Document migration failed for lead ${leadId}: ${(migrationErr as any)?.message}`);
                        }
                    }
                }
            }

            res.json(lead);
        } catch (err) {
            log("ERROR: Stage update error - " + (err as any)?.message);
            return res.status(500).json({ message: "Failed to update stage" });
        }
    })
);

// POST /api/leads/:id/generate-upid
leadsOperationsRouter.post(
    "/api/leads/:id/generate-upid",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const leadId = Number(req.params.id);
            const lead = await storage.getLead(leadId);
            if (!lead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            if (lead.projectCode) {
                return res.json({
                    success: true,
                    upid: lead.projectCode,
                    driveFolderUrl: null,
                    message: "UPID already exists for this lead",
                    alreadyExists: true,
                });
            }

            if (!lead.clientName) {
                return res.status(400).json({ message: "Client name is required to generate UPID" });
            }

            const universalProjectId = generateUPID({
                clientName: lead.clientName,
                projectName: lead.projectName || lead.projectAddress || 'Project',
                closedWonDate: new Date(),
                leadSource: lead.leadSource,
            });
            log(`[Early Binding] Generated UPID for lead ${leadId}: ${universalProjectId}`);

            let driveFolderUrl: string | null = null;
            let driveFolderId: string | null = null;

            try {
                const driveConnected = await isGoogleDriveConnected();
                if (driveConnected) {
                    const folderResult = await createProjectFolder(universalProjectId);
                    driveFolderId = folderResult.folderId;
                    driveFolderUrl = folderResult.folderUrl;
                    log(`[Early Binding] Created Google Drive folder for ${universalProjectId}: ${driveFolderUrl}`);
                }
            } catch (err) {
                log("WARN: [Early Binding] Google Drive folder creation failed: " + (err as any)?.message);
            }

            await storage.updateLead(leadId, {
                projectCode: universalProjectId,
                driveFolderId: driveFolderId || undefined,
                driveFolderUrl: driveFolderUrl || undefined,
            } as any);

            res.json({
                success: true,
                upid: universalProjectId,
                driveFolderUrl,
                driveFolderId,
                message: `UPID generated: ${universalProjectId}`,
                alreadyExists: false,
            });
        } catch (err) {
            log("ERROR: Generate UPID error - " + (err as any)?.message);
            return res.status(500).json({ message: "Failed to generate UPID" });
        }
    })
);
