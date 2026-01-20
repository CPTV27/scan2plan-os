/**
 * Field Notes Storage Repository
 * 
 * Domain-specific repository for field note operations.
 */

import { db } from "../db";
import { fieldNotes, type FieldNote, type InsertFieldNote } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class FieldNoteRepository {
  async getFieldNotes(): Promise<FieldNote[]> {
    return await db.select().from(fieldNotes).orderBy(desc(fieldNotes.createdAt));
  }

  async getFieldNote(id: number): Promise<FieldNote | undefined> {
    const [note] = await db.select().from(fieldNotes).where(eq(fieldNotes.id, id));
    return note;
  }

  async createFieldNote(insertNote: InsertFieldNote): Promise<FieldNote> {
    const [note] = await db.insert(fieldNotes).values(insertNote).returning();
    return note;
  }

  async updateFieldNote(id: number, updates: Partial<FieldNote>): Promise<FieldNote> {
    const [updated] = await db.update(fieldNotes)
      .set(updates)
      .where(eq(fieldNotes.id, id))
      .returning();
    return updated;
  }
}

export const fieldNoteRepo = new FieldNoteRepository();

export const fieldNoteStorage = {
  getAll: (): Promise<FieldNote[]> => fieldNoteRepo.getFieldNotes(),
  getById: (id: number): Promise<FieldNote | undefined> => fieldNoteRepo.getFieldNote(id),
  create: (note: InsertFieldNote): Promise<FieldNote> => fieldNoteRepo.createFieldNote(note),
  update: (id: number, updates: Partial<FieldNote>): Promise<FieldNote> => fieldNoteRepo.updateFieldNote(id, updates),
};
