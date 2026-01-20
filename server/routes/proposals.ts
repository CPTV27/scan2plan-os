import type { Express, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";
import { storage } from "../storage";
import { generateEstimatePDF } from "../pdf-generator";
import { db } from "../db";
import { projects } from "@shared/schema";
import { eq } from "drizzle-orm";

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
