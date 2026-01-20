import { Router } from "express";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { getGmailClient } from "../../google-clients";
import { log } from "../../lib/logger";
import { storage } from "../../storage";
import { nanoid } from "nanoid";
import { generateEstimatePDF } from "../../pdf-generator";
import { generateProposalEmailHtml, formatCurrency } from "../../services/emailTemplates";

export const googleGmailRouter = Router();

// GET /api/google/gmail/messages
googleGmailRouter.get(
    "/api/google/gmail/messages",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        try {
            const gmail = await getGmailClient();
            const maxResults = Number(req.query.maxResults) || 10;
            const q = req.query.q as string || '';

            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults,
                q,
            });

            const messages = await Promise.all(
                (response.data.messages || []).map(async (msg) => {
                    const full = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id!,
                        format: 'metadata',
                        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
                    });
                    const headers = full.data.payload?.headers || [];
                    return {
                        id: msg.id,
                        threadId: msg.threadId,
                        snippet: full.data.snippet,
                        from: headers.find(h => h.name === 'From')?.value,
                        to: headers.find(h => h.name === 'To')?.value,
                        subject: headers.find(h => h.name === 'Subject')?.value,
                        date: headers.find(h => h.name === 'Date')?.value,
                    };
                })
            );

            res.json({ messages });
        } catch (error: any) {
            log("ERROR: Gmail list error - " + (error?.message || error));
            res.status(500).json({ message: error.message || "Failed to fetch emails" });
        }
    })
);

// POST /api/google/gmail/send
googleGmailRouter.post(
    "/api/google/gmail/send",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        try {
            const gmail = await getGmailClient();
            const { to, subject, body } = req.body;

            if (!to || !subject || !body) {
                return res.status(400).json({ message: "to, subject, and body are required" });
            }

            const email = [
                `To: ${to}`,
                `Subject: ${subject}`,
                'Content-Type: text/plain; charset=utf-8',
                '',
                body,
            ].join('\r\n');

            const encodedEmail = Buffer.from(email).toString('base64url');

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw: encodedEmail },
            });

            res.json({ messageId: response.data.id, threadId: response.data.threadId });
        } catch (error: any) {
            log("ERROR: Gmail send error - " + (error?.message || error));
            res.status(500).json({ message: error.message || "Failed to send email" });
        }
    })
);

// GET /api/google/gmail/preview-proposal/:leadId
googleGmailRouter.get(
    "/api/google/gmail/preview-proposal/:leadId",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const leadId = parseInt(req.params.leadId);

            const lead = await storage.getLead(leadId);
            if (!lead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            const quotes = await storage.getCpqQuotesByLead(leadId);
            const latestQuote = quotes.find(q => q.isLatest) || quotes[quotes.length - 1];

            if (!latestQuote) {
                return res.status(400).json({ message: "No quote found for this lead. Please create a quote first." });
            }

            const htmlBody = generateProposalEmailHtml(lead, latestQuote);

            res.setHeader('Content-Type', 'text/html');
            res.send(htmlBody);
        } catch (error: any) {
            log("ERROR: Proposal preview error - " + (error?.message || error));
            res.status(500).json({ message: error.message || "Failed to generate proposal preview" });
        }
    })
);

