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
import { generateWYSIWYGPdf, type WYSIWYGProposalData } from "../pdf/wysiwygPdfGenerator";
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

        // Track first view timestamp for audit trail
        if (!(lead as any).proposalViewedAt) {
            await storage.updateLead(lead.id, {
                proposalViewedAt: new Date(),
            } as any);
            log(`[Proposal Viewed] Lead ${lead.id} - First view by client`);
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
            // Sender signature status
            isSenderSigned: !!(lead as any).senderSignedAt,
            senderSignerName: (lead as any).senderSignerName,
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
                        displaySettings: sp.displaySettings || undefined,
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

            // No saved WYSIWYG proposal exists
            log(`ERROR: No WYSIWYG proposal found for lead ${lead.id} - proposal must be created first`);
            return res.status(404).json({
                error: "Proposal not found",
                message: "Please generate a proposal from the deal page first."
            });
        } catch (error: any) {
            log(`ERROR: Failed to generate public PDF: ${error?.message}`);
            return res.status(500).json({ error: "Failed to generate proposal PDF" });
        }
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

        // Extract client signature data
        const signedAt = (lead as any).signedAt;
        const signatureImage = (lead as any).signatureImage;
        const signerName = (lead as any).signerName;
        const signerEmail = (lead as any).signerEmail;
        const signerTitle = (lead as any).signerTitle || "";
        const signerIpAddress = (lead as any).signerIpAddress;

        if (!signedAt || !signatureImage) {
            return res.status(400).json({ message: "This proposal has not been signed yet" });
        }

        // Extract sender signature data
        const senderSignatureImage = (lead as any).senderSignatureImage;
        const senderSignerName = (lead as any).senderSignerName;
        const senderSignerEmail = (lead as any).senderSignerEmail;
        const senderSignerTitle = (lead as any).senderSignerTitle;
        const senderSignedAt = (lead as any).senderSignedAt;
        const senderIpAddress = (lead as any).senderIpAddress;
        const senderViewedAt = (lead as any).senderViewedAt;

        // Extract audit trail timestamps
        const proposalSentAt = (lead as any).proposalSentAt;
        const proposalViewedAt = (lead as any).proposalViewedAt;
        const certificateRefNumber = (lead as any).certificateRefNumber;

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
                        displaySettings: sp.displaySettings || undefined,
                        subtotal: Number(sp.subtotal) || 0,
                        total: Number(sp.total) || 0,
                        // Include client signature data
                        signatureData: {
                            signatureImage,
                            signerName,
                            signerEmail,
                            signerTitle,
                            signedAt,
                        },
                        // Include sender (Scan2Plan) signature data
                        senderSignatureData: senderSignatureImage ? {
                            signatureImage: senderSignatureImage,
                            signerName: senderSignerName,
                            signerEmail: senderSignerEmail,
                            signerTitle: senderSignerTitle,
                            signedAt: senderSignedAt,
                        } : undefined,
                        // Include audit trail for Certificate of Signature
                        auditTrail: certificateRefNumber ? {
                            certificateRefNumber,
                            documentCompletedAt: signedAt, // Document complete when client signs
                            senderName: senderSignerName || 'Scan2Plan Representative',
                            senderEmail: senderSignerEmail || '',
                            senderSignatureImage: senderSignatureImage,
                            senderSentAt: proposalSentAt,
                            senderViewedAt: senderViewedAt,
                            senderSignedAt: senderSignedAt,
                            senderIpAddress: senderIpAddress,
                            clientName: signerName,
                            clientEmail: signerEmail,
                            clientSignatureImage: signatureImage,
                            clientSentAt: proposalSentAt,
                            clientViewedAt: proposalViewedAt,
                            clientSignedAt: signedAt,
                            clientIpAddress: signerIpAddress,
                        } : undefined,
                    };

                    log(`INFO: Generating signed WYSIWYG PDF for lead ${lead.id} with dual signatures and audit trail`);

                    const pdfDoc = await generateWYSIWYGPdf(wysiwygData);

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition',
                        `attachment; filename="Scan2Plan_Signed_Proposal_${lead.clientName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Client'}.pdf"`);

                    pdfDoc.pipe(res);
                    pdfDoc.end();
                    return;
                }
            }

            // No saved WYSIWYG proposal exists
            log(`ERROR: No WYSIWYG proposal found for lead ${lead.id} - proposal must be created first`);
            return res.status(404).json({
                error: "Proposal not found",
                message: "Please generate a proposal from the deal page first."
            });
        } catch (error: any) {
            log(`ERROR: Failed to generate signed PDF: ${error?.message}`);
            return res.status(500).json({ error: "Failed to generate signed proposal PDF" });
        }
    })
);

