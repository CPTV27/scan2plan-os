/**
 * Settings Storage Repository
 * 
 * Domain-specific repository for application settings.
 */

import { db } from "../db";
import { settings, type Setting } from "@shared/schema";
import { eq } from "drizzle-orm";

export class SettingsRepository {
  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async setSetting(key: string, value: unknown): Promise<Setting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings)
        .values({ key, value })
        .returning();
      return created;
    }
  }

  async updateSetting(key: string, value: unknown): Promise<Setting> {
    return this.setSetting(key, value);
  }

  async getSettingValue<T>(key: string): Promise<T | null> {
    const setting = await this.getSetting(key);
    return setting?.value as T ?? null;
  }
}

export const settingsRepo = new SettingsRepository();

export const settingsStorage = {
  getAll: (): Promise<Setting[]> => settingsRepo.getAllSettings(),
  get: (key: string): Promise<Setting | undefined> => settingsRepo.getSetting(key),
  set: (key: string, value: unknown): Promise<Setting> => settingsRepo.setSetting(key, value),
  update: (key: string, value: unknown): Promise<Setting> => settingsRepo.updateSetting(key, value),
  getValue: <T>(key: string): Promise<T | null> => settingsRepo.getSettingValue<T>(key),
};
