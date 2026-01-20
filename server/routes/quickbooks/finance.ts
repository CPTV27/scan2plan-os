import { Router } from "express";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { quickbooksClient } from "../../quickbooks-client";
import { db } from "../../db";
import { settings, expenses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { log } from "../../lib/logger";

export const quickbooksFinanceRouter = Router();

const financialMappingSchema = z.object({
    operatingAccountId: z.string().min(1, "Operating account is required").nullable(),
    taxAccountId: z.string().min(1, "Tax account is required").nullable(),
    expenseAccountId: z.string().nullable().optional(),
});

const fieldExpenseSchema = z.object({
    category: z.enum(["Parking", "Tolls", "Fuel", "Meals", "Hotel", "Equipment Rental", "Supplies", "Other"]),
    amount: z.number().positive("Amount must be positive"),
    description: z.string().optional(),
    vendorName: z.string().optional(),
});

// GET /api/quickbooks/accounts
quickbooksFinanceRouter.get(
    "/api/quickbooks/accounts",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const accounts = await quickbooksClient.getAccounts();
            const bankAccounts = accounts.filter(a => a.type === "Bank");
            const creditCardAccounts = accounts.filter(a => a.type === "Credit Card");
            res.json({ bankAccounts, creditCardAccounts, allAccounts: accounts });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

// GET /api/settings/financial-mapping
quickbooksFinanceRouter.get(
    "/api/settings/financial-mapping",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const result = await db.select().from(settings).where(eq(settings.key, "financial_mapping")).limit(1);
            if (result.length === 0) {
                return res.json({ operatingAccountId: null, taxAccountId: null, expenseAccountId: null });
            }
            res.json(result[0].value);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

// POST /api/settings/financial-mapping
quickbooksFinanceRouter.post(
    "/api/settings/financial-mapping",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const parsed = financialMappingSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    message: "Invalid mapping data",
                    errors: parsed.error.errors
                });
            }

            const { operatingAccountId, taxAccountId, expenseAccountId } = parsed.data;
            const mapping = {
                operatingAccountId: operatingAccountId || null,
                taxAccountId: taxAccountId || null,
                expenseAccountId: expenseAccountId || null
            };

            const existing = await db.select().from(settings).where(eq(settings.key, "financial_mapping")).limit(1);

            if (existing.length > 0) {
                await db.update(settings)
                    .set({ value: mapping, updatedAt: new Date() })
                    .where(eq(settings.key, "financial_mapping"));
            } else {
                await db.insert(settings).values({ key: "financial_mapping", value: mapping });
            }

            res.json({ message: "Financial mapping saved", mapping });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

// GET /api/expenses
quickbooksFinanceRouter.get(
    "/api/expenses",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const expensesList = await quickbooksClient.getExpenses();
            res.json(expensesList);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

// PATCH /api/expenses/:id/link
quickbooksFinanceRouter.patch(
    "/api/expenses/:id/link",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const expenseId = parseInt(req.params.id);
            const { leadId, projectId } = req.body;
            let expense;
            if (leadId !== undefined) {
                expense = await quickbooksClient.linkExpenseToLead(expenseId, leadId);
            }
            if (projectId !== undefined) {
                expense = await quickbooksClient.linkExpenseToProject(expenseId, projectId);
            }
            res.json(expense);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

// POST /api/projects/:projectId/expenses
quickbooksFinanceRouter.post(
    "/api/projects/:projectId/expenses",
    isAuthenticated,
    requireRole("production", "ceo"),
    asyncHandler(async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const user = req.user as any;

            const parsed = fieldExpenseSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid expense data" });
            }

            const { category, amount, description, vendorName } = parsed.data;

            const expense = await db.insert(expenses).values({
                projectId,
                techId: user.id,
                category,
                amount: amount.toString(),
                description: description || null,
                vendorName: vendorName || null,
                source: "field",
            }).returning();

            res.status(201).json(expense[0]);
        } catch (error: any) {
            log("ERROR: Field expense error - " + error.message);
            res.status(500).json({ message: error.message });
        }
    })
);

// GET /api/projects/:projectId/expenses
quickbooksFinanceRouter.get(
    "/api/projects/:projectId/expenses",
    isAuthenticated,
    requireRole("production", "ceo"),
    asyncHandler(async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const projectExpenses = await db.select()
                .from(expenses)
                .where(eq(expenses.projectId, projectId));
            res.json(projectExpenses);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);