// ============================================================================
// SENDER (SCAN2PLAN) SIGNATURE ROUTES
// ============================================================================

// Helper function to generate certificate reference number
function generateCertificateRefNumber(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
    const segments = [];
    for (let s = 0; s < 4; s++) {
        let segment = '';
        for (let c = 0; c < 5; c++) {
            segment += chars[Math.floor(Math.random() * chars.length)];
        }
        segments.push(segment);
    }
    return segments.join('-');
}

// POST /api/leads/:id/generate-sender-signing-link - Generate signing link for Scan2Plan rep
publicSignatureRouter.post(
    "/api/leads/:id/generate-sender-signing-link",
    asyncHandler(async (req, res) => {
        const leadId = Number(req.params.id);
        const { proposalId } = req.body;

        const lead = await storage.getLead(leadId);
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        // Generate unique token for sender signing
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Generate certificate reference number if not already set
        let certRefNumber = (lead as any).certificateRefNumber;
        if (!certRefNumber) {
            certRefNumber = generateCertificateRefNumber();
        }

        await storage.updateLead(leadId, {
            senderToken: token,
            senderTokenExpiresAt: expiresAt,
            signatureProposalId: proposalId || (lead as any).signatureProposalId || null,
            certificateRefNumber: certRefNumber,
        } as any);

        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || req.hostname;
        const senderSigningUrl = `${protocol}://${host}/sender-sign/${token}`;

        log(`[Sender Signature] Generated signing link for lead ${leadId}: ${senderSigningUrl}`);

        res.json({
            senderSigningUrl,
            expiresAt,
            proposalId: proposalId || (lead as any).signatureProposalId || null,
            certificateRefNumber: certRefNumber,
        });
    })
);

// GET /api/sender-sign/:token - Get proposal data for sender signing
publicSignatureRouter.get(
    "/api/sender-sign/:token",
    asyncHandler(async (req, res) => {
        const { token } = req.params;

        // Find lead by sender token
        const leads = await storage.getLeads();
        const lead = leads.find(l => (l as any).senderToken === token);

        if (!lead) {
            return res.status(404).json({ message: "Signing link not found or expired" });
        }

        // Check if token is expired
        const tokenExpiresAt = (lead as any).senderTokenExpiresAt;
        if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
            return res.status(410).json({ message: "This signing link has expired" });
        }

        // Track when sender first views the signing page (for audit trail)
        if (!(lead as any).senderViewedAt) {
            await storage.updateLead(lead.id, {
                senderViewedAt: new Date(),
            } as any);
        }

        // Build PDF URL for this token
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || req.hostname;
        const pdfUrl = `${protocol}://${host}/api/sender-sign/${token}/pdf`;

        res.json({
            id: lead.id,
            projectName: lead.projectName,
            clientName: lead.clientName,
            projectAddress: lead.projectAddress,
            value: lead.value,
            isSenderSigned: !!(lead as any).senderSignedAt,
            senderSignerName: (lead as any).senderSignerName,
            senderSignedAt: (lead as any).senderSignedAt,
            pdfUrl,
        });
    })
);

