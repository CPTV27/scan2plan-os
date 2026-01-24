import type { Express, RequestHandler } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import type { UserRole } from "@shared/models/auth";

const PgSession = connectPgSimple(session);

// Admin and CEO emails for role assignment
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

// Determine role based on email
function getRoleForEmail(email: string): UserRole {
  if (isCeoEmail(email)) return "ceo";
  if (isAdminEmail(email)) return "ceo"; // Admins get CEO-level access
  // Default to sales for other @scan2plan.io emails
  if (email.endsWith("@scan2plan.io")) return "sales";
  return "sales"; // Default role
}

export async function setupAuth(app: Express) {
  // Check for required environment variables
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientID || !clientSecret) {
    console.warn("[Auth] Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required");
    console.warn("[Auth] Running in development mode with auto-login");
    return setupDevAuth(app);
  }

  if (!sessionSecret) {
    console.warn("[Auth] SESSION_SECRET not set, using default (not secure for production)");
  }

  // Configure session middleware
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: "sessions",
        createTableIfMissing: false, // Table already exists
      }),
      secret: sessionSecret || "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax",
      },
    })
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google OAuth Strategy
  const callbackURL = process.env.GOOGLE_CALLBACK_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://your-domain.com/api/auth/google/callback"
      : "http://localhost:5000/api/auth/google/callback");

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Google profile"), undefined);
          }

          // Check if user exists
          let [user] = await db.select().from(users).where(eq(users.email, email));

          if (!user) {
            // Create new user
            const role = getRoleForEmail(email);
            [user] = await db
              .insert(users)
              .values({
                email,
                firstName: profile.name?.givenName || profile.displayName?.split(" ")[0] || "User",
                lastName: profile.name?.familyName || profile.displayName?.split(" ").slice(1).join(" ") || "",
                profileImageUrl: profile.photos?.[0]?.value,
                role,
              })
              .returning();
            console.log(`[Auth] Created new user: ${email} with role: ${role}`);
          } else {
            // Update profile image if changed
            if (profile.photos?.[0]?.value && profile.photos[0].value !== user.profileImageUrl) {
              await db
                .update(users)
                .set({
                  profileImageUrl: profile.photos[0].value,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));
            }
          }

          return done(null, user);
        } catch (error) {
          console.error("[Auth] Error in Google strategy:", error);
          return done(error as Error, undefined);
        }
      }
    )
  );

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      done(null, user || null);
    } catch (error) {
      done(error, null);
    }
  });

  // Auth routes
  app.get("/api/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"],
  }));

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=auth_failed" }),
    (req, res) => {
      // Successful authentication
      res.redirect("/");
    }
  );

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("[Auth] Logout error:", err);
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("[Auth] Session destroy error:", err);
        }
        res.redirect("/login");
      });
    });
  });

  // Legacy routes for compatibility
  app.get("/api/login", (req, res) => {
    res.redirect("/api/auth/google");
  });

  app.get("/api/callback", (req, res) => {
    res.redirect("/");
  });

  console.log("[Auth] Google OAuth configured successfully");
}

// Development auth - auto-login without Google
function setupDevAuth(app: Express) {
  app.use(
    session({
      secret: "dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
  );

  // Auto-create dev user on first request
  app.use(async (req: any, res, next) => {
    if (!req.session.userId) {
      // Check if dev user exists
      let [devUser] = await db.select().from(users).where(eq(users.email, "dev@scan2plan.io"));

      if (!devUser) {
        [devUser] = await db
          .insert(users)
          .values({
            email: "dev@scan2plan.io",
            firstName: "Dev",
            lastName: "User",
            role: "ceo",
          })
          .returning();
      }

      req.session.userId = devUser.id;
      req.user = devUser;
    } else if (!req.user) {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      req.user = user;
    }
    next();
  });

  app.get("/api/auth/user", (req: any, res) => {
    res.json(req.user);
  });

  app.get("/api/auth/google", (req, res) => {
    res.redirect("/");
  });

  app.get("/api/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  app.get("/api/login", (req, res) => res.redirect("/"));
  app.get("/api/callback", (req, res) => res.redirect("/"));

  console.log("[Auth] Running in development mode with auto-login");
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated?.() && req.user) {
    return next();
  }

  // For development mode where passport isn't initialized
  if ((req as any).user) {
    return next();
  }

  res.status(401).json({ error: "Not authenticated" });
};

// Role-based authorization middleware
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

// Admin-only middleware
export const requireAdmin: RequestHandler = (req, res, next) => {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!isAdminEmail(user.email) && !isCeoEmail(user.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};

// CEO view-only for sensitive operations
export const allowCeoViewOnly: RequestHandler = (req, res, next) => {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // CEO can only view, not modify
  if (isCeoEmail(user.email) && req.method !== "GET") {
    return res.status(403).json({ error: "CEO has view-only access for this resource" });
  }

  next();
};
