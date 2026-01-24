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
        const { signatureImage, signerName, signerEmail, agreedToTerms } = req.body;

        // Validate required fields including e-consent
        if (!signatureImage || !signerName || !signerEmail) {
            return res.status(400).json({
                message: "signatureImage, signerName, and signerEmail are required"
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
        const signerIpAddress = (lead as any).signerIpAddress || 'Not recorded';
        const signerUserAgent = (lead as any).signerUserAgent || 'Not recorded';
        const documentHash = (lead as any).documentHash || 'Not available';

        if (!signedAt || !signatureImage) {
            return res.status(400).json({ message: "This proposal has not been signed yet" });
        }

        // Fetch quote for this lead
        const quotes = await cpqStorage.getQuotesByLeadId(lead.id);
        const quote: any = quotes.find((q: any) => q.isLatest) || quotes[0] || null;

        // Check for saved WYSIWYG proposal
        // Use signatureProposalId if set, otherwise use most recent
        const signatureProposalId = (lead as any).signatureProposalId;
        let proposalData;

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
                log(`INFO: Using specific proposal ${signatureProposalId} for signed PDF`);
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
                    proposalData = {
                        projectTitle: sp.coverData.projectTitle || lead.projectName || lead.clientName || "Project",
                        clientName: sp.coverData.clientName || lead.clientName || "",
                        date: sp.coverData.date || new Date().toLocaleDateString("en-US"),
                        location: sp.coverData.projectAddress || lead.projectAddress || "",
                        overview: {
                            projectName: sp.coverData.projectTitle || lead.projectName || "",
                            address: sp.coverData.projectAddress || lead.projectAddress || "",
                            buildingType: lead.buildingType || "Commercial",
                            sqft: Number(lead.sqft) || 0,
                            description: sp.projectData?.overview || "",
                        },
                        scope: {
                            scopeSummary: sp.projectData?.scopeItems?.join("; ") || "",
                            disciplines: sp.coverData.servicesLine || "",
                            deliverables: sp.projectData?.deliverables?.join(", ") || "Revit Model",
                            lodLevels: [],
                        },
                        timeline: {
                            duration: sp.projectData?.timelineIntro || "4-6 weeks",
                            milestones: sp.projectData?.milestones || [],
                        },
                        lineItems: sp.lineItems.map((item: any) => ({
                            item: item.itemName,
                            description: item.description,
                            qty: item.qty,
                            rate: item.rate,
                            amount: item.amount,
                        })),
                        subtotal: Number(sp.subtotal) || 0,
                        total: Number(sp.total) || 0,
                        paymentTerms: {
                            structure: sp.paymentData?.terms?.[0] || "50% upfront, 50% upon delivery",
                            upfrontAmount: (Number(sp.total) || 0) * 0.5,
                            totalAmount: Number(sp.total) || 0,
                            methods: sp.paymentData?.paymentMethods || ["ACH", "Check"],
                            terms: "Net 30",
                        },
                    };
                }
            }
        } catch (error: any) {
            log(`WARN: Could not fetch saved proposal for signed PDF: ${error?.message}`);
        }

        // Fall back to fresh data if no saved proposal
        if (!proposalData) {
            proposalData = mapProposalData(lead, quote);
        }

        log(`INFO: Generating signed proposal PDF for lead ${lead.id}`);

        // Generate proposal PDF
        const proposalPdfDoc = await generateProposalPDF(proposalData);

        // Collect proposal PDF into buffer
        const proposalChunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
            proposalPdfDoc.on('data', (chunk: Buffer) => proposalChunks.push(chunk));
            proposalPdfDoc.on('end', () => resolve());
            proposalPdfDoc.on('error', (err: Error) => reject(err));
            proposalPdfDoc.end();
        });

        // Create new PDF with proposal + signature page
        const signedDoc = new PDFDocument({
            size: "LETTER",
            margins: { top: 72, bottom: 72, left: 72, right: 72 },
            info: {
                Title: `Signed Proposal - ${proposalData.projectTitle}`,
                Author: "Scan2Plan",
                Subject: "Signed Proposal Document",
            },
        });

        // Stream signed PDF to response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition',
            `attachment; filename="Scan2Plan_Signed_Proposal_${lead.clientName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Client'}.pdf"`);

        signedDoc.pipe(res);

        // Add signature acceptance page
        let y = 72;

        // Header
        signedDoc
            .font("Helvetica-Bold")
            .fontSize(24)
            .fillColor("#1a365d")
            .text("Proposal Acceptance", 72, y, { width: 468, align: "center" });

        y += 50;

        // Acceptance text
        signedDoc
            .font("Helvetica")
            .fontSize(12)
            .fillColor("#374151")
            .text(
                `This document confirms that the proposal for "${proposalData.projectTitle}" ` +
                `has been reviewed and accepted by the undersigned client.`,
                72, y, { width: 468 }
            );

        y += 60;

        // Proposal details box
        signedDoc
            .fillColor("#f3f4f6")
            .rect(72, y, 468, 120)
            .fill();

        signedDoc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor("#1f2937")
            .text("Project Details", 90, y + 15);

        signedDoc
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#4b5563");

        const details = [
            ["Project:", proposalData.projectTitle || "N/A"],
            ["Client:", proposalData.clientName || "N/A"],
            ["Location:", proposalData.location || "N/A"],
            ["Total Value:", `$${proposalData.total?.toLocaleString() || "0"}`],
        ];

        let detailY = y + 35;
        for (const [label, value] of details) {
            signedDoc
                .font("Helvetica-Bold")
                .text(label, 90, detailY, { continued: true })
                .font("Helvetica")
                .text(` ${value}`);
            detailY += 18;
        }

        y += 140;

        // Signature section
        signedDoc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor("#1f2937")
            .text("Client Signature", 72, y);

        y += 25;

        // Signature image
        if (signatureImage) {
            try {
                // Decode base64 signature image
                const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, "");
                const signatureBuffer = Buffer.from(base64Data, "base64");

                signedDoc.image(signatureBuffer, 72, y, { width: 250, height: 80 });
                y += 90;
            } catch (error) {
                log(`WARN: Could not embed signature image: ${error}`);
                signedDoc
                    .font("Helvetica-Oblique")
                    .fontSize(10)
                    .fillColor("#6b7280")
                    .text("[Signature on file]", 72, y);
                y += 25;
            }
        }

        // Signature line
        signedDoc
            .moveTo(72, y)
            .lineTo(322, y)
            .strokeColor("#9ca3af")
            .stroke();

        y += 15;

        // Signer details
        signedDoc
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#4b5563")
            .text(`Signed by: ${signerName}`, 72, y);

        y += 18;
        signedDoc.text(`Email: ${signerEmail}`, 72, y);

        y += 18;
        signedDoc.text(`Date: ${new Date(signedAt).toLocaleString()}`, 72, y);

        y += 40;

        // Legal text
        signedDoc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#6b7280")
            .text(
                "By signing above, the client acknowledges receipt of the proposal, agrees to the terms " +
                "and conditions outlined therein, and authorizes Scan2Plan to proceed with the project " +
                "as specified. This electronic signature is legally binding under the ESIGN Act and UETA.",
                72, y, { width: 468 }
            );

        y += 50;

        // Audit Trail / Certificate of Completion
        signedDoc
            .fillColor("#f8fafc")
            .rect(72, y, 468, 130)
            .fill();

        signedDoc
            .strokeColor("#e5e7eb")
            .rect(72, y, 468, 130)
            .stroke();

        signedDoc
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor("#1f2937")
            .text("Certificate of Completion - Audit Trail", 90, y + 12);

        signedDoc
            .font("Helvetica")
            .fontSize(8)
            .fillColor("#4b5563");

        const auditY = y + 30;
        const auditItems = [
            ["Signer:", signerName],
            ["Email:", signerEmail],
            ["Signed At:", new Date(signedAt).toISOString()],
            ["IP Address:", signerIpAddress],
            ["User Agent:", signerUserAgent.length > 60 ? signerUserAgent.substring(0, 60) + '...' : signerUserAgent],
            ["Document Hash:", documentHash.substring(0, 32) + '...'],
        ];

        let auditItemY = auditY;
        for (const [label, value] of auditItems) {
            signedDoc
                .font("Helvetica-Bold")
                .text(label, 90, auditItemY, { continued: true, width: 80 })
                .font("Helvetica")
                .text(` ${value}`, { width: 368 });
            auditItemY += 14;
        }

        // Footer
        const footerY = 720;
        signedDoc
            .moveTo(72, footerY)
            .lineTo(540, footerY)
            .strokeColor("#d1d5db")
            .stroke();

        signedDoc
            .font("Helvetica")
            .fontSize(8)
            .fillColor("#9ca3af")
            .text(
                "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io",
                72, footerY + 10, { width: 468, align: "center" }
            );

        signedDoc
            .fontSize(8)
            .text(
                `Document ID: ${token.substring(0, 16)}... | Hash: ${documentHash.substring(0, 16)}... | Generated: ${new Date().toISOString()}`,
                72, footerY + 22, { width: 468, align: "center" }
            );

        signedDoc.end();
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
