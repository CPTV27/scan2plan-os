import type { Express } from "express";

// Register auth-specific routes
// NOTE: The main auth routes (/api/auth/google, /api/auth/user, /api/logout)
// are registered in setupAuth() in replitAuth.ts
export function registerAuthRoutes(app: Express): void {
  // Check session status - allows unauthenticated access to show login prompt
  app.get("/api/auth/session-status", async (req: any, res) => {
    const user = req.user;
    const isAuthenticated = !!user;

    res.json({
      authenticated: isAuthenticated,
      email: user?.email || null,
      isEmailAllowed: user?.email?.endsWith("@scan2plan.io") ?? false,
      accessGranted: isAuthenticated,
    });
  });

  // Check if user has a password set
  app.get("/api/auth/password-status", async (req: any, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res.json({
      hasPassword: !!user.passwordHash,
      passwordVerified: true, // For now, Google OAuth users are auto-verified
    });
  });

  // Set a new password (for first-time setup) - placeholder for future use
  app.post("/api/auth/set-password", async (req: any, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // TODO: Implement password setting if needed for non-OAuth users
    res.json({ success: true });
  });

  // Verify existing password - placeholder for future use
  app.post("/api/auth/verify-password", async (req: any, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // TODO: Implement password verification if needed
    res.json({ success: true });
  });
}
