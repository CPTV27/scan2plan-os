/**
 * Proposal Templates API Routes
 * 
 * CRUD operations for proposal templates and template groups.
 * Used by the Proposal Assembler feature.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { proposalTemplates, proposalTemplateGroups, generatedProposals, insertProposalTemplateSchema, insertProposalTemplateGroupSchema, insertGeneratedProposalSchema } from "@shared/schema";
import { eq, desc, and, asc } from "drizzle-orm";

export const proposalTemplatesRouter = Router();

// ===========================
// TEMPLATE ROUTES
// ===========================

// GET all templates
proposalTemplatesRouter.get("/", async (req: Request, res: Response) => {
    try {
        const templates = await db
            .select()
            .from(proposalTemplates)
            .where(eq(proposalTemplates.isActive, true))
            .orderBy(asc(proposalTemplates.category), asc(proposalTemplates.sortOrder));

        res.json(templates);
    } catch (error) {
        console.error("Failed to fetch templates:", error);
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// GET templates grouped by category (for dropdown menus)
proposalTemplatesRouter.get("/grouped", async (req: Request, res: Response) => {
    try {
        const templates = await db
            .select()
            .from(proposalTemplates)
            .where(eq(proposalTemplates.isActive, true))
            .orderBy(asc(proposalTemplates.category), asc(proposalTemplates.sortOrder));

        // Group templates by category
        const grouped: Record<string, typeof templates> = {};
        for (const template of templates) {
            const cat = template.category || "other";
            if (!grouped[cat]) {
                grouped[cat] = [];
            }
            grouped[cat].push(template);
        }

        res.json(grouped);
    } catch (error) {
        console.error("Failed to fetch grouped templates:", error);
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// GET templates by category
proposalTemplatesRouter.get("/category/:category", async (req: Request, res: Response) => {
    try {
        const { category } = req.params;
        const templates = await db
            .select()
            .from(proposalTemplates)
            .where(and(
                eq(proposalTemplates.category, category),
                eq(proposalTemplates.isActive, true)
            ))
            .orderBy(asc(proposalTemplates.sortOrder));

        res.json(templates);
    } catch (error) {
        console.error("Failed to fetch templates by category:", error);
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// GET single template by ID
proposalTemplatesRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const [template] = await db
            .select()
            .from(proposalTemplates)
            .where(eq(proposalTemplates.id, id));

        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }

        res.json(template);
    } catch (error) {
        console.error("Failed to fetch template:", error);
        res.status(500).json({ error: "Failed to fetch template" });
    }
});

// CREATE new template
proposalTemplatesRouter.post("/", async (req: Request, res: Response) => {
    try {
        const parsed = insertProposalTemplateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid template data", details: parsed.error.errors });
        }

        const [template] = await db
            .insert(proposalTemplates)
            .values(parsed.data)
            .returning();

        res.status(201).json(template);
    } catch (error) {
        console.error("Failed to create template:", error);
        res.status(500).json({ error: "Failed to create template" });
    }
});

// UPDATE template
proposalTemplatesRouter.patch("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const [template] = await db
            .update(proposalTemplates)
            .set({
                ...req.body,
                updatedAt: new Date(),
            })
            .where(eq(proposalTemplates.id, id))
            .returning();

        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }

        res.json(template);
    } catch (error) {
        console.error("Failed to update template:", error);
        res.status(500).json({ error: "Failed to update template" });
    }
});

// DELETE template (soft delete)
proposalTemplatesRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const [template] = await db
            .update(proposalTemplates)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(proposalTemplates.id, id))
            .returning();

        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Failed to delete template:", error);
        res.status(500).json({ error: "Failed to delete template" });
    }
});

// ===========================
// TEMPLATE GROUP ROUTES
// ===========================

export const proposalTemplateGroupsRouter = Router();

// GET all template groups
proposalTemplateGroupsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const groups = await db
            .select()
            .from(proposalTemplateGroups)
            .where(eq(proposalTemplateGroups.isActive, true))
            .orderBy(asc(proposalTemplateGroups.name));

        res.json(groups);
    } catch (error) {
        console.error("Failed to fetch template groups:", error);
        res.status(500).json({ error: "Failed to fetch template groups" });
    }
});

// GET single template group with expanded templates
proposalTemplateGroupsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const [group] = await db
            .select()
            .from(proposalTemplateGroups)
            .where(eq(proposalTemplateGroups.id, id));

        if (!group) {
            return res.status(404).json({ error: "Template group not found" });
        }

        // Fetch all templates referenced in the group
        const sections = (group.sections || []) as { templateId: number; sortOrder: number; required: boolean }[];
        const templateIds = sections.map(s => s.templateId);

        if (templateIds.length > 0) {
            const templates = await db
                .select()
                .from(proposalTemplates)
                .where(eq(proposalTemplates.isActive, true));

            const templatesById = Object.fromEntries(templates.map(t => [t.id, t]));

            const expandedSections = sections
                .map(s => ({
                    ...s,
                    template: templatesById[s.templateId] || null,
                }))
                .filter(s => s.template !== null)
                .sort((a, b) => a.sortOrder - b.sortOrder);

            return res.json({ ...group, expandedSections });
        }

        res.json({ ...group, expandedSections: [] });
    } catch (error) {
        console.error("Failed to fetch template group:", error);
        res.status(500).json({ error: "Failed to fetch template group" });
    }
});

// CREATE template group
proposalTemplateGroupsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const parsed = insertProposalTemplateGroupSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid group data", details: parsed.error.errors });
        }

        const [group] = await db
            .insert(proposalTemplateGroups)
            .values(parsed.data)
            .returning();

        res.status(201).json(group);
    } catch (error) {
        console.error("Failed to create template group:", error);
        res.status(500).json({ error: "Failed to create template group" });
    }
});

// UPDATE template group
proposalTemplateGroupsRouter.patch("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const [group] = await db
            .update(proposalTemplateGroups)
            .set({
                ...req.body,
                updatedAt: new Date(),
            })
            .where(eq(proposalTemplateGroups.id, id))
            .returning();

        if (!group) {
            return res.status(404).json({ error: "Template group not found" });
        }

        res.json(group);
    } catch (error) {
        console.error("Failed to update template group:", error);
        res.status(500).json({ error: "Failed to update template group" });
    }
});

// ===========================
// GENERATED PROPOSALS ROUTES
// ===========================

export const generatedProposalsRouter = Router();

// GET proposals for a lead
generatedProposalsRouter.get("/lead/:leadId", async (req: Request, res: Response) => {
    try {
        const leadId = parseInt(req.params.leadId);
        const proposals = await db
            .select()
            .from(generatedProposals)
            .where(eq(generatedProposals.leadId, leadId))
            .orderBy(desc(generatedProposals.createdAt));

        res.json(proposals);
    } catch (error) {
        console.error("Failed to fetch proposals:", error);
        res.status(500).json({ error: "Failed to fetch proposals" });
    }
});

// GET single proposal
generatedProposalsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const [proposal] = await db
            .select()
            .from(generatedProposals)
            .where(eq(generatedProposals.id, id));

        if (!proposal) {
            return res.status(404).json({ error: "Proposal not found" });
        }

        res.json(proposal);
    } catch (error) {
        console.error("Failed to fetch proposal:", error);
        res.status(500).json({ error: "Failed to fetch proposal" });
    }
});

// CREATE proposal
generatedProposalsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const parsed = insertGeneratedProposalSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid proposal data", details: parsed.error.errors });
        }

        const [proposal] = await db
            .insert(generatedProposals)
            .values(parsed.data)
            .returning();

        res.status(201).json(proposal);
    } catch (error) {
        console.error("Failed to create proposal:", error);
        res.status(500).json({ error: "Failed to create proposal" });
    }
});

// UPDATE proposal
generatedProposalsRouter.patch("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const [proposal] = await db
            .update(generatedProposals)
            .set({
                ...req.body,
                updatedAt: new Date(),
            })
            .where(eq(generatedProposals.id, id))
            .returning();

        if (!proposal) {
            return res.status(404).json({ error: "Proposal not found" });
        }

        res.json(proposal);
    } catch (error) {
        console.error("Failed to update proposal:", error);
        res.status(500).json({ error: "Failed to update proposal" });
    }
});
