import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  const mockUser = {
    id: "local-user",
    email: "local@scan2plan.io",
    firstName: "Local",
    lastName: "User",
    profileImageUrl: null,
    role: "ceo",
    scantecHome: null,
    passwordHash: null,
    passwordSetAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    res.json(mockUser);
  });

  // Check session status - allows unauthenticated access to show login prompt
  app.get("/api/auth/session-status", async (req: any, res) => {
    res.json({
      authenticated: true,
      email: mockUser.email,
      isEmailAllowed: true,
      accessGranted: true,
    });
  });

  // Check if user has a password set
  app.get("/api/auth/password-status", async (req: any, res) => {
    res.json({
      hasPassword: true,
      passwordVerified: true,
    });
  });

  // Set a new password (for first-time setup)
  app.post("/api/auth/set-password", async (req: any, res) => {
    res.json({ success: true });
  });

  // Verify existing password
  app.post("/api/auth/verify-password", async (req: any, res) => {
    res.json({ success: true });
  });
}