// POST /api/google/gmail/send-proposal
googleGmailRouter.post(
    "/api/google/gmail/send-proposal",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const { leadId, recipientEmail, customSubject } = req.body;

            if (!leadId) {
                return res.status(400).json({ message: "leadId is required" });
            }

            const lead = await storage.getLead(leadId);
            if (!lead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            const quotes = await storage.getCpqQuotesByLead(leadId);
            const latestQuote = quotes.find(q => q.isLatest) || quotes[quotes.length - 1];

            if (!latestQuote) {
                return res.status(400).json({ message: "No quote found for this lead. Please create a quote first." });
            }

            const toEmail = recipientEmail || lead.contactEmail || lead.billingContactEmail || (latestQuote as any).billingContactEmail;
            if (!toEmail) {
                return res.status(400).json({ message: "No recipient email provided and no contact email on lead or quote" });
            }

            const projectName = lead.projectName || lead.clientName || 'Your Project';
            const subject = customSubject || `Scan2Plan Proposal - ${projectName}`;

            // Generate tracking token and save to database
            const trackingToken = nanoid(24);
            let baseUrl = 'https://scan2plan-os.replit.app';
            if (process.env.REPLIT_DEPLOYMENT_URL) {
                baseUrl = process.env.REPLIT_DEPLOYMENT_URL;
            } else if (process.env.REPLIT_DEV_DOMAIN) {
                baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
            }
            const trackingPixelUrl = `${baseUrl}/api/proposals/track/${trackingToken}/pixel.gif`;
            const magicLinkUrl = `${baseUrl}/proposals/${trackingToken}`;

            await storage.createProposalEmailEvent({
                leadId,
                quoteId: latestQuote.id,
                token: trackingToken,
                recipientEmail: toEmail,
                recipientName: lead.contactName || lead.clientName || undefined,
                subject,
            });

            // Generate PDF
            const doc = generateEstimatePDF({ lead });
            const pdfChunks: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
                doc.on('data', (chunk: Buffer) => pdfChunks.push(chunk));
                doc.on('end', () => resolve());
                doc.on('error', reject);
                doc.end();
            });
            const pdfBuffer = Buffer.concat(pdfChunks);
            const pdfBase64 = pdfBuffer.toString('base64');
            const pdfFilename = `Scan2Plan_Proposal_${latestQuote.quoteNumber || 'Quote'}.pdf`;

            // Build email with tracking and PDF attachment
            const clientName = lead.contactName?.split(' ')[0] || 'there';
            const totalPrice = latestQuote.totalPrice ? formatCurrency(Number(latestQuote.totalPrice)) : '';

            const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">SCAN2PLAN</h1>
    <p style="color: #a0a0a0; margin: 5px 0 0 0; font-size: 14px;">Laser Scanning & BIM Documentation</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">Hi ${clientName},</p>
    
    <p>Thank you for considering Scan2Plan for your project. Please find attached our detailed proposal for <strong>${projectName}</strong>.</p>
    
    ${totalPrice ? `<div style="background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #666; font-size: 14px;">Total Investment</p>
      <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: bold; color: #1a1a2e;">${totalPrice}</p>
    </div>` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLinkUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Proposal Online</a>
    </div>
    
    <p>The PDF is also attached for your convenience. If you have any questions, feel free to reply to this email or call us directly.</p>
    
    <p style="margin-bottom: 0;">Best regards,<br><strong>The Scan2Plan Team</strong></p>
  </div>
  
  <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
    <p style="margin: 0;">Scan2Plan | Troy, NY | (518) 362-2403</p>
    <p style="margin: 5px 0 0 0;"><a href="mailto:admin@scan2plan.io" style="color: #2563eb;">admin@scan2plan.io</a></p>
  </div>
  
  <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display: none;" />
</body>
</html>`;

            const textBody = `Hi ${clientName},

Thank you for considering Scan2Plan for your project. Please find attached our detailed proposal for ${projectName}.

${totalPrice ? `Total Investment: ${totalPrice}` : ''}

View your proposal online: ${magicLinkUrl}

The PDF is also attached for your convenience. If you have any questions, feel free to reply to this email or call us directly.

Best regards,
The Scan2Plan Team

Scan2Plan | Troy, NY | (518) 362-2403 | admin@scan2plan.io`;

            const mixedBoundary = "----=_Mixed_" + Date.now().toString(36);
            const altBoundary = "----=_Alt_" + Date.now().toString(36);

            const email = [
                `To: ${toEmail}`,
                `Subject: ${subject}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
                '',
                `--${mixedBoundary}`,
                `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
                '',
                `--${altBoundary}`,
                'Content-Type: text/plain; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                textBody,
                '',
                `--${altBoundary}`,
                'Content-Type: text/html; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                htmlBody,
                '',
                `--${altBoundary}--`,
                '',
                `--${mixedBoundary}`,
                `Content-Type: application/pdf; name="${pdfFilename}"`,
                'Content-Transfer-Encoding: base64',
                `Content-Disposition: attachment; filename="${pdfFilename}"`,
                '',
                pdfBase64,
                '',
                `--${mixedBoundary}--`,
            ].join('\r\n');

            const encodedEmail = Buffer.from(email).toString('base64url');

            const gmail = await getGmailClient();
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw: encodedEmail },
            });

            log(`INFO: Proposal email with PDF sent for lead ${leadId} to ${toEmail} (token: ${trackingToken})`);

            res.json({
                success: true,
                messageId: response.data.id,
                threadId: response.data.threadId,
                sentTo: toEmail,
                subject,
                trackingToken,
                viewUrl: magicLinkUrl,
            });
        } catch (error: any) {
            log("ERROR: Proposal email send error - " + (error?.message || error));
            res.status(500).json({ message: error.message || "Failed to send proposal email" });
        }
    })
);
