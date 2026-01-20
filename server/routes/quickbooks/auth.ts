import { Router } from "express";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { quickbooksClient } from "../../quickbooks-client";
import { log } from "../../lib/logger";
import crypto from "crypto";

export const quickbooksAuthRouter = Router();

// GET /api/quickbooks/status
quickbooksAuthRouter.get(
    "/api/quickbooks/status",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            const configured = quickbooksClient.isConfigured();
            const connected = configured ? await quickbooksClient.isConnected() : false;
            const config = quickbooksClient.getConfig();
            const realmId = connected ? await quickbooksClient.getRealmId() : null;
            const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || "";

            log("[QuickBooks] Status check: " + JSON.stringify({
                configured,
                connected,
                hasClientId: !!process.env.QUICKBOOKS_CLIENT_ID,
                hasClientSecret: !!process.env.QUICKBOOKS_CLIENT_SECRET,
                hasRedirectUri: !!process.env.QUICKBOOKS_REDIRECT_URI,
                redirectUri,
            }));

            res.json({ configured, connected, ...config, realmId, redirectUri });
        } catch (error: any) {
            log("ERROR: [QuickBooks] Status error - " + error.message);
            res.json({ configured: quickbooksClient.isConfigured(), connected: false, error: error.message });
        }
    })
);

// GET /api/quickbooks/auth-url
quickbooksAuthRouter.get(
    "/api/quickbooks/auth",
    isAuthenticated,
    requireRole("ceo"),
    (req, res) => {
        if (!quickbooksClient.isConfigured()) {
            return res.status(400).json({ message: "QuickBooks credentials not configured" });
        }
        const state = crypto.randomBytes(16).toString("hex");
        (req.session as any).qbState = state;
        const authUrl = quickbooksClient.getAuthUrl(state);
        res.json({ authUrl });
    }
);

// GET /api/quickbooks/callback
quickbooksAuthRouter.get(
    "/api/quickbooks/callback",
    asyncHandler(async (req, res) => {
        try {
            const { code, state, realmId } = req.query;

            if (!code || !realmId) {
                return res.redirect("/settings?qb_error=missing_params");
            }

            const expectedState = (req.session as any).qbState;
            if (!state || state !== expectedState) {
                log("ERROR: QuickBooks OAuth state mismatch - possible CSRF attempt");
                return res.redirect("/settings?qb_error=invalid_state");
            }

            delete (req.session as any).qbState;

            await quickbooksClient.exchangeCodeForTokens(code as string, realmId as string);
            res.redirect("/settings?qb_connected=true");
        } catch (error: any) {
            log("ERROR: QuickBooks callback error - " + error.message);
            res.redirect(`/settings?qb_error=${encodeURIComponent(error.message)}`);
        }
    })
);

// POST /api/quickbooks/disconnect
quickbooksAuthRouter.post(
    "/api/quickbooks/disconnect",
    isAuthenticated,
    requireRole("ceo"),
    asyncHandler(async (req, res) => {
        try {
            await quickbooksClient.disconnect();
            res.json({ message: "QuickBooks disconnected" });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);
