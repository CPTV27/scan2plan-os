/**
 * Knowledge Service
 * 
 * Central service for AI learning and memory management.
 * All agents access knowledge through this service to ensure consistency.
 */

import { db } from "../db";
import {
    aiResearchMemory,
    aiLearningLogs,
    aiFactCitations,
    type AIMemoryCategory,
    type AIMemorySource,
    type AgentType,
    type InsertAiResearchMemory,
    type AiResearchMemory,
} from "@shared/schema";
import { eq, and, gte, desc, sql, ilike, inArray } from "drizzle-orm";
import { log } from "../lib/logger";

// ChromaDB for semantic search (optional, graceful fallback)
let chromaCollection: any = null;

/**
 * Query parameters for retrieving facts
 */
export interface KnowledgeQuery {
    topic?: string;
    categories?: AIMemoryCategory[];
    minConfidence?: number;
    verified?: boolean;
    tags?: string[];
    limit?: number;
    excludeExpired?: boolean;
}

/**
 * A fact from the knowledge base
 */
export interface KnowledgeFact {
    id: number;
    topic: string;
    category: AIMemoryCategory;
    summary: string;
    details: Record<string, any> | null;
    confidence: number;
    source: AIMemorySource | null;
    isVerified: boolean;
    tags: string[];
    citationCount: number;
    lastUpdated: Date;
    expiresAt: Date | null;
}

/**
 * New fact to be learned
 */
export interface NewFact {
    topic: string;
    category: AIMemoryCategory;
    summary: string;
    details?: Record<string, any>;
    confidence?: number;
    tags?: string[];
    expiresAt?: Date;
    sourceUrl?: string;
    sourceId?: number;
}

/**
 * Learning source context
 */
export interface LearnSource {
    type: AIMemorySource;
    agent?: AgentType;
    interactionId?: number;
    reasoning?: string;
}

/**
 * Knowledge Service class
 */
class KnowledgeServiceImpl {

    /**
     * Get facts matching query criteria
     */
    async getFacts(query: KnowledgeQuery = {}): Promise<KnowledgeFact[]> {
        const {
            topic,
            categories,
            minConfidence = 0,
            verified,
            tags,
            limit = 20,
            excludeExpired = true,
        } = query;

        let baseQuery = db.select().from(aiResearchMemory);
        const conditions: any[] = [];

        if (topic) {
            conditions.push(ilike(aiResearchMemory.topic, `%${topic}%`));
        }

        if (categories && categories.length > 0) {
            conditions.push(inArray(aiResearchMemory.category, categories));
        }

        if (minConfidence > 0) {
            conditions.push(gte(aiResearchMemory.confidence, minConfidence));
        }

        if (verified !== undefined) {
            conditions.push(eq(aiResearchMemory.isVerified, verified));
        }

        if (excludeExpired) {
            conditions.push(
                sql`(${aiResearchMemory.expiresAt} IS NULL OR ${aiResearchMemory.expiresAt} > NOW())`
            );
        }

        const results = await db
            .select()
            .from(aiResearchMemory)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(aiResearchMemory.confidence), desc(aiResearchMemory.citationCount))
            .limit(limit);

