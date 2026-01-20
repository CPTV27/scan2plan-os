import { Router } from "express";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getPerformanceStats, getActiveRequests, clearPerformanceStats } from "../middleware/performanceLogger";

export const performanceRouter = Router();

performanceRouter.get("/stats", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints: getPerformanceStats(),
        activeRequests: getActiveRequests(),
    });
}));

performanceRouter.post("/stats/clear", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    clearPerformanceStats();
    res.json({ success: true, message: "Performance stats cleared" });
}));
