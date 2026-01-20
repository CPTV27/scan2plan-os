import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { db } from "../db";
import { leads, cpqQuotes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { log } from "../lib/logger";
import crypto from "crypto";

const router = Router();

// DocuSeal configuration
const DOCUSEAL_URL = process.env.DOCUSEAL_URL || "http://localhost:3001";
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY || "";
const DOCUSEAL_WEBHOOK_SECRET = process.env.DOCUSEAL_WEBHOOK_SECRET || "";

// ============================================
// SIGNATURE SUBMISSION
// ============================================

// POST /api/signatures/send - Send document for signature
router.post(
    "/send",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req: Request, res: Response) => {
        const { quoteId, recipientEmail, recipientName, pdfBase64, documentName } = req.body;

        if (!DOCUSEAL_API_KEY) {
            return res.status(503).json({
                error: "DocuSeal not configured. Add DOCUSEAL_API_KEY to environment."
            });
        }

        if (!recipientEmail || !pdfBase64) {
            return res.status(400).json({
                error: "recipientEmail and pdfBase64 required"
            });
        }

        try {
            // Create submission in DocuSeal
            const response = await fetch(`${DOCUSEAL_URL}/api/submissions`, {
                method: "POST",
                headers: {
                    "X-Auth-Token": DOCUSEAL_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    template_id: null, // Direct PDF, no template
                    send_email: true,
                    submitters: [
                        {
                            email: recipientEmail,
                            name: recipientName || recipientEmail.split("@")[0],
                            role: "Signer",
                        },
                    ],
                    documents: [
                        {
                            name: documentName || "Proposal.pdf",
                            file: pdfBase64, // Base64 encoded PDF
                        },
                    ],
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                log(`ERROR: DocuSeal API error: ${errorText}`);
                return res.status(response.status).json({
                    error: "DocuSeal API error",
                    details: errorText
                });
            }

            const submission = await response.json();

            // Update quote with signature info if quoteId provided
            if (quoteId) {
                await db.update(cpqQuotes)
                    .set({
                        signatureProvider: "docuseal",
                        signatureSubmissionId: String(submission.id),
                        signatureStatus: "sent",
                        signatureSentAt: new Date(),
                    } as any)
                    .where(eq(cpqQuotes.id, parseInt(quoteId)));
            }


            log(`[DocuSeal] Signature request sent: ${submission.id} to ${recipientEmail}`);

            return res.status(201).json({
                success: true,
                submissionId: submission.id,
                status: "sent",
                message: `Signature request sent to ${recipientEmail}`,
            });
        } catch (error) {
            log(`ERROR: DocuSeal send failed: ${error}`);
            return res.status(500).json({ error: "Failed to send signature request" });
        }
    })
);

// ============================================
// WEBHOOK HANDLER
// ============================================

// POST /api/webhooks/docuseal - Handle DocuSeal events
router.post(
    "/webhooks/docuseal",
    asyncHandler(async (req: Request, res: Response) => {
        // Verify webhook signature if secret is configured
        if (DOCUSEAL_WEBHOOK_SECRET) {
            const signature = req.headers["x-webhook-signature"] as string;
            const payload = JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac("sha256", DOCUSEAL_WEBHOOK_SECRET)
                .update(payload)
                .digest("hex");

            if (signature !== expectedSignature) {
                log(`WARN: DocuSeal webhook signature mismatch`);
                return res.status(401).json({ error: "Invalid signature" });
            }
        }

        const { event_type, data } = req.body;

        log(`[DocuSeal Webhook] Event: ${event_type}, Submission: ${data?.submission_id}`);

        // Map DocuSeal events to signature status
        let newStatus: string | null = null;
        let newDealStage: string | null = null;

        switch (event_type) {
            case "form.viewed":
                newStatus = "viewed";
                newDealStage = "Proposal Viewed";
                break;
            case "form.started":
                newStatus = "in_progress";
                break;
            case "form.completed":
                newStatus = "signed";
                newDealStage = "Signed";
                break;
            case "form.declined":
                newStatus = "declined";
                newDealStage = "Proposal Declined";
                break;
        }

        // Update quote if we have a submission ID
        if (data?.submission_id && newStatus) {
            const submissionId = String(data.submission_id);

            const updateData: any = {
                signatureStatus: newStatus,
            };

            if (newStatus === "signed") {
                updateData.signatureSignedAt = new Date();
            }

            await db.update(cpqQuotes)
                .set(updateData)
                .where(eq(cpqQuotes.signatureSubmissionId, submissionId));

            // Update lead deal stage if applicable
            if (newDealStage) {
                const [quote] = await db.select()
                    .from(cpqQuotes)
                    .where(eq(cpqQuotes.signatureSubmissionId, submissionId));

                if (quote?.leadId) {
                    await db.update(leads)
                        .set({ dealStage: newDealStage })
                        .where(eq(leads.id, quote.leadId));
                }
            }

            log(`[DocuSeal] Updated signature status: ${submissionId} -> ${newStatus}`);
        }

        // Always return 200 to acknowledge webhook
        return res.status(200).json({ received: true });
    })
);

// ============================================
// STATUS & DOWNLOAD
// ============================================

// GET /api/signatures/:id/status - Check signing status
router.get(
    "/:id/status",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        if (!DOCUSEAL_API_KEY) {
            return res.status(503).json({ error: "DocuSeal not configured" });
        }

        try {
            const response = await fetch(`${DOCUSEAL_URL}/api/submissions/${id}`, {
                headers: {
                    "X-Auth-Token": DOCUSEAL_API_KEY,
                },
            });

            if (!response.ok) {
                return res.status(response.status).json({ error: "Submission not found" });
            }

            const submission = await response.json();

            return res.json({
                success: true,
                submissionId: submission.id,
                status: submission.status,
                completedAt: submission.completed_at,
                submitters: submission.submitters,
            });
        } catch (error) {
            log(`ERROR: DocuSeal status check failed: ${error}`);
            return res.status(500).json({ error: "Failed to check status" });
        }
    })
);

// GET /api/signatures/:id/download - Download signed document
router.get(
    "/:id/download",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        if (!DOCUSEAL_API_KEY) {
            return res.status(503).json({ error: "DocuSeal not configured" });
        }

        try {
            const response = await fetch(`${DOCUSEAL_URL}/api/submissions/${id}/documents`, {
                headers: {
                    "X-Auth-Token": DOCUSEAL_API_KEY,
                },
            });

            if (!response.ok) {
                return res.status(response.status).json({ error: "Documents not found" });
            }

            const documents = await response.json();

            // Return document URLs
            return res.json({
                success: true,
                documents: documents.map((doc: any) => ({
                    name: doc.name,
                    url: doc.url,
                    signedAt: doc.signed_at,
                })),
            });
        } catch (error) {
            log(`ERROR: DocuSeal download failed: ${error}`);
            return res.status(500).json({ error: "Failed to download documents" });
        }
    })
);

// ============================================
// CONFIGURATION CHECK
// ============================================

// GET /api/signatures/config - Check DocuSeal configuration
router.get(
    "/config",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
        const configured = !!DOCUSEAL_API_KEY;
        const url = DOCUSEAL_URL;

        // Test connection if configured
        let connected = false;
        if (configured) {
            try {
                const response = await fetch(`${DOCUSEAL_URL}/api/templates`, {
                    headers: { "X-Auth-Token": DOCUSEAL_API_KEY },
                });
                connected = response.ok;
            } catch (e) {
                connected = false;
            }
        }

        return res.json({
            success: true,
            configured,
            connected,
            url: configured ? url : null,
        });
    })
);

export default router;