        return results.map(this.toKnowledgeFact);
    }

    /**
     * Search knowledge semantically (text-based for now, ChromaDB integration later)
     */
    async searchKnowledge(text: string, limit: number = 10): Promise<KnowledgeFact[]> {
        // For now, use text search. Could be upgraded to vector search.
        const results = await db
            .select()
            .from(aiResearchMemory)
            .where(
                sql`(
                    ${aiResearchMemory.topic} ILIKE ${`%${text}%`} OR
                    ${aiResearchMemory.summary} ILIKE ${`%${text}%`}
                ) AND (
                    ${aiResearchMemory.expiresAt} IS NULL OR 
                    ${aiResearchMemory.expiresAt} > NOW()
                )`
            )
            .orderBy(desc(aiResearchMemory.confidence))
            .limit(limit);

        return results.map(this.toKnowledgeFact);
    }

    /**
     * Get facts for a specific category
     */
    async getFactsByCategory(
        category: AIMemoryCategory,
        limit: number = 10
    ): Promise<KnowledgeFact[]> {
        return this.getFacts({ categories: [category], limit });
    }

    /**
     * Store a new learned fact
     */
    async learnFact(fact: NewFact, source: LearnSource): Promise<number> {
        // Check if similar fact exists
        const existing = await db
            .select()
            .from(aiResearchMemory)
            .where(
                and(
                    eq(aiResearchMemory.topic, fact.topic),
                    eq(aiResearchMemory.category, fact.category)
                )
            )
            .limit(1);

        let memoryId: number;

        if (existing.length > 0) {
            // Update existing fact with higher confidence
            const existingFact = existing[0];
            const newConfidence = Math.min(100,
                Math.max(existingFact.confidence || 70, fact.confidence || 70) + 5
            );

            await db
                .update(aiResearchMemory)
                .set({
                    summary: fact.summary,
                    details: fact.details || existingFact.details,
                    confidence: newConfidence,
                    tags: fact.tags || existingFact.tags,
                    sourceType: source.type,
                    sourceUrl: fact.sourceUrl || existingFact.sourceUrl,
                    updatedAt: new Date(),
                })
                .where(eq(aiResearchMemory.id, existingFact.id));

            memoryId = existingFact.id;
            log(`[Knowledge] Updated existing fact: ${fact.topic} (confidence: ${newConfidence})`);
        } else {
            // Insert new fact
            const [inserted] = await db
                .insert(aiResearchMemory)
                .values({
                    topic: fact.topic,
                    category: fact.category,
                    summary: fact.summary,
                    details: fact.details,
                    confidence: fact.confidence || 70,
                    tags: fact.tags || [],
                    sourceType: source.type,
                    sourceUrl: fact.sourceUrl,
                    sourceId: fact.sourceId,
                    expiresAt: fact.expiresAt,
                })
                .returning();

            memoryId = inserted.id;
            log(`[Knowledge] Learned new fact: ${fact.topic}`);
        }

        // Log the learning event
        if (source.agent) {
            await db.insert(aiLearningLogs).values({
                agent: source.agent,
                interactionType: source.type,
                interactionId: source.interactionId,
                learnedFacts: [{
                    topic: fact.topic,
                    category: fact.category,
                    summary: fact.summary,
                    confidence: fact.confidence || 70,
                }],
                appliedToMemoryIds: [memoryId],
                reasoning: source.reasoning,
            });
        }

        return memoryId;
    }

    /**
     * Record when a fact is cited by an agent
     */
    async citeFact(
        factId: number,
        agent: AgentType,
        context?: string,
        outputId?: number
    ): Promise<void> {
        // Insert citation record
        await db.insert(aiFactCitations).values({
            memoryId: factId,
            agent,
            context,
            usedInOutputId: outputId,
        });

        // Update citation count and last cited time
        await db
            .update(aiResearchMemory)
            .set({
                citationCount: sql`${aiResearchMemory.citationCount} + 1`,
                lastCitedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(aiResearchMemory.id, factId));
    }

    /**
     * Mark citation as helpful or not (feedback loop)
     */
    async markCitationHelpful(
        citationId: number,
        helpful: boolean,
        feedback?: string
    ): Promise<void> {
        await db
            .update(aiFactCitations)
            .set({
                wasHelpful: helpful,
                feedback,
            })
            .where(eq(aiFactCitations.id, citationId));

        // If not helpful, consider reducing confidence
        if (!helpful) {
            const [citation] = await db
                .select()
                .from(aiFactCitations)
                .where(eq(aiFactCitations.id, citationId))
                .limit(1);

            if (citation) {
                await db
                    .update(aiResearchMemory)
                    .set({
                        confidence: sql`GREATEST(10, ${aiResearchMemory.confidence} - 5)`,
                        updatedAt: new Date(),
                    })
                    .where(eq(aiResearchMemory.id, citation.memoryId));
            }
        }
    }

    /**
     * Verify a fact (human confirmation)
     */
    async verifyFact(factId: number, verifiedBy: string): Promise<void> {
        await db
            .update(aiResearchMemory)
            .set({
                isVerified: true,
                verifiedBy,
                verifiedAt: new Date(),
                confidence: sql`LEAST(100, ${aiResearchMemory.confidence} + 20)`,
                updatedAt: new Date(),
            })
            .where(eq(aiResearchMemory.id, factId));

        log(`[Knowledge] Fact ${factId} verified by ${verifiedBy}`);
    }

    /**
     * Correct a fact (user correction)
     */
    async correctFact(
        factId: number,
        correction: string,
        correctedBy: string,
        newDetails?: Record<string, any>
    ): Promise<void> {
        const [existing] = await db
            .select()
            .from(aiResearchMemory)
            .where(eq(aiResearchMemory.id, factId))
            .limit(1);

        if (!existing) {
            throw new Error(`Fact ${factId} not found`);
        }

        await db
            .update(aiResearchMemory)
            .set({
                summary: correction,
                details: newDetails || existing.details,
                sourceType: "user_correction",
                isVerified: true,
                verifiedBy: correctedBy,
                verifiedAt: new Date(),
                confidence: 95, // User corrections are high confidence
                updatedAt: new Date(),
            })
            .where(eq(aiResearchMemory.id, factId));

        // Log the correction
        await db.insert(aiLearningLogs).values({
            agent: "auditor", // Corrections go through auditor conceptually
            interactionType: "user_correction",
            learnedFacts: [{
                topic: existing.topic,
                category: existing.category as AIMemoryCategory,
                summary: correction,
                confidence: 95,
            }],
            appliedToMemoryIds: [factId],
            reasoning: `Corrected by ${correctedBy}`,
        });

        log(`[Knowledge] Fact ${factId} corrected by ${correctedBy}`);
    }

    /**
     * Get knowledge context for agent prompts
     * Returns formatted string for injection into prompts
     */
    async getAgentContext(
        categories: AIMemoryCategory[],
        limit: number = 5
    ): Promise<string> {
        const facts = await this.getFacts({
            categories,
            minConfidence: 60,
            limit,
            excludeExpired: true,
        });

        if (facts.length === 0) {
            return "";
        }

        const lines = facts.map(f =>
            `- [${f.category}] ${f.summary} (confidence: ${f.confidence}%)`
        );

        return `LEARNED KNOWLEDGE:\n${lines.join("\n")}`;
    }

    /**
     * Convert DB record to KnowledgeFact
     */
    private toKnowledgeFact(record: AiResearchMemory): KnowledgeFact {
        return {
            id: record.id,
            topic: record.topic,
            category: record.category as AIMemoryCategory,
            summary: record.summary,
            details: record.details,
            confidence: record.confidence || 70,
            source: record.sourceType as AIMemorySource | null,
            isVerified: record.isVerified || false,
            tags: record.tags || [],
            citationCount: record.citationCount || 0,
            lastUpdated: record.updatedAt || new Date(),
            expiresAt: record.expiresAt,
        };
    }
}

