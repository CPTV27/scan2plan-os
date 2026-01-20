import { Router } from "express";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { quickbooksClient } from "../../quickbooks-client";
import { storage } from "../../storage";
import { log } from "../../lib/logger";

export const quickbooksCustomersRouter = Router();

// POST /api/quickbooks/sync-customers
quickbooksCustomersRouter.post(
    "/api/quickbooks/sync-customers",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const isConnected = await quickbooksClient.isConnected();
            if (!isConnected) {
                return res.status(400).json({ message: "QuickBooks not connected" });
            }

            const customers = await quickbooksClient.getAllCustomers();
            let synced = 0;
            let errors: string[] = [];

            for (const c of customers) {
                try {
                    await storage.upsertQbCustomer({
                        qbId: c.id,
                        displayName: c.displayName,
                        companyName: c.companyName || null,
                        email: c.email || null,
                        phone: c.phone || null,
                        mobile: c.mobile || null,
                        fax: c.fax || null,
                        billingLine1: c.billingAddress?.line1 || null,
                        billingLine2: c.billingAddress?.line2 || null,
                        billingCity: c.billingAddress?.city || null,
                        billingState: c.billingAddress?.state || null,
                        billingPostalCode: c.billingAddress?.postalCode || null,
                        billingCountry: c.billingAddress?.country || null,
                        shippingLine1: c.shippingAddress?.line1 || null,
                        shippingLine2: c.shippingAddress?.line2 || null,
                        shippingCity: c.shippingAddress?.city || null,
                        shippingState: c.shippingAddress?.state || null,
                        shippingPostalCode: c.shippingAddress?.postalCode || null,
                        shippingCountry: c.shippingAddress?.country || null,
                        balance: c.balance?.toString() || null,
                        active: c.active ?? true,
                    });
                    synced++;
                } catch (err: any) {
                    errors.push(`${c.displayName}: ${err.message}`);
                }
            }

            log(`[QuickBooks] Synced ${synced} customers from QuickBooks`);
            res.json({
                success: true,
                synced,
                total: customers.length,
                errors: errors.length > 0 ? errors : undefined,
            });
        } catch (error: any) {
            log("ERROR: [QuickBooks] Customer sync failed - " + error.message);
            res.status(500).json({ message: error.message || "Customer sync failed" });
        }
    })
);

// GET /api/quickbooks/customers/search
quickbooksCustomersRouter.get(
    "/api/quickbooks/customers/search",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        const query = (req.query.q as string) || "";
        const customers = await storage.searchQbCustomers(query);
        res.json({ customers });
    })
);

// GET /api/quickbooks/customers
quickbooksCustomersRouter.get(
    "/api/quickbooks/customers",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        const customers = await storage.getQbCustomers();
        res.json({ customers });
    })
);
