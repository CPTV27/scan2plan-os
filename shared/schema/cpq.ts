import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Pricing reference tables
export const pricingMatrix = pgTable("pricing_matrix", {
    id: integer("id").primaryKey(),
    buildingTypeId: integer("building_type_id").notNull(),
    areaTier: text("area_tier").notNull(),
    discipline: text("discipline").notNull(),
    lod: text("lod").notNull(),
    ratePerSqFt: decimal("rate_per_sq_ft", { precision: 10, scale: 4 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const upteamPricingMatrix = pgTable("upteam_pricing_matrix", {
    id: serial("id").primaryKey(),
    buildingTypeId: integer("building_type_id").notNull(),
    areaTier: text("area_tier").notNull(),
    discipline: text("discipline").notNull(),
    lod: text("lod").notNull(),
    ratePerSqFt: decimal("rate_per_sq_ft", { precision: 10, scale: 4 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const cadPricingMatrix = pgTable("cad_pricing_matrix", {
    id: integer("id").primaryKey(),
    buildingTypeId: integer("building_type_id").notNull(),
    areaTier: text("area_tier").notNull(),
    packageType: text("package_type").notNull(),
    ratePerSqFt: decimal("rate_per_sq_ft", { precision: 10, scale: 4 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const pricingParameters = pgTable("pricing_parameters", {
    id: integer("id").primaryKey(),
    parameterKey: text("parameter_key").notNull().unique(),
    parameterValue: text("parameter_value").notNull(),
    parameterType: text("parameter_type").notNull(),
    description: text("description"),
    category: text("category"),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// Main quotes/projects table
export const quotes = pgTable("quotes", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quoteNumber: text("quote_number").notNull().unique(),

    // Project details
    clientName: text("client_name"),
    projectName: text("project_name").notNull(),
    projectAddress: text("project_address").notNull(),
    specificBuilding: text("specific_building"),
    typeOfBuilding: text("type_of_building").notNull(),
    hasBasement: boolean("has_basement").default(false),
    hasAttic: boolean("has_attic").default(false),
    notes: text("notes"),
    leadId: integer("lead_id"),

    // Mode
    scopingMode: boolean("scoping_mode").default(false).notNull(),

    // Areas (stored as JSON)
    areas: jsonb("areas").notNull(),

    // Risk factors
    risks: jsonb("risks").default('[]').notNull(),

    // Travel
    dispatchLocation: text("dispatch_location").notNull(),
    distance: integer("distance"),
    customTravelCost: decimal("custom_travel_cost", { precision: 12, scale: 2 }),

    // Additional services
    services: jsonb("services").default('{}').notNull(),

    // Scoping data (only if scoping mode enabled)
    scopingData: jsonb("scoping_data"),

    // Calculated pricing
    totalPrice: decimal("total_price", { precision: 12, scale: 2 }),
    pricingBreakdown: jsonb("pricing_breakdown"),

    // Version control
    parentQuoteId: varchar("parent_quote_id"),
    versionNumber: integer("version_number").default(1).notNull(),
    versionName: text("version_name"),

    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
    id: true,
    quoteNumber: true,
    createdAt: true,
    updatedAt: true,
});

export const updateQuoteSchema = insertQuoteSchema.partial();

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;