// Export singleton
export const knowledgeService = new KnowledgeServiceImpl();

/**
 * Seed some initial knowledge for testing
 */
export async function seedInitialKnowledge(): Promise<number> {
    const initialFacts: NewFact[] = [
        {
            topic: "ll97_compliance",
            category: "regulation",
            summary: "NYC Local Law 97 requires buildings over 25,000 sqft to reduce emissions by 40% by 2030. As-built documentation helps establish baselines.",
            confidence: 95,
            tags: ["nyc", "emissions", "compliance", "ll97"],
        },
        {
            topic: "healthcare_night_scanning",
            category: "technique",
            summary: "Healthcare facilities typically require night scanning (7pm-6am) to avoid disrupting patient care. Budget 20-30% additional time.",
            confidence: 90,
            tags: ["healthcare", "scanning", "operations"],
        },
        {
            topic: "historic_premium",
            category: "pricing",
            summary: "Historic and landmark buildings typically command 15-25% pricing premium due to documentation requirements and preservation constraints.",
            confidence: 85,
            tags: ["historic", "pricing", "landmarks"],
        },
        {
            topic: "margin_floor",
            category: "pricing",
            summary: "Scan2Plan maintains a 40% gross margin floor. Deals below this threshold require CEO override approval.",
            confidence: 100,
            tags: ["pricing", "governance", "margin"],
        },
        {
            topic: "navvis_hospitals",
            category: "technique",
            summary: "NavVis VLX mobile scanning is preferred for hospitals due to speed and minimal disruption. Use Leica RTC360 for mechanical rooms.",
            confidence: 88,
            tags: ["equipment", "healthcare", "navvis", "leica"],
        },
    ];

    let seeded = 0;
    for (const fact of initialFacts) {
        try {
            await knowledgeService.learnFact(fact, {
                type: "manual_entry",
                reasoning: "Initial knowledge seeding",
            });
            seeded++;
        } catch (error) {
            log(`WARN: Failed to seed fact ${fact.topic}: ${error}`);
        }
    }

    log(`[Knowledge] Seeded ${seeded}/${initialFacts.length} initial facts`);
    return seeded;
}
