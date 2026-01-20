import { type Quote, type InsertQuote, quotes, pricingMatrix, upteamPricingMatrix, pricingParameters, cadPricingMatrix } from "@shared/schema";
import { quickbooksTokens } from "@shared/schema"; // Imported from index (which gets it from db.ts)
import { db } from "../db";
import { eq, desc, and, type InferSelectModel } from "drizzle-orm";

type QuickBooksTokens = InferSelectModel<typeof quickbooksTokens>;

export interface ICpqStorage {
    // Quote CRUD operations
    createQuote(quote: InsertQuote): Promise<Quote>;
    getQuote(id: string): Promise<Quote | undefined>;
    getAllQuotes(): Promise<Quote[]>;
    getQuotesByLeadId(leadId: number): Promise<Quote[]>;
    updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
    deleteQuote(id: string): Promise<boolean>;

    // Quote version operations
    getQuoteVersions(quoteId: string): Promise<Quote[]>;
    createQuoteVersion(sourceQuoteId: string, versionName?: string): Promise<Quote>;

    // Pricing matrix operations
    getAllPricingRates(): Promise<any[]>;
    getPricingRate(buildingTypeId: number, areaTier: string, discipline: string, lod: string): Promise<any | undefined>;
    updatePricingRate(id: number, ratePerSqFt: string): Promise<any | undefined>;

    // Upteam pricing matrix operations
    getAllUpteamPricingRates(): Promise<any[]>;
    getUpteamPricingRate(buildingTypeId: number, areaTier: string, discipline: string, lod: string): Promise<any | undefined>;
    updateUpteamPricingRate(id: number, ratePerSqFt: string): Promise<any | undefined>;

    // Pricing parameters operations
    getAllPricingParameters(): Promise<any[]>;
    updatePricingParameter(id: number, parameterValue: string): Promise<any | undefined>;

    // CAD pricing matrix operations
    getAllCadPricingRates(): Promise<any[]>;
    getCadPricingRate(areaTier: string, packageType: string): Promise<any | undefined>;

    // QuickBooks tokens operations
    getQuickBooksTokens(): Promise<any | undefined>; // specific return type matched to OS schema
    saveQuickBooksTokens(tokens: any): Promise<any>;
    deleteQuickBooksTokens(): Promise<boolean>;
}

export class CpqDbStorage implements ICpqStorage {
    // Quote methods
    async createQuote(quote: InsertQuote): Promise<Quote> {
        const quoteNumber = `Q${Date.now()}`;
        // InsertQuote might expect strings for decimals, handled by zod schema usually
        const [newQuote] = await db.insert(quotes).values({
            ...quote,
            quoteNumber,
        }).returning();
        return newQuote!;
    }

    async getQuote(id: string): Promise<Quote | undefined> {
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
        return quote;
    }

    async getAllQuotes(): Promise<Quote[]> {
        return db.select().from(quotes).orderBy(desc(quotes.createdAt));
    }

    async getQuotesByLeadId(leadId: number): Promise<Quote[]> {
        return db.select().from(quotes).where(eq(quotes.leadId, leadId)).orderBy(desc(quotes.createdAt));
    }

    async updateQuote(id: string, quoteData: Partial<InsertQuote>): Promise<Quote | undefined> {
        const [updatedQuote] = await db
            .update(quotes)
            .set({
                ...quoteData,
                updatedAt: new Date(),
            })
            .where(eq(quotes.id, id))
            .returning();
        return updatedQuote;
    }

    async deleteQuote(id: string): Promise<boolean> {
        const result = await db.delete(quotes).where(eq(quotes.id, id)).returning();
        return result.length > 0;
    }

    // Quote version methods
    async getQuoteVersions(quoteId: string): Promise<Quote[]> {
        // First get the quote to determine if it's a parent or child
        const quote = await this.getQuote(quoteId);
        if (!quote) return [];

        // Determine the root parent ID
        const rootId = quote.parentQuoteId || quote.id;

        // Get the root quote
        const rootQuote = await db
            .select()
            .from(quotes)
            .where(eq(quotes.id, rootId));

        // Get all child versions
        const children = await db
            .select()
            .from(quotes)
            .where(eq(quotes.parentQuoteId, rootId));

        // Combine root and children, then sort by version number
        const allVersions = [...rootQuote, ...children];
        return allVersions.sort((a, b) => a.versionNumber - b.versionNumber);
    }

    async createQuoteVersion(sourceQuoteId: string, versionName?: string): Promise<Quote> {
        // Get the source quote
        const sourceQuote = await this.getQuote(sourceQuoteId);
        if (!sourceQuote) {
            throw new Error("Source quote not found");
        }

        // Determine the root parent ID
        const rootId = sourceQuote.parentQuoteId || sourceQuote.id;

        // Get all existing versions to determine the next version number
        const existingVersions = await this.getQuoteVersions(sourceQuoteId);
        const maxVersion = Math.max(...existingVersions.map(v => v.versionNumber));
        const newVersionNumber = maxVersion + 1;

        // Generate new quote number
        const quoteNumber = `Q${Date.now()}`;

        // Create the new version by copying all data from source
        // Omit fields that should be new
        const { id, quoteNumber: _qn, createdAt, updatedAt, versionNumber, versionName: _vn, parentQuoteId: _pid, ...quoteData } = sourceQuote;

        const [newVersion] = await db.insert(quotes).values({
            ...quoteData as any, // Cast to any to avoid strict type checks on partial copy
            quoteNumber,
            parentQuoteId: rootId,
            versionNumber: newVersionNumber,
            versionName: versionName || `Version ${newVersionNumber}`,
        }).returning();

        return newVersion!;
    }

