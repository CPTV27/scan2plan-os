import { Router } from "express";
import { storage } from "../../storage";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { api } from "@shared/routes";
import { validateBody } from "../../middleware/validation";
import { getAutoTierAUpdate, checkAttributionGate } from "../../lib/profitabilityGates";
import { TIER_A_THRESHOLD } from "@shared/schema";
import { leadService } from "../../services/leadService";
import { generateClientCode, generateUniversalProjectId, generateUPID } from "@shared/utils/projectId";
import { enrichLeadWithGoogleIntel } from "../../google-intel";
import { isGoogleDriveConnected, createProjectFolder, uploadFileToDrive } from "../../googleDrive";
import { analyzeOutcome } from "../../services/personaLearning";
import { log } from "../../lib/logger";
import { z } from "zod";
import fs from "fs";
import path from "path";

// Create router
export const leadsCoreRouter = Router();

// Validation schemas for core updates
const safePatchFieldsSchema = z.object({
    buyerPersona: z.string().optional(),
    leadPriority: z.number().min(1).max(5).optional(),
    notes: z.string().optional(),
}).strict();

// GET /api/leads - List all leads
leadsCoreRouter.get(
    api.leads.list.path,
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leads = await storage.getLeads();
        res.json(leads);
    })
);

// GET /api/leads/trash - Get soft-deleted leads
leadsCoreRouter.get(
    "/api/leads/trash",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (_req, res) => {
        const deletedLeads = await storage.getDeletedLeads();
        res.json(deletedLeads);
    })
);

// GET /api/leads/:id - Get single lead
leadsCoreRouter.get(
    api.leads.get.path,
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const lead = await storage.getLead(Number(req.params.id));
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        // Lazy enrichment check
        if (lead.projectAddress && !lead.googleIntel && process.env.GOOGLE_MAPS_API_KEY) {
            enrichLeadWithGoogleIntel(lead.projectAddress, lead.dispatchLocation || undefined)
                .then(async (googleIntel) => {
                    if (googleIntel.buildingInsights?.available || googleIntel.travelInsights?.available) {
                        await storage.updateLead(lead.id, { googleIntel } as any);
                        log(`[Google Intel] Lazy-enriched lead ${lead.id} with Google data`);
                    }
                })
                .catch(err => {
                    log(`[Google Intel] Lazy enrichment failed for lead ${lead.id}: ${err.message}`);
                });
        }

        res.json(lead);
    })
);

// GET /api/leads/:id/cpq-quotes - Get CPQ quotes for lead
leadsCoreRouter.get(
    "/api/leads/:id/cpq-quotes",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const { cpqStorage } = await import("../../storage/cpq");
        const quotes = await cpqStorage.getQuotesByLeadId(Number(req.params.id));
        res.json(quotes);
    })
);

// POST /api/leads - Create new lead
leadsCoreRouter.post(
    api.leads.create.path,
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            log("[Lead Create] Request body: " + JSON.stringify(req.body, null, 2).slice(0, 1000));
            const input = api.leads.create.input.parse(req.body);

            // Auto Tier A flagging based on sqft
            const tierAUpdate = getAutoTierAUpdate(input.sqft);

            const leadData = {
                ...input,
                ownerId: input.ownerId || (req.user as any)?.id || null,
                leadScore: 0,
                ...(tierAUpdate || {}),
            } as any;

            if (tierAUpdate) {
                log(`[Auto Tier A] Lead flagged as Tier A (${input.sqft?.toLocaleString()} sqft >= ${TIER_A_THRESHOLD.toLocaleString()})`);
            }

            const lead = await storage.createLead(leadData);
            log("[Lead Create] Success, lead ID: " + lead.id);

            // Pre-compute embedding for project matching (background)
            leadService.precomputeEmbedding(lead).catch(() => { });

            // Google Intel enrichment
            if (lead.projectAddress && process.env.GOOGLE_MAPS_API_KEY) {
                enrichLeadWithGoogleIntel(lead.projectAddress, lead.dispatchLocation || undefined)
                    .then(async (googleIntel) => {
                        if (googleIntel.buildingInsights?.available || googleIntel.travelInsights?.available) {
                            await storage.updateLead(lead.id, { googleIntel } as any);
                            log(`[Google Intel] Enriched lead ${lead.id} with Google data`);
                        }
                    })
                    .catch(err => {
                        log(`[Google Intel] Enrichment failed for lead ${lead.id}: ${err.message}`);
                    });
            }

            // HubSpot sync if buyer persona present
            if (lead.buyerPersona) {
                (async () => {
                    try {
                        const hubspotService = await import("../../services/hubspot");
                        const connected = await hubspotService.isHubSpotConnected();
                        if (connected) {
                            const personaList = await hubspotService.getPersonas();
                            const persona = personaList.find(p => p.code === lead.buyerPersona);
                            if (persona) {
                                const result = await hubspotService.syncLead(lead, persona);
                                log(`[HubSpot] Auto-synced new lead ${lead.id}: ${result.success ? 'success' : result.error}`);
                            }
                        }
                    } catch (err: any) {
                        log(`[HubSpot] Auto-sync failed for lead ${lead.id}: ${err.message}`);
                    }
                })();
            }

            res.status(201).json(lead);
        } catch (err: any) {
            log("ERROR: [Lead Create] - " + (err.message || err));
            if (err instanceof z.ZodError) {
                const errorMessage = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                log("ERROR: [Lead Create] Validation errors - " + errorMessage);
                return res.status(400).json({ message: errorMessage });
            }
            res.status(500).json({ message: err.message || "Failed to create lead" });
        }
    })
);

