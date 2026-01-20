import { Router } from "express";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { quickbooksClient } from "../../quickbooks-client";
import { db } from "../../db";
import { settings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { log } from "../../lib/logger";

export const quickbooksReportsRouter = Router();

// GET /api/analytics/profitability
quickbooksReportsRouter.get(
    "/api/analytics/profitability",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const stats = await quickbooksClient.getProfitabilityStats();
            res.json(stats);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

// GET /api/quickbooks/financial-metrics
quickbooksReportsRouter.get(
    "/api/quickbooks/financial-metrics",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const mappingResult = await db.select().from(settings).where(eq(settings.key, "financial_mapping")).limit(1);
            const mapping = mappingResult.length > 0
                ? (mappingResult[0].value as { operatingAccountId?: string; taxAccountId?: string })
                : {};

            const metrics = await quickbooksClient.syncFinancialMetrics(mapping);
            res.json(metrics);
        } catch (error: any) {
            const errorMessage = error.message || "Failed to sync metrics";
            if (errorMessage.includes("not connected")) {
                res.status(401).json({ message: "QuickBooks not connected", needsReauth: true });
            } else {
                res.status(500).json({ message: errorMessage });
            }
        }
    })
);

// GET /api/analytics/job-costing
quickbooksReportsRouter.get(
    "/api/analytics/job-costing",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const analytics = await quickbooksClient.getJobCostingAnalytics();
            res.json(analytics);
        } catch (error: any) {
            log("ERROR: Job costing analytics error - " + error.message);
            res.status(500).json({ error: error.message });
        }
    })
);

// GET /api/analytics/overhead
quickbooksReportsRouter.get(
    "/api/analytics/overhead",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const analytics = await quickbooksClient.getJobCostingAnalytics();
            res.json(analytics.overhead);
        } catch (error: any) {
            log("ERROR: Overhead analytics error - " + error.message);
            res.status(500).json({ error: error.message });
        }
    })
);
