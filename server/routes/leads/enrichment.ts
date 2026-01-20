import { Router } from "express";
import { storage } from "../../storage";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validation";
import { log } from "../../lib/logger";
import { z } from "zod";
import { TOUCHPOINT_OPTIONS } from "@shared/schema";
import crypto from "crypto";

export const leadsEnrichmentRouter = Router();

const attributionSchema = z.object({
    touchpoint: z.enum(TOUCHPOINT_OPTIONS.map(t => t.value) as [string, ...string[]]),
});

// GET /api/leads/:id/research
leadsEnrichmentRouter.get(
    "/api/leads/:id/research",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const research = await storage.getLeadResearch(leadId);
        res.json(research);
    })
);

// GET /api/leads/:id/attributions
leadsEnrichmentRouter.get(
    "/api/leads/:id/attributions",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const attributions = await storage.getDealAttributions(leadId);
        res.json(attributions);
    })
);

// POST /api/leads/:id/attributions
leadsEnrichmentRouter.post(
    "/api/leads/:id/attributions",
    isAuthenticated,
    requireRole("ceo", "sales"),
    validateBody(attributionSchema),
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const { touchpoint } = req.body;
        const attribution = await storage.createDealAttribution({
            leadId,
            touchpoint,
        });
        res.status(201).json(attribution);
    })
);

// DELETE /api/leads/:id/attributions/:attrId
leadsEnrichmentRouter.delete(
    "/api/leads/:id/attributions/:attrId",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const attrId = Number(req.params.attrId);
        await storage.deleteDealAttribution(attrId);
        res.status(204).send();
    })
);

// POST /api/leads/:id/hubspot-sync
leadsEnrichmentRouter.post(
    "/api/leads/:id/hubspot-sync",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const { personaCode } = req.body;

        const lead = await storage.getLead(leadId);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        // Dynamic import to avoid circular deps or heavy loads
        const hubspotService = await import("../../services/hubspot");

        const personaList = await hubspotService.getPersonas();
        const persona = personaList.find(p => p.code === (personaCode || lead.buyerPersona || 'BP1'));
        if (!persona) return res.status(400).json({ message: "Persona not found" });

        const result = await hubspotService.syncLead(lead, persona);
        res.json(result);
    })
);

// GET /api/leads/:id/expenses (QuickBooks)
leadsEnrichmentRouter.get(
    "/api/leads/:id/expenses",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const { quickbooksClient } = await import("../../quickbooks-client");
            const leadId = parseInt(req.params.id);
            const expenses = await quickbooksClient.getExpensesByLead(leadId);
            const summary = await quickbooksClient.getExpenseSummaryByLead(leadId);
            res.json({ expenses, summary });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

// GET /api/leads/:id/outstanding-balance
leadsEnrichmentRouter.get(
    "/api/leads/:id/outstanding-balance",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        try {
            const leadId = Number(req.params.id);
            const leadInvoices = await storage.getInvoicesByLead(leadId);

            const outstandingBalance = leadInvoices.reduce((sum, inv) => {
                if (inv.status !== "Paid" && inv.status !== "Written Off") {
                    return sum + Number(inv.totalAmount || 0);
                }
                return sum;
            }, 0);

            res.json({
                leadId,
                outstandingBalance,
                invoiceCount: leadInvoices.filter(i => i.status !== "Paid").length
            });
        } catch (error) {
            log("ERROR: Outstanding balance check error - " + (error as any)?.message);
            res.status(500).json({ message: "Failed to check outstanding balance" });
        }
    })
);

// POST /api/leads/:id/site-readiness-link
leadsEnrichmentRouter.post(
    "/api/leads/:id/site-readiness-link",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const { questionIds, siteReadiness } = req.body;

        const lead = await storage.getLead(leadId);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const existingAnswers = (lead.siteReadiness as { internal?: Record<string, any>; client?: Record<string, any> }) || {};
        const structuredAnswers = {
            internal: { ...(existingAnswers.internal || {}), ...(siteReadiness || {}) },
            client: existingAnswers.client || {},
        };

        await storage.updateLead(leadId, {
            clientToken: token,
            clientTokenExpiresAt: expiresAt,
            siteReadinessStatus: "sent",
            siteReadinessSentAt: new Date(),
            siteReadinessQuestionsSent: questionIds,
            siteReadiness: structuredAnswers,
        } as any);

        const appUrl = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : "http://localhost:5000";
        const magicLink = `${appUrl}/site-readiness/${token}`;

        log(`[Site Readiness] Generated magic link for lead ${leadId} with ${questionIds.length} questions`);

        res.json({
            success: true,
            magicLink,
            expiresAt,
            questionsCount: questionIds.length,
        });
    })
);

// PUBLIC: GET /api/public/site-readiness/:token
leadsEnrichmentRouter.get(
    "/api/public/site-readiness/:token",
    asyncHandler(async (req, res) => {
        const { token } = req.params;

        const lead = await storage.getLeadByClientToken(token);
        if (!lead) return res.status(404).json({ message: "Invalid or expired link" });

        if (lead.clientTokenExpiresAt && new Date(lead.clientTokenExpiresAt) < new Date()) {
            return res.status(410).json({ message: "This link has expired" });
        }

        const sentQuestionIds = (lead.siteReadinessQuestionsSent as string[]) || [];
        const structuredAnswers = (lead.siteReadiness as { internal?: Record<string, any>; client?: Record<string, any> }) || {};

        // ONLY return client-submitted answers - NEVER expose internal/CEO answers
        const clientAnswers = structuredAnswers.client || {};

        // Filter to only sent questions
        const filteredClientAnswers: Record<string, any> = {};
        for (const qId of sentQuestionIds) {
            if (clientAnswers[qId] !== undefined) {
                filteredClientAnswers[qId] = clientAnswers[qId];
            }
        }

        res.json({
            projectName: lead.projectName || lead.clientName,
            questionIds: sentQuestionIds,
            existingAnswers: filteredClientAnswers,
            status: lead.siteReadinessStatus,
        });
    })
);

// PUBLIC: POST /api/public/site-readiness/:token
leadsEnrichmentRouter.post(
    "/api/public/site-readiness/:token",
    asyncHandler(async (req, res) => {
        const { token } = req.params;
        const { answers } = req.body;

        const lead = await storage.getLeadByClientToken(token);
        if (!lead) return res.status(404).json({ message: "Invalid or expired link" });

        if (lead.clientTokenExpiresAt && new Date(lead.clientTokenExpiresAt) < new Date()) {
            return res.status(410).json({ message: "This link has expired" });
        }

        const existingAnswers = (lead.siteReadiness as { internal?: Record<string, any>; client?: Record<string, any> }) || {};

        // Update ONLY the client segment, preserving internal/CEO answers
        const updatedAnswers = {
            internal: existingAnswers.internal || {},
            client: { ...(existingAnswers.client || {}), ...answers },
        };

        await storage.updateLead(lead.id, {
            siteReadiness: updatedAnswers,
            siteReadinessStatus: "completed",
            siteReadinessCompletedAt: new Date(),
        } as any);

        log(`[Site Readiness] Client submitted answers for lead ${lead.id}`);

        res.json({
            success: true,
            message: "Thank you! Your answers have been submitted."
        });
    })
);
