/**
 * Quote Storage Repository
 * 
 * Domain-specific repository for CPQ quotes, quote versions, and pricing matrices.
 * Contains the actual Drizzle ORM logic for quote operations.
 */

import { db } from "../db";
import {
  cpqQuotes, quoteVersions, cpqPricingMatrix, cpqUpteamPricingMatrix,
  cpqCadPricingMatrix, cpqPricingParameters, pandaDocDocuments,
  type CpqQuote, type InsertCpqQuote,
  type QuoteVersion, type InsertQuoteVersion,
  type CpqPricingMatrix, type CpqUpteamPricingMatrix, type CpqCadPricingMatrix, type CpqPricingParameter
} from "@shared/schema";
import { eq, desc, and, sql, max } from "drizzle-orm";

export class CpqQuoteRepository {
  async getCpqQuote(id: number): Promise<CpqQuote | undefined> {
    const [quote] = await db.select().from(cpqQuotes).where(eq(cpqQuotes.id, id));
    return quote;
  }

  async getCpqQuoteByToken(token: string): Promise<CpqQuote | undefined> {
    const [quote] = await db.select().from(cpqQuotes).where(eq(cpqQuotes.clientToken, token));
    return quote;
  }

  async getCpqQuoteByPandadocId(documentId: string): Promise<CpqQuote | undefined> {
    const [quote] = await db.select().from(cpqQuotes).where(eq(cpqQuotes.pandadocDocumentId, documentId));
    return quote;
  }

  async getCpqQuotesByLead(leadId: number): Promise<CpqQuote[]> {
    return await db.select().from(cpqQuotes)
      .where(eq(cpqQuotes.leadId, leadId))
      .orderBy(desc(cpqQuotes.versionNumber));
  }

  async getLatestCpqQuoteForLead(leadId: number): Promise<CpqQuote | undefined> {
    const [quote] = await db.select().from(cpqQuotes)
      .where(and(eq(cpqQuotes.leadId, leadId), eq(cpqQuotes.isLatest, true)))
      .limit(1);
    return quote;
  }

  async generateNextQuoteNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `S2P-${currentYear}-`;

    const quotesThisYear = await db.select({ qn: cpqQuotes.quoteNumber })
      .from(cpqQuotes)
      .where(sql`${cpqQuotes.quoteNumber} LIKE ${yearPrefix + '%'}`);

