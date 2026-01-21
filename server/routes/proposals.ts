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
import { cpqStorage } from "../storage/cpq";
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

  app.get("/api/proposals/:leadId/line-items", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const leadId = Number(req.params.leadId);
    if (Number.isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    let quote = await storage.getLatestCpqQuoteForLead(leadId);
    if (!quote) {
      const quotes = await storage.getCpqQuotesByLead(leadId);
      quote = quotes[0];
    }

    let proposalData = mapProposalData(lead, quote || null);

    if (!proposalData.lineItems.length) {
      const legacyQuotes = await cpqStorage.getQuotesByLeadId(leadId);
      const legacyQuote = legacyQuotes[0];
      if (legacyQuote) {
        proposalData = mapProposalData(lead, legacyQuote as any);
      }
    }

    res.json({
      lineItems: proposalData.lineItems,
      subtotal: proposalData.subtotal,
      total: proposalData.total,
    });
  }));

  // =====================================================
  // WYSIWYG Proposal Builder Endpoints
  // =====================================================

  /**
   * POST /api/proposals/:leadId/create
   *
   * Create a new proposal with all data pre-filled from Lead + Quote.
   * Returns the created proposal ready for WYSIWYG editing.
   */
  app.post("/api/proposals/:leadId/create", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    // 1. Fetch lead
    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // 2. Fetch latest quote
    const quotes = await storage.getCpqQuotesByLead(leadId);
    const quote = quotes.find(q => q.isLatest) || quotes[0] || null;

    // 3. Map data to proposal structure
    const proposalData = mapProposalData(lead, quote);

    // 4. Build WYSIWYG data structures
    const now = new Date();
    const dateFormatted = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).replace(/\//g, '/');

    // Build services line from areas/disciplines
    let servicesLine = "";
    if (quote?.areas && Array.isArray(quote.areas)) {
      const lodLevels = new Set<string>();
      const disciplines = new Set<string>();
      const services = new Set<string>();

      (quote.areas as any[]).forEach(area => {
        if (area.lodLevel) lodLevels.add(`LoD ${area.lodLevel}`);
        if (area.disciplines && Array.isArray(area.disciplines)) {
          area.disciplines.forEach((d: string) => {
            if (d.toLowerCase() !== 'architecture') {
              disciplines.add(d.toUpperCase());
            }
          });
        }
      });

      // Check for services
      const scopingData = quote.scopingData as any;
      if (scopingData?.matterport > 0) services.add("Matterport");
      if (scopingData?.photography > 0) services.add("Photography");

      const parts = [];
      if (lodLevels.size > 0) parts.push([...lodLevels].join(" + "));
      if (disciplines.size > 0) parts.push([...disciplines].join(" + "));
      if (services.size > 0) parts.push([...services].join(" + "));
      servicesLine = parts.join(" + ");
    }

    const coverData = {
      projectTitle: proposalData.projectTitle || "Project",
      projectAddress: proposalData.location || "",
      servicesLine: servicesLine || "Laser Scanning & BIM Modeling",
      clientName: proposalData.clientName || "",
      date: dateFormatted,
    };

    // Build scope items
    const scopeItems = [
      "End-to-end project management and customer service",
      "LiDAR Scan - A scanning technician will capture the building areas",
      "Registration - Point cloud data captured on-site will be registered, cleaned, and reviewed for quality assurance",
      "BIM Modeling - Revit model",
      "QA/QC - The entire project is redundantly reviewed and checked by our QC team and senior engineering staff",
    ];

    // Build deliverables
    const deliverables = [
      "Total Square Footage Audit",
      `Revit Model - ${proposalData.scope.lodLevels.map(l => `LoD ${l}`).join(' + ')}`,
      "Colorized Point Cloud including 360 images viewable in Autodesk Recap",
    ];

    // Add Matterport if applicable
    const scopingData = quote?.scopingData as any;
    if (scopingData?.matterport > 0) {
      deliverables.push("Matterport 3D Tour");
    }

    const projectData = {
      overview: `${proposalData.overview.buildingType} Service for ${proposalData.projectTitle}, ${proposalData.location}`,
      scopeItems,
      deliverables,
      timelineIntro: `Approximately ${proposalData.timeline.duration} from scan completion to delivery.`,
      milestones: [
        "~ Week 1 - Point Cloud, 3D Tour and Square Footage Audit",
        "~ Week 4 - Revit Model",
      ],
    };

    // Convert line items to WYSIWYG format
    const lineItems = proposalData.lineItems.map((item, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      itemName: item.item,
      description: item.description,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
    }));

    const paymentData = {
      terms: [
        "The price estimate is based on a square footage estimate. The total cost of the project will be determined by the actual square footage scanned and modeled. We use the BOMA 'Gross Area Standard Method' and will send a square footage audit approximately one week after scan completion.",
        "50% of the estimated cost will be due at the time of the client (\"Client\") engaging the Services.",
        "The first invoice will be for half of the estimated cost. The second invoice will be for the outstanding balance based on the total square footage scanned and modeled.",
      ],
      paymentMethods: [
        "ACH (Preferred Method)",
        "Check - Please mail check to Scan2Plan, 188 1st St., Troy, NY 12180",
      ],
      acknowledgementDate: now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
    };

    // 5. Check if proposal already exists for this lead
    const existingProposals = await db
      .select()
      .from(generatedProposals)
      .where(eq(generatedProposals.leadId, leadId))
      .orderBy(desc(generatedProposals.createdAt))
      .limit(1);

    let proposalId: number;

    if (existingProposals.length > 0) {
      // Update existing proposal
      const existing = existingProposals[0];
      await db
        .update(generatedProposals)
        .set({
          quoteId: quote?.id || null,
          coverData,
          projectData,
          lineItems,
          paymentData,
          subtotal: String(proposalData.subtotal),
          total: String(proposalData.total),
          updatedAt: now,
        })
        .where(eq(generatedProposals.id, existing.id));

      proposalId = existing.id;
      log(`INFO: Updated existing proposal ${proposalId} for lead ${leadId}`);
    } else {
      // Create new proposal
      const [newProposal] = await db
        .insert(generatedProposals)
        .values({
          leadId,
          quoteId: quote?.id || null,
          name: `Proposal - ${lead.projectName || lead.clientName}`,
          status: "draft",
          sections: [],
          coverData,
          projectData,
          lineItems,
          paymentData,
          subtotal: String(proposalData.subtotal),
          total: String(proposalData.total),
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      proposalId = newProposal.id;
      log(`INFO: Created new proposal ${proposalId} for lead ${leadId}`);
    }

    // 6. Fetch and return the proposal
    const [proposal] = await db
      .select()
      .from(generatedProposals)
      .where(eq(generatedProposals.id, proposalId));

    res.json(proposal);
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
   * If a saved WYSIWYG proposal exists, uses that data.
   * Otherwise, generates fresh from Lead + Quote data.
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

    // 3. Check for saved WYSIWYG proposal
    let proposalData;
    let customSections: any[] | undefined;

    try {
      const savedProposals = await db
        .select()
        .from(generatedProposals)
        .where(eq(generatedProposals.leadId, leadId))
        .orderBy(desc(generatedProposals.createdAt))
        .limit(1);

      if (savedProposals.length > 0) {
        const savedProposal = savedProposals[0] as any;

        // Check if this is a WYSIWYG proposal (has coverData)
        if (savedProposal.coverData && savedProposal.lineItems) {
          log(`INFO: Using saved WYSIWYG proposal data for lead ${leadId}`);

          // Build proposal data from saved WYSIWYG fields
          proposalData = {
            projectTitle: savedProposal.coverData.projectTitle || lead.projectName || lead.clientName || "Project",
            clientName: savedProposal.coverData.clientName || lead.clientName || "",
            date: savedProposal.coverData.date || new Date().toLocaleDateString("en-US"),
            location: savedProposal.coverData.projectAddress || lead.projectAddress || "",

            overview: {
              projectName: savedProposal.coverData.projectTitle || lead.projectName || "",
              address: savedProposal.coverData.projectAddress || lead.projectAddress || "",
              buildingType: lead.buildingType || "Commercial",
              sqft: Number(lead.sqft) || 0,
              description: savedProposal.projectData?.overview || "",
            },

            scope: {
              scopeSummary: savedProposal.projectData?.scopeItems?.join("; ") || "",
              disciplines: savedProposal.coverData.servicesLine || "",
              deliverables: savedProposal.projectData?.deliverables?.join(", ") || "Revit Model",
              lodLevels: [],
            },

            timeline: {
              duration: savedProposal.projectData?.timelineIntro || "4-6 weeks",
              milestones: savedProposal.projectData?.milestones || [],
            },

            lineItems: savedProposal.lineItems.map((item: any) => ({
              item: item.itemName,
              description: item.description,
              qty: item.qty,
              rate: item.rate,
              amount: item.amount,
            })),
            subtotal: Number(savedProposal.subtotal) || 0,
            total: Number(savedProposal.total) || 0,

            paymentTerms: {
              structure: savedProposal.paymentData?.terms?.[0] || "50% upfront, 50% upon delivery",
              upfrontAmount: (Number(savedProposal.total) || 0) * 0.5,
              totalAmount: Number(savedProposal.total) || 0,
              methods: savedProposal.paymentData?.paymentMethods || ["ACH", "Check"],
              terms: "Net 30",
            },
          };
        } else if (savedProposal.sections) {
          // Legacy: use custom sections approach
          const rawSections = savedProposal.sections as Array<{
            templateId: number;
            name: string;
            content: string;
            sortOrder: number;
            included: boolean;
          }>;

          proposalData = mapProposalData(lead, quote);

          customSections = rawSections
            .filter(s => s.included)
            .map(section => ({
              ...section,
              content: substituteVariables(section.content, lead, quote, proposalData),
            }));

          log(`INFO: Loaded ${customSections.length} custom sections for lead ${leadId}`);
        }
      }
    } catch (error: any) {
      log(`WARN: Could not fetch saved proposal: ${error?.message}`);
    }

    // 4. Fall back to fresh data if no saved proposal
    if (!proposalData) {
      proposalData = mapProposalData(lead, quote);
    }

    log(`INFO: Generating proposal PDF for lead ${leadId} (${lead.clientName})`);

    // 5. Generate PDF
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
