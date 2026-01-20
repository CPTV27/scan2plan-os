import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";

export const notificationsRouter = Router();

notificationsRouter.get("/", isAuthenticated, (req, res) => {
    // Stub for notifications - currently not implemented in backend but used by frontend
    res.json([]);
});

notificationsRouter.patch("/:id/read", isAuthenticated, (req, res) => {
    res.json({ success: true });
});
