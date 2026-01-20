import { Router } from "express";
import { storage } from "../../storage";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { applyStalenessPenalties, getStalenessStatus } from "../../staleness";
import { calculateProbability, recalculateAllProbabilities, getStageSpecificStaleness } from "../../probability";

export const leadsScoringRouter = Router();

// GET /api/staleness/status
leadsScoringRouter.get(
    "/api/staleness/status",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leads = await storage.getLeads();
        const statusList = leads.map(lead => ({
            leadId: lead.id,
            clientName: lead.clientName,
            ...getStalenessStatus(lead.lastContactDate)
        }));
        res.json(statusList);
    })
);

// POST /api/staleness/apply
leadsScoringRouter.post(
    "/api/staleness/apply",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        const results = await applyStalenessPenalties();
        res.json(results);
    })
);

// POST /api/probability/recalculate
leadsScoringRouter.post(
    "/api/probability/recalculate",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        const results = await recalculateAllProbabilities();
        res.json(results);
    })
);

// GET /api/leads/:id/probability-factors
leadsScoringRouter.get(
    "/api/leads/:id/probability-factors",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const lead = await storage.getLead(leadId);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const factors = calculateProbability(lead);
        const staleness = getStageSpecificStaleness(lead.dealStage, lead.lastContactDate);

        res.json({
            currentProbability: lead.probability,
            calculatedProbability: factors.finalScore,
            factors,
            staleness,
            lastContactDate: lead.lastContactDate,
            dealStage: lead.dealStage,
        });
    })
);
