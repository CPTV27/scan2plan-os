import type { Express, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";
import { storage } from "../storage";
import { generateEstimatePDF } from "../pdf-generator";
import { generateProposalPDF } from "../pdf/proposalGenerator";
import { mapProposalData } from "../lib/proposalDataMapper";
import { substituteVariables } from "../lib/variableSubstitution";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { projects, generatedProposals } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export function registerProposalRoutes(app: Express): void {
  app.get("/api/proposals/track/:token/pixel.gif", asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    try {
      await storage.recordProposalOpen(token);
      log(`INFO: Proposal email opened via pixel - token: ${token}`);
    } catch (error: any) {
      log(`WARN: Failed to record proposal open: ${error?.message}`);
    }

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': TRANSPARENT_GIF.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.send(TRANSPARENT_GIF);
  }));

  app.get("/api/proposals/track/:token", asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const event = await storage.getProposalEmailEventByToken(token);
    if (!event) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    try {
      await storage.recordProposalClick(token);
      log(`INFO: Proposal magic link clicked - token: ${token}`);
    } catch (error: any) {
      log(`WARN: Failed to record proposal click: ${error?.message}`);
    }

    res.redirect(`/proposals/${token}`);
  }));

  app.get("/api/proposals/:token", asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const event = await storage.getProposalEmailEventByToken(token);
    if (!event) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    const lead = await storage.getLead(event.leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const quotes = await storage.getCpqQuotesByLead(event.leadId);
    const quote = event.quoteId
      ? quotes.find(q => q.id === event.quoteId)
      : quotes.find(q => q.isLatest) || quotes[quotes.length - 1];

    const [project] = await db.select().from(projects).where(eq(projects.leadId, event.leadId)).limit(1);

    res.json({
      lead: {
        id: lead.id,
        clientName: lead.clientName,
        projectName: lead.projectName,
        projectAddress: lead.projectAddress,
        contactName: lead.contactName,
      },
      quote: quote ? {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        totalPrice: quote.totalPrice,
        createdAt: quote.createdAt,
        paymentTerms: quote.paymentTerms,
        areas: quote.areas,
        pricingBreakdown: quote.pricingBreakdown,
      } : null,
      sentAt: event.sentAt,
      recipientEmail: event.recipientEmail,
      recipientName: event.recipientName,
      has3DModel: !!(project?.potreePath),
    });
  }));

  app.get("/api/proposals/:token/pdf", asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const event = await storage.getProposalEmailEventByToken(token);
    if (!event) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    const lead = await storage.getLead(event.leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const doc = generateEstimatePDF({ lead });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Scan2Plan_Proposal.pdf"`);

    doc.pipe(res);
    doc.end();
  }));

  app.get("/api/leads/:leadId/proposal-emails", asyncHandler(async (req: Request, res: Response) => {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const events = await storage.getProposalEmailEventsByLead(leadId);
    res.json(events);
  }));

  // =====================================================
  // PHASE 2: Proposal Builder PDF Generation Endpoints
  // =====================================================

  /**
   * POST /api/proposals/:leadId/generate-pdf
   * 
   * Generate proposal PDF using the new 9-page professional format.
   * Streams the PDF to browser for download.
   * 
   * Supports Phase 5 variable substitution for customized sections.
   */
  app.post("/api/proposals/:leadId/generate-pdf", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    // 1. Fetch lead
    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // 2. Fetch latest quote for this lead
    const quotes = await storage.getCpqQuotesByLead(leadId);
    const quote = quotes.find(q => q.isLatest) || quotes[0] || null;

    // 3. Map data to proposal structure
    const proposalData = mapProposalData(lead, quote);

    // 4. Fetch saved proposal with custom sections (if exists)
    let customSections: any[] | undefined;
    try {
      const savedProposals = await db
        .select()
        .from(generatedProposals)
        .where(eq(generatedProposals.leadId, leadId))
        .orderBy(desc(generatedProposals.createdAt))
        .limit(1);

      if (savedProposals.length > 0 && savedProposals[0].sections) {
        const rawSections = savedProposals[0].sections as Array<{
          templateId: number;
          name: string;
          content: string;
          sortOrder: number;
          included: boolean;
        }>;

        // Apply variable substitution to each section's content
        customSections = rawSections
          .filter(s => s.included)
          .map(section => ({
            ...section,
            content: substituteVariables(section.content, lead, quote, proposalData),
          }));

        log(`INFO: Loaded ${customSections.length} custom sections for lead ${leadId}`);
      }
    } catch (error: any) {
      log(`WARN: Could not fetch saved proposal: ${error?.message}`);
      // Continue without custom sections
    }

    log(`INFO: Generating proposal PDF for lead ${leadId} (${lead.clientName})`);

    // 5. Generate PDF (with custom sections if available)
    const pdfDoc = await generateProposalPDF(proposalData, customSections);

    // 6. Stream to response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="Scan2Plan_Proposal_${lead.clientName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Client'}.pdf"`);

    pdfDoc.pipe(res);
    pdfDoc.end();
  }));

  /**
   * POST /api/proposals/:leadId/send
   * 
   * Generate proposal PDF, update lead status to "Proposal", 
   * create a proposal email tracking event, and return success.
   */
  app.post("/api/proposals/:leadId/send", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    // 1. Fetch lead
    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // 2. Fetch latest quote for this lead
    const quotes = await storage.getCpqQuotesByLead(leadId);
    const quote = quotes.find(q => q.isLatest) || quotes[0] || null;

    // 3. Map data to proposal structure
    const proposalData = mapProposalData(lead, quote);

    log(`INFO: Generating and sending proposal for lead ${leadId} (${lead.clientName})`);

    // 4. Generate PDF to buffer to get size
    const pdfDoc = await generateProposalPDF(proposalData);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve());
      pdfDoc.on('error', (err: Error) => reject(err));
      pdfDoc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const pdfSize = pdfBuffer.length;

    // 5. Update lead status to "Proposal"
    await storage.updateLead(leadId, {
      dealStage: "Proposal",
      lastContactDate: new Date()
    });

    // 6. Create proposal email tracking event
    const token = crypto.randomBytes(32).toString('hex');

    try {
      await storage.createProposalEmailEvent({
        leadId,
        quoteId: quote?.id || null,
        token,
        recipientEmail: lead.contactEmail || '',
        recipientName: lead.contactName || lead.clientName || '',
      });
      log(`INFO: Proposal email event created for lead ${leadId} with token ${token.substring(0, 8)}...`);
    } catch (error: any) {
      log(`WARN: Failed to create proposal email event: ${error?.message}`);
      // Continue anyway - PDF was generated successfully
    }

    log(`INFO: Proposal sent successfully for lead ${leadId} - PDF size: ${Math.round(pdfSize / 1024)}KB`);

    // 7. Return success response
    res.json({
      success: true,
      message: "Proposal sent successfully",
      pdfSize,
      token,
      leadStatus: "Proposal"
    });
  }));

  // Public Potree Proxy for Proposals
  app.get("/api/proposals/public/:token/potree/*", asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const filePath = req.params[0];

    if (!filePath) {
      return res.status(400).json({ error: "File path required" });
    }

    // 1. Verify Token
    const event = await storage.getProposalEmailEventByToken(token);
    if (!event) {
      return res.status(404).json({ error: "Invalid proposal token" });
    }

    // 2. Find Project for this Lead
    const [project] = await db.select().from(projects).where(eq(projects.leadId, event.leadId)).limit(1);

    if (!project || !project.potreePath) {
      return res.status(404).json({ error: "3D model not available for this proposal" });
    }

    // 3. Proxy GCS Stream
    const gcsPath = `${project.potreePath}/${filePath}`;

    try {
      const { streamGcsFile } = await import("../lib/gcs.js");
      const stream = await streamGcsFile(gcsPath);

      if (!stream) {
        return res.status(404).json({ error: "File not found" });
      }

      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        'json': 'application/json',
        'bin': 'application/octet-stream',
        'las': 'application/octet-stream',
        'laz': 'application/octet-stream',
        'html': 'text/html',
        'js': 'application/javascript',
        'css': 'text/css',
      };

      res.setHeader('Content-Type', contentTypes[ext || ''] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      stream.pipe(res);
    } catch (err) {
      log(`ERROR: Public Potree proxy error - ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream file" });
      }
    }
  }));
}
