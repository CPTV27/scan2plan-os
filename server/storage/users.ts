/**
 * Users Storage Repository
 * 
 * Domain-specific repository for user management operations.
 */

import { db } from "../db";
import { users, type User, type UserRole } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class UserRepository {
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
}

export const userRepo = new UserRepository();

export const userStorage = {
  getAll: (): Promise<User[]> => userRepo.getAllUsers(),
  updateRole: (userId: string, role: UserRole): Promise<User | undefined> => userRepo.updateUserRole(userId, role),
};