    // Pricing matrix methods
    async getAllPricingRates(): Promise<any[]> {
        return db.select().from(pricingMatrix);
    }

    async getPricingRate(buildingTypeId: number, areaTier: string, discipline: string, lod: string): Promise<any | undefined> {
        const [rate] = await db
            .select()
            .from(pricingMatrix)
            .where(
                and(
                    eq(pricingMatrix.buildingTypeId, buildingTypeId),
                    eq(pricingMatrix.areaTier, areaTier),
                    eq(pricingMatrix.discipline, discipline),
                    eq(pricingMatrix.lod, lod)
                )
            )
            .limit(1);
        return rate;
    }

    async updatePricingRate(id: number, ratePerSqFt: string): Promise<any | undefined> {
        const [updated] = await db
            .update(pricingMatrix)
            .set({
                ratePerSqFt,
                updatedAt: new Date(),
            })
            .where(eq(pricingMatrix.id, id))
            .returning();
        return updated;
    }

    // Upteam pricing matrix methods
    async getAllUpteamPricingRates(): Promise<any[]> {
        return db.select().from(upteamPricingMatrix);
    }

    async getUpteamPricingRate(buildingTypeId: number, areaTier: string, discipline: string, lod: string): Promise<any | undefined> {
        const [rate] = await db
            .select()
            .from(upteamPricingMatrix)
            .where(
                and(
                    eq(upteamPricingMatrix.buildingTypeId, buildingTypeId),
                    eq(upteamPricingMatrix.areaTier, areaTier),
                    eq(upteamPricingMatrix.discipline, discipline),
                    eq(upteamPricingMatrix.lod, lod)
                )
            )
            .limit(1);
        return rate;
    }

    async updateUpteamPricingRate(id: number, ratePerSqFt: string): Promise<any | undefined> {
        const [updated] = await db
            .update(upteamPricingMatrix)
            .set({
                ratePerSqFt,
                updatedAt: new Date(),
            })
            .where(eq(upteamPricingMatrix.id, id))
            .returning();
        return updated;
    }

    // Pricing parameters methods
    async getAllPricingParameters(): Promise<any[]> {
        return db.select().from(pricingParameters);
    }

    async updatePricingParameter(id: number, parameterValue: string): Promise<any | undefined> {
        // parameterValue is text in schema
        const [updated] = await db
            .update(pricingParameters)
            .set({
                parameterValue,
                updatedAt: new Date(),
            })
            .where(eq(pricingParameters.id, id))
            .returning();
        return updated;
    }

    // CAD pricing matrix methods
    async getAllCadPricingRates(): Promise<any[]> {
        return db.select().from(cadPricingMatrix);
    }

    async getCadPricingRate(areaTier: string, packageType: string): Promise<any | undefined> {
        const [rate] = await db
            .select()
            .from(cadPricingMatrix)
            .where(
                and(
                    eq(cadPricingMatrix.areaTier, areaTier),
                    eq(cadPricingMatrix.packageType, packageType)
                )
            )
            .limit(1);
        return rate;
    }

    // QuickBooks tokens methods
    async getQuickBooksTokens(): Promise<any | undefined> {
        // Get the most recent tokens (single-tenant for now)
        const [tokens] = await db
            .select()
            .from(quickbooksTokens)
            .orderBy(desc(quickbooksTokens.updatedAt))
            .limit(1);

        if (tokens) {
            // Map OS fields to CPQ expected fields
            return {
                ...tokens,
                accessTokenExpiresAt: tokens.expiresAt,
                refreshTokenExpiresAt: tokens.refreshExpiresAt
            };
        }
        return undefined;
    }

    async saveQuickBooksTokens(tokens: any): Promise<any> {
        // Map CPQ input fields to OS schema fields
        const mappedTokens = {
            realmId: tokens.realmId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.accessTokenExpiresAt,
            refreshExpiresAt: tokens.refreshTokenExpiresAt,
        };

        // Upsert: update if realmId exists, otherwise insert
        const existing = await db
            .select()
            .from(quickbooksTokens)
            .where(eq(quickbooksTokens.realmId, tokens.realmId))
            .limit(1);

        let saved;
        if (existing.length > 0) {
            const [updated] = await db
                .update(quickbooksTokens)
                .set({
                    ...mappedTokens,
                    updatedAt: new Date(),
                })
                .where(eq(quickbooksTokens.realmId, tokens.realmId))
                .returning();
            saved = updated;
        } else {
            const [inserted] = await db
                .insert(quickbooksTokens)
                .values(mappedTokens)
                .returning();
            saved = inserted;
        }

        if (saved) {
            // Map back to CPQ format for return
            return {
                ...saved,
                accessTokenExpiresAt: saved.expiresAt,
                refreshTokenExpiresAt: saved.refreshExpiresAt
            };
        }
        return saved;
    }

    async deleteQuickBooksTokens(): Promise<boolean> {
        const result = await db.delete(quickbooksTokens).returning();
        return result.length > 0;
    }
}

export const cpqStorage = new CpqDbStorage();