// PUT /api/leads/:id - Full update
leadsCoreRouter.put(
    api.leads.update.path,
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const leadId = Number(req.params.id);
            const input = api.leads.update.input.parse(req.body);

            const previousLead = await storage.getLead(leadId);
            if (!previousLead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            const isClosingWon = input.dealStage === "Closed Won" && previousLead.dealStage !== "Closed Won";
            const isEnteringProposal = input.dealStage === "Proposal" && previousLead.dealStage !== "Proposal";
            const addressChanged = input.projectAddress && input.projectAddress !== previousLead.projectAddress;

            // Attribution gate - required for Closed Won
            if (isClosingWon) {
                const leadWithUpdates = { ...previousLead, ...input } as any;
                const attributionCheck = checkAttributionGate(leadWithUpdates, true);
                if (!attributionCheck.passed) {
                    log(`[Attribution Gate] Blocked Closed Won for lead ${leadId}: ${attributionCheck.message}`);
                    return res.status(403).json({
                        error: attributionCheck.code,
                        message: attributionCheck.message,
                        details: attributionCheck.details,
                    });
                }
            }

            const updateData: any = { ...input };

            // Auto Tier A flagging based on sqft change
            const newSqft = input.sqft ?? previousLead.sqft;
            const wasNotTierA = previousLead.abmTier !== "Tier A";
            const tierAUpdate = getAutoTierAUpdate(newSqft);
            if (tierAUpdate && wasNotTierA) {
                updateData.abmTier = tierAUpdate.abmTier;
                updateData.leadPriority = tierAUpdate.leadPriority;
                log(`[Auto Tier A] Lead ${leadId} upgraded to Tier A (${newSqft?.toLocaleString()} sqft)`);
            }

            // Project Code generation on Proposal stage
            if (isEnteringProposal && !previousLead?.projectCode) {
                const allLeads = await storage.getLeads();
                const currentYear = new Date().getFullYear();
                const yearLeads = allLeads.filter(l => l.createdAt && new Date(l.createdAt).getFullYear() === currentYear);
                const sequenceNumber = yearLeads.length + 1;

                const clientCode = generateClientCode(previousLead?.clientName || input.clientName || "UNKN");
                const projectCode = generateUniversalProjectId({
                    clientCode,
                    projectNumber: sequenceNumber,
                    creationDate: new Date(),
                });
                updateData.projectCode = projectCode;
                log(`Auto-generated Project Code for lead ${leadId}: ${projectCode}`);
            }

            const lead = await storage.updateLead(leadId, updateData);

            // Re-compute embedding if key fields changed (background)
            const embeddingRelevantFieldsChanged = addressChanged ||
                (input.projectName !== undefined && input.projectName !== previousLead.projectName) ||
                (input.buildingType !== undefined && input.buildingType !== previousLead.buildingType) ||
                (input.sqft !== undefined && input.sqft !== previousLead.sqft) ||
                (input.scope !== undefined && input.scope !== previousLead.scope) ||
                (input.disciplines !== undefined && JSON.stringify(input.disciplines) !== JSON.stringify(previousLead.disciplines));

            if (embeddingRelevantFieldsChanged) {
                leadService.precomputeEmbedding(lead).catch(() => { });
            }

            // Google Intel refresh
            if (addressChanged && process.env.GOOGLE_MAPS_API_KEY) {
                enrichLeadWithGoogleIntel(input.projectAddress!, lead.dispatchLocation || undefined)
                    .then(async (googleIntel) => {
                        if (googleIntel.buildingInsights?.available || googleIntel.travelInsights?.available) {
                            await storage.updateLead(leadId, { googleIntel } as any);
                            log(`[Google Intel] Refreshed lead ${leadId} with new address data`);
                        }
                    })
                    .catch(err => {
                        log(`[Google Intel] Refresh failed for lead ${leadId}: ${err.message}`);
                    });
            }

            // Legacy project closing logic (for direct PUT updates to Closed Won)
            // Note: Ideally this should use the PATCH stage endpoint, but we keep it here for backward compatibility or direct edits
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
                        log("WARN: Google Drive folder creation failed (non-blocking): " + (err as any)?.message);
                    }

                    const scopeSummaryPut = leadService.generateScopeSummary(lead);

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
                        scopeSummary: scopeSummaryPut,
                    } as any);

                    log(`Auto-created production project for lead ${leadId} (${lead.clientName}) with UPID: ${universalProjectId}`);
                }

                // Persona Learning - WON
                if (lead.buyerPersona) {
                    const cycleDays = previousLead.createdAt
                        ? Math.floor((Date.now() - new Date(previousLead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                        : undefined;

                    analyzeOutcome({
                        leadId: leadId,
                        personaCode: lead.buyerPersona,
                        outcome: 'won',
                        dealValue: lead.value ? Number(lead.value) : undefined,
                        cycleLengthDays: cycleDays,
                        stageAtClose: 'Closed Won',
                        projectType: lead.buildingType || undefined,
                        notes: lead.notes || undefined,
                    }).catch(err => {
                        log(`[Persona Learning] Analysis failed for won lead ${leadId}: ${err.message}`);
                    });
                }
            }

            // Persona Learning - LOST
            const isClosingLost = input.dealStage === "Closed Lost" && previousLead.dealStage !== "Closed Lost";
            if (isClosingLost && lead.buyerPersona) {
                const cycleDays = previousLead.createdAt
                    ? Math.floor((Date.now() - new Date(previousLead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                    : undefined;

                analyzeOutcome({
                    leadId: leadId,
                    personaCode: lead.buyerPersona,
                    outcome: 'lost',
                    dealValue: lead.value ? Number(lead.value) : undefined,
                    cycleLengthDays: cycleDays,
                    stageAtClose: 'Closed Lost',
                    projectType: lead.buildingType || undefined,
                    notes: lead.notes || undefined,
                }).catch(err => {
                    log(`[Persona Learning] Analysis failed for lost lead ${leadId}: ${err.message}`);
                });
            }

            res.json(lead);
        } catch (err: any) {
            log("ERROR: [Lead PUT] - " + (err.message || err));
            if (err instanceof z.ZodError) {
                const errorMessage = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                return res.status(400).json({ message: `Invalid fields: ${errorMessage}` });
            }
            return res.status(400).json({ message: "Invalid update data" });
        }
    })
);

// PATCH /api/leads/:id - Safe partial update
leadsCoreRouter.patch(
    "/api/leads/:id",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const leadId = Number(req.params.id);

            const updates = safePatchFieldsSchema.parse(req.body);

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ message: "No valid fields to update" });
            }

            const previousLead = await storage.getLead(leadId);
            if (!previousLead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            const lead = await storage.updateLead(leadId, updates);
            res.json(lead);
        } catch (err: any) {
            log("ERROR: [Lead PATCH] - " + (err.message || err));
            if (err instanceof z.ZodError) {
                const errorMessage = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                return res.status(400).json({ message: `Invalid fields: ${errorMessage}. Use PUT for full updates.` });
            }
            return res.status(400).json({ message: err.message || "Invalid update data" });
        }
    })
);

