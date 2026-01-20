/**
 * Scantechs Storage Repository
 * 
 * Domain-specific repository for ScanTech (Field Technician) operations.
 */

import { db } from "../db";
import { scantechs, type Scantech, type InsertScantech } from "@shared/schema";
import { eq } from "drizzle-orm";

export class ScantechRepository {
  async getScantechs(): Promise<Scantech[]> {
    return await db.select().from(scantechs).orderBy(scantechs.name);
  }

  async getScantech(id: number): Promise<Scantech | undefined> {
    const [scantech] = await db.select().from(scantechs).where(eq(scantechs.id, id));
    return scantech;
  }

  async createScantech(insertScantech: InsertScantech): Promise<Scantech> {
    const [scantech] = await db.insert(scantechs).values(insertScantech).returning();
    return scantech;
  }

  async updateScantech(id: number, updates: Partial<InsertScantech>): Promise<Scantech> {
    const [updated] = await db.update(scantechs).set(updates).where(eq(scantechs.id, id)).returning();
    return updated;
  }
}

export const scantechRepo = new ScantechRepository();

export const scantechStorage = {
  getAll: (): Promise<Scantech[]> => scantechRepo.getScantechs(),
  getById: (id: number): Promise<Scantech | undefined> => scantechRepo.getScantech(id),
  create: (scantech: InsertScantech): Promise<Scantech> => scantechRepo.createScantech(scantech),
  update: (id: number, updates: Partial<InsertScantech>): Promise<Scantech> => scantechRepo.updateScantech(id, updates),
};
