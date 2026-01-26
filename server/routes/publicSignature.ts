/**
 * Public Signature Routes - No authentication required
 *
 * Allows clients to sign proposals via unique token links
 *
 * Features:
 * - Public PDF viewing for proposal review
 * - Electronic signature collection
 * - Auto deal stage update on signature
 * - Signed PDF generation with embedded signature
 */

import { Router } from "express";
import { storage } from "../storage";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";
import crypto from "crypto";
import { generateProposalPDF } from "../pdf/proposalGenerator";
import { generateWYSIWYGPdf, type WYSIWYGProposalData } from "../pdf/wysiwygPdfGenerator";
import { mapProposalData } from "../lib/proposalDataMapper";
import { cpqStorage } from "../storage/cpq";
import { db } from "../db";
import { generatedProposals } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import PDFDocument from "pdfkit";

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

        // Build PDF URL for this token
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || req.hostname;
        const pdfUrl = `${protocol}://${host}/api/public/proposals/${token}/pdf`;

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
            pdfUrl, // URL for PDF viewer
        });
    })
);

// GET /api/public/proposals/:token/pdf - Get proposal PDF for review (no auth required)
publicSignatureRouter.get(
    "/api/public/proposals/:token/pdf",
    asyncHandler(async (req, res) => {
        const { token } = req.params;

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

        // Fetch quote for this lead
        const quotes = await cpqStorage.getQuotesByLeadId(lead.id);
        const quote: any = quotes.find((q: any) => q.isLatest) || quotes[0] || null;

        // Check for saved WYSIWYG proposal
        // Use signatureProposalId if set, otherwise use most recent
        const signatureProposalId = (lead as any).signatureProposalId;

        try {
            let savedProposal;

            if (signatureProposalId) {
                // Use specific proposal version selected for signature
                const [specificProposal] = await db
                    .select()
                    .from(generatedProposals)
                    .where(eq(generatedProposals.id, signatureProposalId))
                    .limit(1);
                savedProposal = specificProposal;
                log(`INFO: Using specific proposal ${signatureProposalId} for signature PDF`);
            } else {
                // Fall back to most recent
                const savedProposals = await db
                    .select()
                    .from(generatedProposals)
                    .where(eq(generatedProposals.leadId, lead.id))
                    .orderBy(desc(generatedProposals.createdAt))
                    .limit(1);
                savedProposal = savedProposals[0];
            }

            if (savedProposal) {
                const sp = savedProposal as any;

                if (sp.coverData && sp.lineItems) {
                    // Use WYSIWYG generator for saved proposals (same as export)
                    const wysiwygData: WYSIWYGProposalData = {
                        id: sp.id,
                        leadId: lead.id,
                        coverData: sp.coverData,
                        projectData: sp.projectData || {
                            serviceType: "Commercial",
                            hasMatterport: false,
                            overview: "",
                            scopeItems: [],
                            deliverables: [],
                            timelineIntro: "",
                            milestones: [],
                        },
                        lineItems: sp.lineItems,
                        paymentData: sp.paymentData || {
                            terms: [],
                            paymentMethods: [],
                            acknowledgementDate: "",
                        },
                        subtotal: Number(sp.subtotal) || 0,
                        total: Number(sp.total) || 0,
                    };

                    log(`INFO: Generating public proposal PDF using WYSIWYG generator for lead ${lead.id}`);

                    const pdfDoc = await generateWYSIWYGPdf(wysiwygData);

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="Scan2Plan_Proposal.pdf"`);

                    pdfDoc.pipe(res);
                    pdfDoc.end();
                    return;
                }
            }
        } catch (error: any) {
            log(`WARN: Could not fetch saved proposal for public PDF: ${error?.message}`);
        }

        // Fall back to legacy generator if no WYSIWYG proposal found
        log(`INFO: Generating public proposal PDF using legacy generator for lead ${lead.id}`);
        const proposalData = mapProposalData(lead, quote);
        const pdfDoc = await generateProposalPDF(proposalData);

        // Stream to response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Scan2Plan_Proposal.pdf"`);

        pdfDoc.pipe(res);
        pdfDoc.end();
    })
);

// POST /api/public/proposals/:token/sign - Submit signature
publicSignatureRouter.post(
    "/api/public/proposals/:token/sign",
    asyncHandler(async (req, res) => {
        const { token } = req.params;
        const { signatureImage, signerName, signerEmail, signerTitle, agreedToTerms } = req.body;

        // Validate required fields including e-consent
        if (!signatureImage || !signerName || !signerEmail || !signerTitle) {
            return res.status(400).json({
                message: "signatureImage, signerName, signerEmail, and signerTitle are required"
            });
        }

        // Require explicit consent for legally binding e-signature
        if (!agreedToTerms) {
            return res.status(400).json({
                message: "You must agree to the terms and consent to electronic signature"
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

        // Capture audit trail data for legal compliance
        const signedAt = new Date();
        const signerIpAddress = req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
            || req.socket?.remoteAddress
            || 'unknown';
        const signerUserAgent = req.headers['user-agent'] || 'unknown';

        // Generate document hash for tamper-evidence
        const documentHash = crypto
            .createHash('sha256')
            .update(`${lead.id}-${token}-${signedAt.toISOString()}-${signerEmail}`)
            .digest('hex');

        // Build audit trail object
        const auditTrail = {
            signedAt: signedAt.toISOString(),
            signerName,
            signerEmail,
            signerIpAddress,
            signerUserAgent,
            documentHash,
            agreedToTerms: true,
            consentTimestamp: signedAt.toISOString(),
            token: token.substring(0, 16) + '...',
        };

        // Save signature AND auto-update deal stage to "Closed Won"
        await storage.updateLead(lead.id, {
            signatureImage,
            signerName,
            signerEmail,
            signerTitle,
            signedAt,
            signerIpAddress,
            signerUserAgent,
            documentHash,
            dealStage: "Closed Won", // Auto-update deal stage
            lastContactDate: signedAt,
        } as any);

        log(`[Public Signature] Lead ${lead.id} signed by ${signerName} (${signerEmail}) via token`);
        log(`[Audit Trail] IP: ${signerIpAddress}, UserAgent: ${signerUserAgent.substring(0, 50)}..., Hash: ${documentHash.substring(0, 16)}...`);
        log(`[Deal Stage] Updated to Closed Won`);

        // Build URL for signed PDF
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || req.hostname;
        const signedPdfUrl = `${protocol}://${host}/api/public/proposals/${token}/signed-pdf`;

        res.json({
            success: true,
            message: "Proposal signed successfully",
            dealStage: "Closed Won",
            signedPdfUrl,
            auditTrail, // Return audit trail for transparency
        });
    })
);

// GET /api/public/proposals/:token/signed-pdf - Get signed PDF with embedded signature
publicSignatureRouter.get(
    "/api/public/proposals/:token/signed-pdf",
    asyncHandler(async (req, res) => {
        const { token } = req.params;

        // Find lead by client token
        const leads = await storage.getLeads();
        const lead = leads.find(l => (l as any).clientToken === token);

        if (!lead) {
            return res.status(404).json({ message: "Proposal not found or link expired" });
        }

        // Check if signed
        const signedAt = (lead as any).signedAt;
        const signatureImage = (lead as any).signatureImage;
        const signerName = (lead as any).signerName;
        const signerEmail = (lead as any).signerEmail;
        const signerTitle = (lead as any).signerTitle || "";

        if (!signedAt || !signatureImage) {
            return res.status(400).json({ message: "This proposal has not been signed yet" });
        }

        // Check for saved WYSIWYG proposal
        const signatureProposalId = (lead as any).signatureProposalId;

        try {
            let savedProposal;

            if (signatureProposalId) {
                const [specificProposal] = await db
                    .select()
                    .from(generatedProposals)
                    .where(eq(generatedProposals.id, signatureProposalId))
                    .limit(1);
                savedProposal = specificProposal;
                log(`INFO: Using specific proposal ${signatureProposalId} for signed PDF`);
            } else {
                const savedProposals = await db
                    .select()
                    .from(generatedProposals)
                    .where(eq(generatedProposals.leadId, lead.id))
                    .orderBy(desc(generatedProposals.createdAt))
                    .limit(1);
                savedProposal = savedProposals[0];
            }

            if (savedProposal) {
                const sp = savedProposal as any;

                if (sp.coverData && sp.lineItems) {
                    // Use WYSIWYG generator with signature data embedded in Acknowledgement section
                    const wysiwygData: WYSIWYGProposalData = {
                        id: sp.id,
                        leadId: lead.id,
                        coverData: sp.coverData,
                        projectData: sp.projectData || {
                            serviceType: "Commercial",
                            hasMatterport: false,
                            overview: "",
                            scopeItems: [],
                            deliverables: [],
                            timelineIntro: "",
                            milestones: [],
                        },
                        lineItems: sp.lineItems,
                        paymentData: sp.paymentData || {
                            terms: [],
                            paymentMethods: [],
                            acknowledgementDate: "",
                        },
                        subtotal: Number(sp.subtotal) || 0,
                        total: Number(sp.total) || 0,
                        // Include signature data to fill in Acknowledgement section
                        signatureData: {
                            signatureImage,
                            signerName,
                            signerEmail,
                            signerTitle,
                            signedAt,
                        },
                    };

                    log(`INFO: Generating signed WYSIWYG PDF for lead ${lead.id}`);

                    const pdfDoc = await generateWYSIWYGPdf(wysiwygData);

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition',
                        `attachment; filename="Scan2Plan_Signed_Proposal_${lead.clientName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Client'}.pdf"`);

                    pdfDoc.pipe(res);
                    pdfDoc.end();
                    return;
                }
            }
        } catch (error: any) {
            log(`WARN: Could not generate signed WYSIWYG PDF: ${error?.message}`);
        }

        // Fallback to legacy generator if no WYSIWYG proposal found
        const quotes = await cpqStorage.getQuotesByLeadId(lead.id);
        const quote: any = quotes.find((q: any) => q.isLatest) || quotes[0] || null;
        const proposalData = mapProposalData(lead, quote);

        log(`INFO: Generating signed PDF using legacy generator for lead ${lead.id}`);

        const pdfDoc = await generateProposalPDF(proposalData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition',
            `attachment; filename="Scan2Plan_Signed_Proposal_${lead.clientName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Client'}.pdf"`);

        pdfDoc.pipe(res);
        pdfDoc.end();
    })
);

// POST /api/leads/:id/send-signature-link - Generate and send signature link
publicSignatureRouter.post(
    "/api/leads/:id/send-signature-link",
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const { recipientEmail, recipientName, proposalId } = req.body;

        const lead = await storage.getLead(leadId);
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        // Generate unique token (or reuse existing if not expired)
        let token = (lead as any).clientToken;
        let expiresAt = (lead as any).clientTokenExpiresAt;

        // Always generate new token when proposalId changes or token is expired
        const currentProposalId = (lead as any).signatureProposalId;
        const proposalChanged = proposalId && proposalId !== currentProposalId;

        if (!token || (expiresAt && new Date(expiresAt) < new Date()) || proposalChanged) {
            token = crypto.randomBytes(32).toString("hex");
            expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            await storage.updateLead(leadId, {
                clientToken: token,
                clientTokenExpiresAt: expiresAt,
                signatureProposalId: proposalId || null,
            } as any);

            log(`[Signature Link] New token generated for lead ${leadId}${proposalId ? ` with proposal ${proposalId}` : ''}`);
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
            proposalId: proposalId || currentProposalId || null,
            recipientEmail: recipientEmail || lead.contactEmail,
            recipientName: recipientName || lead.clientName,
        });
    })
);

export default publicSignatureRouter;