// DELETE /api/leads/:id - Soft delete
leadsCoreRouter.delete(
    api.leads.delete.path,
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const user = req.user as any;
        const lead = await storage.softDeleteLead(Number(req.params.id), user?.id);
        res.json(lead);
    })
);

// PATCH /api/leads/:id/restore - Restore soft-deleted
leadsCoreRouter.patch(
    "/api/leads/:id/restore",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const lead = await storage.restoreLead(Number(req.params.id));
        res.json(lead);
    })
);

// DELETE /api/leads/:id/permanent - Hard delete
leadsCoreRouter.delete(
    "/api/leads/:id/permanent",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        await storage.deleteLead(Number(req.params.id));
        res.status(204).send();
    })
);

// POST /api/leads/:id/signature - Save client signature
leadsCoreRouter.post(
    "/api/leads/:id/signature",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const { signatureImage, signerName, signerEmail } = req.body;

        if (!signatureImage || !signerName || !signerEmail) {
            return res.status(400).json({
                message: "signatureImage, signerName, and signerEmail are required"
            });
        }

        const lead = await storage.updateLead(leadId, {
            signatureImage,
            signerName,
            signerEmail,
            signedAt: new Date(),
        } as any);

        log(`[Signature] Lead ${leadId} signed by ${signerName} (${signerEmail})`);

        res.json(lead);
    })
);
