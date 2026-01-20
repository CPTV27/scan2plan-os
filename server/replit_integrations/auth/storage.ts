import { users, loginAttempts, type User, type UpsertUser, type InsertLoginAttempt } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, gte, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Allowed email domain for access
const ALLOWED_EMAIL_DOMAIN = "scan2plan.io";

// Rate limiting config
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Interface for auth storage operations
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  setPassword(userId: string, password: string): Promise<boolean>;
  verifyPassword(userId: string, password: string): Promise<boolean>;
  hasPassword(userId: string): Promise<boolean>;
  isEmailDomainAllowed(email: string): boolean;
  recordLoginAttempt(userId: string, success: boolean, ipAddress?: string): Promise<void>;
  isUserLockedOut(userId: string): Promise<boolean>;
  getRecentFailedAttempts(userId: string): Promise<number>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async setPassword(userId: string, password: string): Promise<boolean> {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        passwordSetAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    return !!updated;
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user?.passwordHash) return false;

    return bcrypt.compare(password, user.passwordHash);
  }

  async hasPassword(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return !!user?.passwordHash;
  }

  isEmailDomainAllowed(email: string): boolean {
    if (!email) return false;
    const domain = email.split("@")[1]?.toLowerCase();
    return domain === ALLOWED_EMAIL_DOMAIN;
  }

  async recordLoginAttempt(userId: string, success: boolean, ipAddress?: string): Promise<void> {
    await db.insert(loginAttempts).values({
      userId,
      success: success ? 'true' : 'false',
      ipAddress: ipAddress || null,
    });
  }

  async isUserLockedOut(userId: string): Promise<boolean> {
    const failedAttempts = await this.getRecentFailedAttempts(userId);
    return failedAttempts >= MAX_FAILED_ATTEMPTS;
  }

  async getRecentFailedAttempts(userId: string): Promise<number> {
    const lockoutWindow = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000);

    const attempts = await db
      .select()
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.userId, userId),
          eq(loginAttempts.success, 'false'),
          gte(loginAttempts.attemptedAt, lockoutWindow)
        )
      );

    return attempts.length;
  }
}

export const authStorage = new AuthStorage();
