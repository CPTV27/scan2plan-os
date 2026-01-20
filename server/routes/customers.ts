import { Router } from "express";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { db } from "../db";
import { qbCustomers, leads, projects } from "@shared/schema";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

export const customersRouter = Router();

// GET /api/crm/customers - List with filtering
customersRouter.get(
    "/api/crm/customers",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        const query = (req.query.q as string) || "";
        const industry = req.query.industry as string;
        const status = req.query.status as string;
        const limit = Number(req.query.limit) || 50;
        const offset = Number(req.query.offset) || 0;

        let whereClause = undefined;
        const conditions = [];

        if (query) {
            conditions.push(or(
                ilike(qbCustomers.displayName, `%${query}%`),
                ilike(qbCustomers.companyName, `%${query}%`),
                ilike(qbCustomers.email, `%${query}%`)
            ));
        }
        if (industry) {
            conditions.push(eq(qbCustomers.industry, industry));
        }
        if (status) {
            conditions.push(eq(qbCustomers.marketingStatus, status));
        }

        if (conditions.length > 0) {
            whereClause = conditions.reduce((acc, condition) =>
                acc ? sql`${acc} AND ${condition}` : condition
            );
        }

        const customers = await db.select()
            .from(qbCustomers)
            .where(whereClause as any)
            .limit(limit)
            .offset(offset)
            .orderBy(desc(qbCustomers.balance), desc(qbCustomers.createdAt)); // High value first

        res.json({ customers });
    })
);

// GET /api/crm/customers/:id - Detail view
customersRouter.get(
    "/api/crm/customers/:id",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);

        // Get customer
        const customer = await db.query.qbCustomers.findFirst({
            where: eq(qbCustomers.id, id),
        });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // Get related leads (projects)
        // We link by qboCustomerId (which corresponds to qbCustomers.qbId)
        const relatedLeads = await db.select()
            .from(leads)
            .where(eq(leads.qboCustomerId, customer.qbId))
            .orderBy(desc(leads.createdAt));

        // Calculate generic stats
        const totalRevenue = relatedLeads
            .filter(l => l.dealStage === "Closed Won")
            .reduce((sum, l) => sum + Number(l.value || 0), 0);

        const activePipeline = relatedLeads
            .filter(l => ["Leads", "Contacted", "Proposal", "Negotiation"].includes(l.dealStage || ""))
            .reduce((sum, l) => sum + Number(l.value || 0), 0);

        res.json({
            customer,
            leads: relatedLeads,
            stats: {
                totalRevenue: totalRevenue.toFixed(2),
                activePipeline: activePipeline.toFixed(2),
                projectCount: relatedLeads.length
            }
        });
    })
);

const updateCustomerSchema = z.object({
    website: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    employeeCount: z.string().optional().nullable(),
    linkedinUrl: z.string().optional().nullable(),
    marketingStatus: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional().nullable(),
});

// PATCH /api/crm/customers/:id - Update details
customersRouter.patch(
    "/api/crm/customers/:id",
    isAuthenticated,
    requireRole("ceo", "sales", "marketing"),
    asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        const parsed = updateCustomerSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
        }

        const updated = await db.update(qbCustomers)
            .set({ ...parsed.data, syncedAt: new Date() }) // Update local sync timestamp even if manual edit
            .where(eq(qbCustomers.id, id))
            .returning();

        res.json(updated[0]);
    })
);
// POST /api/crm/customers/:id/enrich - AI Enrichment
customersRouter.post(
    "/api/crm/customers/:id/enrich",
    isAuthenticated,
    requireRole("ceo", "sales", "marketing"),
    asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);

        const customer = await db.query.qbCustomers.findFirst({
            where: eq(qbCustomers.id, id),
        });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        try {
            const { enrichCompanyData } = await import("../services/aiEnrichment");
            const enriched = await enrichCompanyData(customer.displayName, customer.website || undefined);

            const updated = await db.update(qbCustomers)
                .set({
                    industry: enriched.industry || customer.industry,
                    employeeCount: enriched.employeeCount || customer.employeeCount,
                    linkedinUrl: enriched.linkedinUrl || customer.linkedinUrl,
                    tags: enriched.tags || customer.tags,
                    notes: (customer.notes || "") + (enriched.notes ? `\n\n[AI]: ${enriched.notes}` : ""),
                    website: enriched.website || customer.website,
                    enrichmentData: enriched as any,
                    syncedAt: new Date(),
                })
                .where(eq(qbCustomers.id, id))
                .returning();

            res.json(updated[0]);
        } catch (error: any) {
            res.status(500).json({ message: "Enrichment failed: " + error.message });
        }
    })
);
