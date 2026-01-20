import type { Express, RequestHandler } from "express";

/**
 * Auth-disabled mode.
 * All auth endpoints are no-ops and guards always allow access.
 */

export async function setupAuth(app: Express) {
  app.get("/api/login", async (req, res) => {
    res.redirect("/");
  });

  // Callback route (not needed for local auth, but keep for compatibility)
  app.get("/api/callback", (req, res) => {
    res.redirect('/');
  });

  // Logout route
  app.get("/api/logout", (req, res) => {
    res.redirect("/");
  });
  app.post("/api/auth/login", async (req, res) => {
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    app.post("/api/test-login", async (req, res) => {
      res.json({ success: true });
    });
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.user) {
    (req as any).user = {
      claims: {
        sub: "local-user",
        email: "local@scan2plan.io",
        first_name: "Local",
        last_name: "User",
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    };
  }

  return next();
};

// Role-based authorization middleware
import type { UserRole } from "@shared/models/auth";

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req, res, next) => {
    next();
  };
}

// Admin email access control
const ADMIN_EMAILS = [
  "chase@scan2plan.io",
  "elijah@scan2plan.io",
];

const CEO_EMAIL = "v@scan2plan.io";

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isCeoEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === CEO_EMAIL;
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  next();
};

export const allowCeoViewOnly: RequestHandler = async (req, res, next) => {
  next();
};