    let maxSeq = 0;
    for (const q of quotesThisYear) {
      if (q.qn) {
        const match = q.qn.match(/S2P-\d{4}-(\d{4})$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return `S2P-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
  }

  async createCpqQuote(insertQuote: InsertCpqQuote): Promise<CpqQuote> {
    let quoteNumber = insertQuote.quoteNumber;
    if (!quoteNumber) {
      quoteNumber = await this.generateNextQuoteNumber();
    }

    const providedVersionNumber = (insertQuote as any).versionNumber;
    let versionNumber = providedVersionNumber ?? 1;
    let shouldBeLatest = true;

    if (insertQuote.leadId) {
      const existingQuotes = await db.select().from(cpqQuotes)
        .where(eq(cpqQuotes.leadId, insertQuote.leadId));

      const maxVersion = Math.max(...existingQuotes.map(q => q.versionNumber), 0);

      if (providedVersionNumber === undefined || providedVersionNumber === null) {
        versionNumber = maxVersion + 1;
      }

      shouldBeLatest = maxVersion === 0 || versionNumber > maxVersion;

      if (shouldBeLatest && existingQuotes.length > 0) {
        await db.update(cpqQuotes)
          .set({ isLatest: false })
          .where(eq(cpqQuotes.leadId, insertQuote.leadId));
      }
    }

    const [quote] = await db.insert(cpqQuotes).values({
      ...insertQuote,
      quoteNumber,
      versionNumber,
      isLatest: shouldBeLatest,
    } as typeof cpqQuotes.$inferInsert).returning();
    return quote;
  }

  async updateCpqQuote(id: number, updates: Partial<InsertCpqQuote>): Promise<CpqQuote | undefined> {
    const [updated] = await db.update(cpqQuotes)
      .set({ ...updates, updatedAt: new Date() } as Partial<typeof cpqQuotes.$inferInsert>)
      .where(eq(cpqQuotes.id, id))
      .returning();
    return updated;
  }

  async deleteCpqQuote(id: number): Promise<void> {
    await db.delete(pandaDocDocuments).where(eq(pandaDocDocuments.cpqQuoteId, id));
    await db.delete(cpqQuotes).where(eq(cpqQuotes.id, id));
  }

  async createCpqQuoteVersion(sourceQuoteId: number, versionName: string | undefined, createdBy: string): Promise<CpqQuote> {
    const sourceQuote = await this.getCpqQuote(sourceQuoteId);
    if (!sourceQuote) {
      throw new Error("Source quote not found");
    }

    const rootId = sourceQuote.parentQuoteId || sourceQuote.id;

    const existingVersions = await db.select().from(cpqQuotes)
      .where(sql`${cpqQuotes.id} = ${rootId} OR ${cpqQuotes.parentQuoteId} = ${rootId}`);
    const maxVersion = Math.max(...existingVersions.map(v => v.versionNumber), 0);
    const newVersionNumber = maxVersion + 1;

    const quoteNumber = await this.generateNextQuoteNumber();

    const { id, quoteNumber: _qn, createdAt, updatedAt, versionNumber, versionName: _vn, parentQuoteId: _pid, ...quoteData } = sourceQuote;

    const [newVersion] = await db.insert(cpqQuotes).values({
      ...quoteData,
      quoteNumber,
      parentQuoteId: rootId,
      versionNumber: newVersionNumber,
      versionName: versionName || `Version ${newVersionNumber}`,
      createdBy,
    }).returning();

    return newVersion;
  }
}

export class QuoteVersionRepository {
  async getQuoteVersions(leadId: number): Promise<QuoteVersion[]> {
    return await db.select().from(quoteVersions)
      .where(eq(quoteVersions.leadId, leadId))
      .orderBy(desc(quoteVersions.versionNumber));
  }

  async getQuoteVersion(id: number): Promise<QuoteVersion | undefined> {
    const [version] = await db.select().from(quoteVersions).where(eq(quoteVersions.id, id));
    return version;
  }

  async createQuoteVersion(insertVersion: InsertQuoteVersion): Promise<QuoteVersion> {
    const [version] = await db.insert(quoteVersions).values(insertVersion).returning();
    return version;
  }

  async updateQuoteVersion(id: number, updates: Partial<QuoteVersion>): Promise<QuoteVersion> {
    const [updated] = await db.update(quoteVersions).set(updates).where(eq(quoteVersions.id, id)).returning();
    return updated;
  }

  async getNextVersionNumber(leadId: number): Promise<number> {
    const result = await db.select({ maxVersion: max(quoteVersions.versionNumber) })
      .from(quoteVersions)
      .where(eq(quoteVersions.leadId, leadId));
    return (result[0]?.maxVersion ?? 0) + 1;
  }
}

export class CpqPricingRepository {
  async getCpqPricingMatrix(): Promise<CpqPricingMatrix[]> {
    return await db.select().from(cpqPricingMatrix);
  }

  async getCpqUpteamPricingMatrix(): Promise<CpqUpteamPricingMatrix[]> {
    return await db.select().from(cpqUpteamPricingMatrix);
  }

  async getCpqCadPricingMatrix(): Promise<CpqCadPricingMatrix[]> {
    return await db.select().from(cpqCadPricingMatrix);
  }

  async getCpqPricingParameters(): Promise<CpqPricingParameter[]> {
    return await db.select().from(cpqPricingParameters);
  }
}

export const cpqQuoteRepo = new CpqQuoteRepository();
export const quoteVersionRepo = new QuoteVersionRepository();
export const cpqPricingRepo = new CpqPricingRepository();

export const cpqQuoteStorage = {
  getById: (id: number): Promise<CpqQuote | undefined> => cpqQuoteRepo.getCpqQuote(id),
  getByToken: (token: string): Promise<CpqQuote | undefined> => cpqQuoteRepo.getCpqQuoteByToken(token),
  getByPandadocId: (documentId: string): Promise<CpqQuote | undefined> => cpqQuoteRepo.getCpqQuoteByPandadocId(documentId),
  getByLeadId: (leadId: number): Promise<CpqQuote[]> => cpqQuoteRepo.getCpqQuotesByLead(leadId),
  getLatestForLead: (leadId: number): Promise<CpqQuote | undefined> => cpqQuoteRepo.getLatestCpqQuoteForLead(leadId),
  create: (quote: InsertCpqQuote): Promise<CpqQuote> => cpqQuoteRepo.createCpqQuote(quote),
  update: (id: number, updates: Partial<InsertCpqQuote>): Promise<CpqQuote | undefined> => cpqQuoteRepo.updateCpqQuote(id, updates),
  delete: (id: number): Promise<void> => cpqQuoteRepo.deleteCpqQuote(id),
  createVersion: (sourceQuoteId: number, versionName: string | undefined, createdBy: string): Promise<CpqQuote> =>
    cpqQuoteRepo.createCpqQuoteVersion(sourceQuoteId, versionName, createdBy),
};

export const quoteVersionStorage = {
  getByLeadId: (leadId: number): Promise<QuoteVersion[]> => quoteVersionRepo.getQuoteVersions(leadId),
  getById: (id: number): Promise<QuoteVersion | undefined> => quoteVersionRepo.getQuoteVersion(id),
  create: (version: InsertQuoteVersion): Promise<QuoteVersion> => quoteVersionRepo.createQuoteVersion(version),
  update: (id: number, updates: Partial<QuoteVersion>): Promise<QuoteVersion> => quoteVersionRepo.updateQuoteVersion(id, updates),
  getNextVersionNumber: (leadId: number): Promise<number> => quoteVersionRepo.getNextVersionNumber(leadId),
};

export const cpqPricingStorage = {
  getMatrix: (): Promise<CpqPricingMatrix[]> => cpqPricingRepo.getCpqPricingMatrix(),
  getUpteamMatrix: (): Promise<CpqUpteamPricingMatrix[]> => cpqPricingRepo.getCpqUpteamPricingMatrix(),
  getCadMatrix: (): Promise<CpqCadPricingMatrix[]> => cpqPricingRepo.getCpqCadPricingMatrix(),
  getParameters: (): Promise<CpqPricingParameter[]> => cpqPricingRepo.getCpqPricingParameters(),
};
