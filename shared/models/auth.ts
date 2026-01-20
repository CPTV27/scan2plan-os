import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";

// User role enum for role-based access control
export const userRoleEnum = pgEnum("user_role", ["ceo", "sales", "production", "accounting", "marketing"]);

// Valid roles as a type for use throughout the app
export type UserRole = "ceo" | "sales" | "production" | "accounting" | "marketing";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default("ceo").notNull(), // ceo has full access by default
  scantecHome: varchar("scantec_home"), // Technician's home/base address for "Go Home" navigation
  passwordHash: varchar("password_hash"), // Hashed password for additional security
  passwordSetAt: timestamp("password_set_at"), // When password was last set
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Login attempts table for rate limiting
export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  success: varchar("success").notNull(), // 'true' or 'false'
  ipAddress: varchar("ip_address"),
  attemptedAt: timestamp("attempted_at").defaultNow(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