// GET /api/sender-sign/:token/pdf - Get proposal PDF for sender review
publicSignatureRouter.get(
    "/api/sender-sign/:token/pdf",
    asyncHandler(async (req, res) => {
        const { token } = req.params;

        // Find lead by sender token
        const leads = await storage.getLeads();
        const lead = leads.find(l => (l as any).senderToken === token);

        if (!lead) {
            return res.status(404).json({ message: "Signing link not found or expired" });
        }

        // Check if token is expired
        const tokenExpiresAt = (lead as any).senderTokenExpiresAt;
        if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
            return res.status(410).json({ message: "This signing link has expired" });
        }

        // Use the same PDF generation logic as client viewing
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
                        displaySettings: sp.displaySettings || undefined,
                        subtotal: Number(sp.subtotal) || 0,
                        total: Number(sp.total) || 0,
                    };

                    const pdfDoc = await generateWYSIWYGPdf(wysiwygData);

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="Scan2Plan_Proposal.pdf"`);

                    pdfDoc.pipe(res);
                    pdfDoc.end();
                    return;
                }
            }

            // No saved WYSIWYG proposal exists
            log(`ERROR: No WYSIWYG proposal found for lead ${lead.id} - proposal must be created first`);
            return res.status(404).json({
                error: "Proposal not found",
                message: "Please generate a proposal from the deal page first."
            });
        } catch (error: any) {
            log(`ERROR: Failed to generate sender PDF: ${error?.message}`);
            return res.status(500).json({ error: "Failed to generate proposal PDF" });
        }
    })
);

// POST /api/sender-sign/:token/sign - Submit sender signature
publicSignatureRouter.post(
    "/api/sender-sign/:token/sign",
    asyncHandler(async (req, res) => {
        const { token } = req.params;
        const { signatureImage, signerName, signerEmail, signerTitle, agreedToTerms } = req.body;

        if (!signatureImage || !signerName || !signerEmail || !signerTitle) {
            return res.status(400).json({
                message: "signatureImage, signerName, signerEmail, and signerTitle are required"
            });
        }

        if (!agreedToTerms) {
            return res.status(400).json({
                message: "You must agree to the terms and consent to electronic signature"
            });
        }

        // Find lead by sender token
        const leads = await storage.getLeads();
        const lead = leads.find(l => (l as any).senderToken === token);

        if (!lead) {
            return res.status(404).json({ message: "Signing link not found or expired" });
        }

        // Check if token is expired
        const tokenExpiresAt = (lead as any).senderTokenExpiresAt;
        if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
            return res.status(410).json({ message: "This signing link has expired" });
        }

        // Check if already signed
        if ((lead as any).senderSignedAt) {
            return res.status(409).json({ message: "This proposal has already been signed by the sender" });
        }

        // Capture audit trail data
        const signedAt = new Date();
        const signerIpAddress = req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
            || req.socket?.remoteAddress
            || 'unknown';
        const signerUserAgent = req.headers['user-agent'] || 'unknown';

        // Save sender signature
        await storage.updateLead(lead.id, {
            senderSignatureImage: signatureImage,
            senderSignerName: signerName,
            senderSignerEmail: signerEmail,
            senderSignerTitle: signerTitle,
            senderSignedAt: signedAt,
            senderIpAddress: signerIpAddress,
            senderUserAgent: signerUserAgent,
        } as any);

        log(`[Sender Signature] Lead ${lead.id} signed by ${signerName} (${signerEmail})`);
        log(`[Sender Audit] IP: ${signerIpAddress}, UserAgent: ${signerUserAgent.substring(0, 50)}...`);

        res.json({
            success: true,
            message: "Proposal signed successfully by sender",
            signedAt: signedAt.toISOString(),
            auditTrail: {
                signedAt: signedAt.toISOString(),
                signerName,
                signerEmail,
                signerIpAddress,
                signerUserAgent,
            },
        });
    })
);

// ============================================================================
// CLIENT SIGNATURE LINK GENERATION
// ============================================================================

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

        // Generate certificate reference number if not already set
        let certRefNumber = (lead as any).certificateRefNumber;
        if (!certRefNumber) {
            certRefNumber = generateCertificateRefNumber();
        }

        if (!token || (expiresAt && new Date(expiresAt) < new Date()) || proposalChanged) {
            token = crypto.randomBytes(32).toString("hex");
            expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            await storage.updateLead(leadId, {
                clientToken: token,
                clientTokenExpiresAt: expiresAt,
                signatureProposalId: proposalId || null,
                proposalSentAt: new Date(), // Track when sent to client
                certificateRefNumber: certRefNumber,
            } as any);

            log(`[Signature Link] New token generated for lead ${leadId}${proposalId ? ` with proposal ${proposalId}` : ''}`);
        } else {
            // Update sent timestamp even if reusing token
            await storage.updateLead(leadId, {
                proposalSentAt: new Date(),
                certificateRefNumber: certRefNumber,
            } as any);
        }

        // Use request host for proper URL generation
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || req.hostname;
        const signatureUrl = `${protocol}://${host}/sign/${token}`;

        log(`[Signature Link] Generated for lead ${leadId}: ${signatureUrl}`);

        // Check if sender has signed
        const senderSigned = !!(lead as any).senderSignedAt;

        res.json({
            signatureUrl,
            expiresAt,
            proposalId: proposalId || currentProposalId || null,
            recipientEmail: recipientEmail || lead.contactEmail,
            recipientName: recipientName || lead.clientName,
            senderSigned,
            certificateRefNumber: certRefNumber,
        });
    })
);

export default publicSignatureRouter;
