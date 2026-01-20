/**
 * Public Signature Routes - No authentication required
 * 
 * Allows clients to sign proposals via unique token links
 */

import { Router } from "express";
import { storage } from "../storage";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";
import crypto from "crypto";

export const publicSignatureRouter = Router();

// GET /api/public/proposals/:token - Get proposal data for signing
publicSignatureRouter.get(
    "/api/public/proposals/:token",
    asyncHandler(async (req, res) => {
        const { token } = req.params;

        // Find lead by client token
        const leads = await storage.getLeads();
        const lead = leads.find(l => (l as any).clientToken === token);

        if (!lead) {
            return res.status(404).json({ message: "Proposal not found or link expired" });
        }

        // Check if token is expired (7 days)
        const tokenExpiresAt = (lead as any).clientTokenExpiresAt;
        if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
            return res.status(410).json({ message: "This signature link has expired" });
        }

        // Return proposal data (public-safe fields only)
        res.json({
            id: lead.id,
            projectName: lead.projectName,
            clientName: lead.clientName,
            projectAddress: lead.projectAddress,
            value: lead.value,
            isSigned: !!(lead as any).signedAt,
            signerName: (lead as any).signerName,
            signedAt: (lead as any).signedAt,
        });
    })
);

// POST /api/public/proposals/:token/sign - Submit signature
publicSignatureRouter.post(
    "/api/public/proposals/:token/sign",
    asyncHandler(async (req, res) => {
        const { token } = req.params;
        const { signatureImage, signerName, signerEmail } = req.body;

        if (!signatureImage || !signerName || !signerEmail) {
            return res.status(400).json({
                message: "signatureImage, signerName, and signerEmail are required"
            });
        }

        // Find lead by client token
        const leads = await storage.getLeads();
        const lead = leads.find(l => (l as any).clientToken === token);

        if (!lead) {
            return res.status(404).json({ message: "Proposal not found or link expired" });
        }

        // Check if token is expired
        const tokenExpiresAt = (lead as any).clientTokenExpiresAt;
        if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
            return res.status(410).json({ message: "This signature link has expired" });
        }

        // Check if already signed
        if ((lead as any).signedAt) {
            return res.status(409).json({ message: "This proposal has already been signed" });
        }

        // Save signature
        const updatedLead = await storage.updateLead(lead.id, {
            signatureImage,
            signerName,
            signerEmail,
            signedAt: new Date(),
        } as any);

        log(`[Public Signature] Lead ${lead.id} signed by ${signerName} (${signerEmail}) via token`);

        res.json({
            success: true,
            message: "Proposal signed successfully",
        });
    })
);

// POST /api/leads/:id/send-signature-link - Generate and send signature link
publicSignatureRouter.post(
    "/api/leads/:id/send-signature-link",
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const { recipientEmail, recipientName } = req.body;

        const lead = await storage.getLead(leadId);
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        // Generate unique token (or reuse existing if not expired)
        let token = (lead as any).clientToken;
        let expiresAt = (lead as any).clientTokenExpiresAt;

        if (!token || (expiresAt && new Date(expiresAt) < new Date())) {
            token = crypto.randomBytes(32).toString("hex");
            expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            await storage.updateLead(leadId, {
                clientToken: token,
                clientTokenExpiresAt: expiresAt,
            } as any);
        }

        // Use request host for proper URL generation
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || req.hostname;
        const signatureUrl = `${protocol}://${host}/sign/${token}`;

        log(`[Signature Link] Generated for lead ${leadId}: ${signatureUrl}`);

        // TODO: Send email with signature link
        // For now, just return the link
        res.json({
            signatureUrl,
            expiresAt,
            recipientEmail: recipientEmail || lead.contactEmail,
            recipientName: recipientName || lead.clientName,
        });
    })
);

export default publicSignatureRouter;
