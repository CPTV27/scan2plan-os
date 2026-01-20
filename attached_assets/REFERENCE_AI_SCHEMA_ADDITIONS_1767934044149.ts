// Example Schema Updates for AI Features
// Add these to shared/schema.ts

import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

// Add to existing leads table (in schema.ts around line 534):
/*
  // AI Features - add these fields to the leads table definition
  aiScopingSuggestions: jsonb("ai_scoping_suggestions"),
  aiScopingAccepted: boolean("ai_scoping_accepted").default(false),
  aiScopingModified: jsonb("ai_scoping_modified"),
  sourceDocument: jsonb("source_document"),
  extractedRequirements: jsonb("extracted_requirements"),
  riskFlags: jsonb("risk_flags"),
  aiIntelligence: jsonb("ai_intelligence"),
  aiIntelligenceUpdatedAt: timestamp("ai_intelligence_updated_at"),
  aiGeneratedProposal: jsonb("ai_generated_proposal"),
  proposalGeneratedAt: timestamp("proposal_generated_at"),
  proposalTemplate: text("proposal_template"),
  proposalConverted: boolean("proposal_converted").default(false),
*/

// New table: Deal Predictions (for tracking AI accuracy)
export const dealPredictions = pgTable("deal_predictions", {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull(),
    predictedProbability: integer("predicted_probability").notNull(),
    predictedOutcome: text("predicted_outcome"), // "won" | "lost"
    actualOutcome: text("actual_outcome"),
    predictionFactors: jsonb("prediction_factors"), // What influenced prediction
    predictionDate: timestamp("prediction_date").defaultNow(),
    outcomeDate: timestamp("outcome_date"),
});

// New table: CPQ Conversations (for natural language interface)
export const cpqConversations = pgTable("cpq_conversations", {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id"),
    userId: text("user_id").notNull(),
    messages: jsonb("messages").notNull(), // Array of {role, content, timestamp}
    extractedData: jsonb("extracted_data"), // CPQ fields gathered so far
    quoteId: integer("quote_id"), // Reference if quote was created
    status: text("status").default("active"), // "active" | "converted" | "abandoned"
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// New table: Project Embeddings (for semantic search/matching)
export const projectEmbeddings = pgTable("project_embeddings", {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull(),
    embedding: jsonb("embedding").notNull(), // Vector as JSON array
    projectSummary: text("project_summary").notNull(), // Text that was embedded
    metadata: jsonb("metadata"), // Building type, sqft, etc. for filtering
    updatedAt: timestamp("updated_at").defaultNow(),
});

// New table: AI Analytics (track feature usage and performance)
export const aiAnalytics = pgTable("ai_analytics", {
    id: serial("id").primaryKey(),
    feature: text("feature").notNull(), // 'scoping' | 'document' | 'intelligence' | 'proposal' | 'nlp_cpq' | 'matching'
    userId: text("user_id"),
    leadId: integer("lead_id"),
    action: text("action").notNull(), // 'generated' | 'accepted' | 'rejected' | 'modified'
    timeTaken: integer("time_taken_ms"), // How long AI took
    confidence: integer("confidence"), // AI confidence score if applicable
    metadata: jsonb("metadata"), // Feature-specific data
    createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for AI features
import { z } from "zod";

export const scopingSuggestionSchema = z.object({
    field: z.string(),
    value: z.any(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string(),
});

export const scopingAnalysisSchema = z.object({
    suggestions: z.array(scopingSuggestionSchema),
    buildingType: z.string(),
    estimatedSqft: z.number(),
    recommendedLOD: z.enum(["200", "300", "350"]),
    disciplines: z.array(z.string()),
    riskFactors: z.array(z.string()),
    timeline: z.string(),
    overallConfidence: z.number().min(0).max(100),
});

export const dealIntelligenceSchema = z.object({
    winProbability: z.number().min(0).max(100),
    nextActions: z.array(z.string()),
    riskFactors: z.array(z.object({
        factor: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        description: z.string(),
    })),
    pricingStrategy: z.object({
        recommendedPrice: z.number(),
        priceRange: z.object({ min: z.number(), max: z.number() }),
        reasoning: z.string(),
    }),
    similarDeals: z.array(z.object({
        leadId: z.number(),
        clientName: z.string(),
        value: z.number(),
        outcome: z.string(),
        similarity: z.number(),
    })),
    expectedTimeline: z.string(),
});

export const cpqConversationMessageSchema = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    timestamp: z.string(),
});

export const proposalContentSchema = z.object({
    executiveSummary: z.string(),
    scopeOfWork: z.string(),
    deliverables: z.string(),
    timeline: z.string(),
    pricing: z.string(),
    caseStudies: z.string(),
    teamQualifications: z.string(),
    riskMitigation: z.string(),
    metadata: z.object({
        generatedAt: z.string(),
        template: z.string(),
        persona: z.string().optional(),
        wordCount: z.number(),
    }),
});

// Type exports
export type ScopingSuggestion = z.infer<typeof scopingSuggestionSchema>;
export type ScopingAnalysis = z.infer<typeof scopingAnalysisSchema>;
export type DealIntelligence = z.infer<typeof dealIntelligenceSchema>;
export type CPQConversationMessage = z.infer<typeof cpqConversationMessageSchema>;
export type ProposalContent = z.infer<typeof proposalContentSchema>;
