import type { Express, Request, Response } from "express";
import { db } from "../db";
import { timeLogs } from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { log } from "../lib/logger";

export function registerTimeLogRoutes(app: Express): void {
  app.get("/api/time-logs", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const techId = (req.user as any)?.id?.toString() || "";
      const { projectId, date } = req.query;
      
      let query = db.select().from(timeLogs);
      
      const conditions = [];
      if (techId) {
        conditions.push(eq(timeLogs.techId, techId));
      }
      if (projectId) {
        conditions.push(eq(timeLogs.projectId, Number(projectId)));
      }
      if (date) {
        const targetDate = new Date(date as string);
        targetDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        conditions.push(gte(timeLogs.createdAt, targetDate));
        conditions.push(lt(timeLogs.createdAt, nextDate));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const logs = await query.orderBy(desc(timeLogs.createdAt));
      res.json(logs);
    } catch (error: any) {
      log("ERROR: Error fetching time logs - " + (error?.message || error));
      res.status(500).json({ message: error.message });
    }
  }));

  app.post("/api/time-logs", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const techId = (req.user as any)?.id?.toString() || "";
      const { projectId, role, hours, notes } = req.body;
      
      if (!projectId || !role || hours === undefined) {
        return res.status(400).json({ message: "projectId, role, and hours are required" });
      }
      
      const [newLog] = await db.insert(timeLogs).values({
        projectId: Number(projectId),
        techId,
        roleType: role,
        notes: notes || null,
      }).returning();
      
      res.status(201).json(newLog);
    } catch (error: any) {
      log("ERROR: Error creating time log - " + (error?.message || error));
      res.status(500).json({ message: error.message });
    }
  }));

  app.patch("/api/time-logs/:id", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const logId = Number(req.params.id);
      const { hours, notes, role } = req.body;
      
      const updateData: Record<string, any> = {};
      if (hours !== undefined) updateData.hours = hours.toString();
      if (notes !== undefined) updateData.notes = notes;
      if (role !== undefined) updateData.role = role;
      
      const [updated] = await db.update(timeLogs)
        .set(updateData)
        .where(eq(timeLogs.id, logId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Time log not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      log("ERROR: Error updating time log - " + (error?.message || error));
      res.status(500).json({ message: error.message });
    }
  }));

  app.delete("/api/time-logs/:id", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const logId = Number(req.params.id);
      
      const [deleted] = await db.delete(timeLogs)
        .where(eq(timeLogs.id, logId))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ message: "Time log not found" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      log("ERROR: Error deleting time log - " + (error?.message || error));
      res.status(500).json({ message: error.message });
    }
  }));
}
