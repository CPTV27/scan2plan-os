import { Router } from "express";
import { storage } from "../storage";
import { createProjectSpace, isGoogleChatConfigured } from "../google-chat";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";

export const chatRouter = Router();

// Check if Chat is configured
// GET /api/chat/status
chatRouter.get("/status", isAuthenticated, (req, res) => {
    res.json({ configured: isGoogleChatConfigured() });
});

// Create a Project Space Manually
// POST /api/chat/space
chatRouter.post("/space", isAuthenticated, requireRole("ceo", "production", "sales"), asyncHandler(async (req, res) => {
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
    }

    const project = await storage.getProject(projectId);
    if (!project) {
        return res.status(404).json({ message: "Project not found" });
    }

    // Prevent duplicate space creation if already exists
    if (project.chatSpaceUrl) {
        return res.json({
            success: true,
            spaceUrl: project.chatSpaceUrl,
            alreadyExists: true
        });
    }

    // Get lead to find client email/members
    const lead = project.leadId ? await storage.getLead(project.leadId) : null;

    // Build member list
    const members = new Set<string>();
    if (process.env.GOOGLE_CHAT_DEFAULT_MEMBERS) {
        process.env.GOOGLE_CHAT_DEFAULT_MEMBERS.split(',').forEach(e => members.add(e.trim()));
    }
    // Add current user
    if ((req.user as any).username && (req.user as any).username.includes('@')) {
        members.add((req.user as any).username);
    }

    const result = await createProjectSpace({
        universalProjectId: project.universalProjectId || `PROJ-${project.id}`,
        clientName: project.clientName || lead?.clientName || "Unknown Client",
        driveFolderUrl: project.driveFolderUrl,
        scopeOfWork: (project as any).scope || (project as any).notes || lead?.scope || "No scope defined",
        memberEmails: Array.from(members),
    });

    if (!result.success) {
        return res.status(500).json({ message: result.error });
    }

    // Save the new space to the project
    await storage.updateProject(projectId, {
        chatSpaceId: result.spaceName,
        chatSpaceUrl: result.spaceUrl
    });

    res.json({ success: true, spaceUrl: result.spaceUrl });
}));
