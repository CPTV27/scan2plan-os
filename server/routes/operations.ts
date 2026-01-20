import { Router } from "express";
import { db } from "../db";
import { missionLogs } from "@shared/schema";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { storage } from "../storage";
import { desc } from "drizzle-orm";
import { log } from "../lib/logger";

export const operationsRouter = Router();

// GET Mission Logs
operationsRouter.get("/mission-logs", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
        const logs = await db.select().from(missionLogs).orderBy(desc(missionLogs.missionDate)).limit(100);
        res.json(logs);
    } catch (error: any) {
        log("ERROR: Error fetching mission logs - " + (error?.message || error));
        res.status(500).json({ message: error.message });
    }
}));

// POST Mission Log
operationsRouter.post("/mission-logs", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
        const { projectId, techId, notes } = req.body;
        const [newLog] = await db.insert(missionLogs).values({
            projectId: Number(projectId),
            techId: techId?.toString() || (req.user as any)?.id?.toString() || "",
            notes: notes || null,
            missionDate: new Date(),
        }).returning();
        res.status(201).json(newLog);
    } catch (error: any) {
        log("ERROR: Error creating mission log - " + (error?.message || error));
        res.status(500).json({ message: error.message });
    }
}));

// Project Completion Checklist
operationsRouter.post("/projects/:projectId/completion-checklist", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);
        const project = await storage.getProject(projectId);

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const items = req.body.items || [];
        const allComplete = items.length > 0 && items.every((item: any) => item.completed);

        await storage.updateProject(projectId, {
            status: allComplete ? "Complete" : project.status,
        } as any);

        res.json({ success: true, allComplete });
    } catch (error: any) {
        log("ERROR: Error updating completion checklist - " + (error?.message || error));
        res.status(500).json({ message: error.message });
    }
}));
