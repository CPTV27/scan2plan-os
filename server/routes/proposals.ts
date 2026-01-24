import type { Express, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";
import { storage } from "../storage";
import { generateEstimatePDF } from "../pdf-generator";
import { generateProposalPDF } from "../pdf/proposalGenerator";
import { generateWYSIWYGPdf, type WYSIWYGProposalData } from "../pdf/wysiwygPdfGenerator";
import { mapProposalData } from "../lib/proposalDataMapper";
import { substituteVariables } from "../lib/variableSubstitution";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { cpqStorage } from "../storage/cpq";
import { projects, generatedProposals } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

/**
 * Generate a sanitized PDF filename for proposals.
 * Format: [Date]-[Company]-[Address].pdf
 * Example: 2025-01-24-Acme_Corp-123_Main_St.pdf
 */
function generateProposalFilename(
  companyName?: string | null,
  projectAddress?: string | null,
  date?: string | null
): string {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const parts: string[] = [];

  // Date first (YYYY-MM-DD format for sorting)
  if (date) {
    const dateMatch = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dateMatch) {
      const [, month, day, year] = dateMatch;
      const fullYear = year.length === 2 ? `20${year}` : year;
      parts.push(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    } else {
      // Try to parse other date formats
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        parts.push(parsed.toISOString().split('T')[0]);
      } else {
        parts.push(sanitize(date));
      }
    }
  } else {
    // Default to today's date
    parts.push(new Date().toISOString().split('T')[0]);
  }

  // Company name second
  if (companyName) {
    parts.push(sanitize(companyName));
  }

  // Address third (extract street address, not full address with city/state)
  if (projectAddress) {
    // Get street address (first part before comma, or first line)
    const streetMatch = projectAddress.match(/^([^,\n]+)/);
    if (streetMatch) {
      parts.push(sanitize(streetMatch[1].trim()));
    }
  }

  return `${parts.join('-')}.pdf`;
}

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

    const quotes = await cpqStorage.getQuotesByLeadId(event.leadId);
    const quote = event.quoteId
      ? quotes.find(q => String(q.id) === String(event.quoteId))
      : quotes.find(q => (q as any).isLatest) || quotes[quotes.length - 1];

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
        paymentTerms: (quote as any).paymentTerms,
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

    const filename = generateProposalFilename(
      lead.projectName,
      lead.projectAddress,
      new Date().toLocaleDateString('en-US')
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

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

    let quote: any = await storage.getLatestCpqQuoteForLead(leadId);
    if (!quote) {
      const quotes = await cpqStorage.getQuotesByLeadId(leadId);
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

    // 2. Fetch quote - use specific quoteId if provided, otherwise latest
    const quotes = await cpqStorage.getQuotesByLeadId(leadId);
    const requestedQuoteId = req.body?.quoteId;
    let quote: any = null;

    if (requestedQuoteId) {
      // Use specific quote by ID
      quote = quotes.find((q: any) => q.id === requestedQuoteId) || null;
      log(`INFO: Using requested quote ${requestedQuoteId} for proposal`);
    }

    if (!quote) {
      // Fall back to latest quote
      quote = quotes.find((q: any) => q.isLatest) || quotes[0] || null;
    }

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
      let highestLod = 0;
      const disciplines = new Set<string>();
      const services = new Set<string>();

      (quote.areas as any[]).forEach(area => {
        // Extract LoD from disciplineLods - use architecture LoD as the primary one
        if (area.disciplineLods && typeof area.disciplineLods === 'object') {
          // Prefer architecture LoD as the main display value
          const archLod = area.disciplineLods["architecture"];
          if (archLod) {
            const lodNum = parseInt(String(archLod), 10);
            if (!isNaN(lodNum) && lodNum > highestLod) {
              highestLod = lodNum;
            }
          } else {
            // Fall back to first non-matterport discipline LoD
            Object.entries(area.disciplineLods).forEach(([key, lod]: [string, any]) => {
              if (key !== 'matterport' && lod) {
                const lodNum = parseInt(String(lod), 10);
                if (!isNaN(lodNum) && lodNum > highestLod) {
                  highestLod = lodNum;
                }
              }
            });
          }
        }
        // Also check gradeLod as fallback
        if (area.gradeLod && highestLod === 0) {
          const lodNum = parseInt(String(area.gradeLod), 10);
          if (!isNaN(lodNum) && lodNum > highestLod) {
            highestLod = lodNum;
          }
        }
        // Extract disciplines (excluding architecture which is implied)
        if (area.disciplines && Array.isArray(area.disciplines)) {
          area.disciplines.forEach((d: string) => {
            const lower = d.toLowerCase();
            if (lower === 'matterport') {
              // Matterport in disciplines means it's selected
              services.add("Matterport 3D Tour");
            } else if (lower !== 'architecture') {
              // Map common discipline IDs to display names
              const displayName = lower === 'mepf' ? 'MEPF' :
                                  lower === 'structural' ? 'Structural' :
                                  lower === 'structure' ? 'Structural' :
                                  lower === 'site' ? 'Site' :
                                  d.toUpperCase();
              disciplines.add(displayName);
            }
          });
        }
      });

      // Also check scopingData for services
      const scopingData = quote.scopingData as any;
      if (scopingData?.matterport > 0) services.add("Matterport 3D Tour");
      if (scopingData?.photography > 0) services.add("Photography");

      // Build the services line: "LoD 350 + MEPF + Structural + Matterport 3D Tour"
      const parts = [];
      if (highestLod > 0) {
        parts.push(`LoD ${highestLod}`);
      }
      if (disciplines.size > 0) parts.push([...disciplines].join(' + '));
      if (services.size > 0) parts.push([...services].join(' + '));
      servicesLine = parts.join(' + ');

      // Log quote area data for debugging
      const firstArea = (quote.areas as any[])?.[0];
      log(`DEBUG: Quote area data - gradeLod=${firstArea?.gradeLod} disciplineLods=${JSON.stringify(firstArea?.disciplineLods)}`);
      log(`DEBUG: Built servicesLine="${servicesLine}" from highestLod=${highestLod} disciplines=[${[...disciplines]}] services=[${[...services]}]`);
    }

    // Split address into street and city/state/zip
    // IMPORTANT: projectTitle should be the actual address, NOT client name or project name
    const fullAddress = proposalData.location || "";
    const addressParts = fullAddress.split(",").map(p => p.trim()).filter(Boolean);
    // Only use address parts - don't fall back to project title (which could be client name)
    let streetAddress = addressParts[0] || fullAddress || "";
    const cityStateZip = addressParts.slice(1).join(", ") || "";

    // Add scope note to street address if partial scope
    const scopeNote = proposalData.scope?.scopeSummary?.toLowerCase();
    const isPartial = scopeNote && (
      scopeNote.includes("partial") ||
      scopeNote.includes("interior") ||
      scopeNote.includes("exterior")
    );
    if (isPartial && !streetAddress.toLowerCase().includes("partial")) {
      const scopeLabel = scopeNote.includes("interior") ? "interior only" :
                        scopeNote.includes("exterior") ? "exterior only" :
                        "partial building";
      streetAddress = `${streetAddress} (${scopeLabel})`;
    }

    const coverData = {
      projectTitle: streetAddress,
      projectAddress: cityStateZip,
      servicesLine: servicesLine || "Laser Scanning & BIM Modeling",
      areaScopeLines: proposalData.scope?.areaScopeLines || [],
      clientName: proposalData.clientName || "",
      date: dateFormatted,
    };

    // Build scope items
    const scopeItems = [
      "End-to-end project management and customer service",
      "LiDAR Scan - A scanning technician will capture the interior and exterior of the residence, cottage and grounds.",
      "Registration - Point cloud data captured on-site will be registered, cleaned, and reviewed for quality assurance",
      "BIM Modeling - Revit model",
      "QA/QC - The entire project is redundantly reviewed and checked by our QC team and senior engineering staff",
    ];

    // Determine service type (Commercial vs Residential)
    const buildingType = proposalData.overview.buildingType || lead.buildingType || "Commercial";
    const isResidential = buildingType.toLowerCase().includes("residential");
    const serviceType = isResidential ? "Residential" : "Commercial";

    // Check for Matterport
    const scopingData = quote?.scopingData as any;
    const hasMatterport = scopingData?.matterport > 0 || servicesLine.toLowerCase().includes("matterport");

    // Build Revit Model deliverable line with LoD and disciplines
    // Use servicesLine but remove Matterport 3D Tour since that's a separate deliverable
    const revitModelLine = servicesLine
      .replace(/\s*\+?\s*Matterport 3D Tour\s*\+?/gi, '')
      .replace(/\+\s*$/, '')
      .replace(/^\s*\+\s*/, '')
      .trim();

    // Build deliverables
    const deliverables = [
      "Total Square Footage Audit",
      `Revit Model - ${revitModelLine || proposalData.scope.lodLevels.map(l => `LoD ${l}`).join(' + ')}`,
      "Colorized Point Cloud including 360 images viewable in Autodesk Recap or Trimble ScanExplorer",
    ];

    // Add Matterport to scope and deliverables if applicable
    if (hasMatterport) {
      const matterportScopeText = isResidential
        ? "Matterport Scan - A scanning technician will capture the interior of the residence."
        : "Matterport Scan - A scanning technician will capture the interior of the property.";
      scopeItems.push(matterportScopeText);
      deliverables.push("Matterport 3D Tour");
    }

    const projectData = {
      serviceType: serviceType as "Commercial" | "Residential",
      hasMatterport,
      overview: `${proposalData.projectTitle}, ${proposalData.location}`,
      overviewLine: `Service for ${proposalData.projectTitle}, ${proposalData.location}`,
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
      qty: Number(item.qty) || 0,
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
      .orderBy(desc(generatedProposals.version));

    const createNewVersion = req.body?.createNewVersion === true;
    let proposalId: number;

    // Quote IDs from cpqStorage are UUIDs (strings), but generatedProposals.quoteId expects integer
    // Set to null for UUID quotes since they're stored in a different table
    const quoteIdForProposal = quote?.id && typeof quote.id === 'number' ? quote.id : null;

    if (existingProposals.length > 0 && !createNewVersion) {
      // Update existing proposal (most recent version)
      const existing = existingProposals[0];
      await db
        .update(generatedProposals)
        .set({
          quoteId: quoteIdForProposal,
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
      // Create new proposal (new version)
      const nextVersion = existingProposals.length > 0
        ? Math.max(...existingProposals.map(p => p.version || 1)) + 1
        : 1;

      // Build proposal name with quote number if available
      const quoteLabel = quote?.quoteNumber ? ` (${quote.quoteNumber})` : "";
      const proposalName = `Proposal - ${lead.projectName || lead.clientName}${quoteLabel}`;

      const [newProposal] = await db
        .insert(generatedProposals)
        .values({
          leadId,
          quoteId: quoteIdForProposal,
          name: proposalName,
          version: nextVersion,
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
      log(`INFO: Created new proposal ${proposalId} (v${nextVersion}) for lead ${leadId}`);
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
    const quotes = await cpqStorage.getQuotesByLeadId(leadId);
    const quote: any = quotes.find((q: any) => q.isLatest) || quotes[0] || null;

    // 3. Check for saved WYSIWYG proposal
    try {
      const savedProposals = await db
        .select()
        .from(generatedProposals)
        .where(eq(generatedProposals.leadId, leadId))
        .orderBy(desc(generatedProposals.createdAt))
        .limit(1);

      if (savedProposals.length > 0) {
        const savedProposal = savedProposals[0] as any;

        // Check if this is a WYSIWYG proposal (has coverData and lineItems)
        if (savedProposal.coverData && savedProposal.lineItems) {
          log(`INFO: Using new WYSIWYG PDF generator for lead ${leadId}`);

          // Build WYSIWYG proposal data directly from saved fields
          const wysiwygData: WYSIWYGProposalData = {
            id: savedProposal.id,
            leadId: leadId,
            coverData: savedProposal.coverData,
            projectData: savedProposal.projectData || {
              serviceType: "Commercial",
              hasMatterport: false,
              overview: "",
              scopeItems: [],
              deliverables: [],
              timelineIntro: "",
              milestones: [],
            },
            lineItems: savedProposal.lineItems,
            paymentData: savedProposal.paymentData || {
              terms: [],
              paymentMethods: [],
              acknowledgementDate: "",
            },
            subtotal: Number(savedProposal.subtotal) || 0,
            total: Number(savedProposal.total) || 0,
          };

          // Generate PDF using new WYSIWYG-matched generator
          const pdfDoc = await generateWYSIWYGPdf(wysiwygData);

          const coverData = wysiwygData.coverData as any;
          const filename = generateProposalFilename(
            coverData?.projectTitle || lead.projectName,
            coverData?.projectAddress || lead.projectAddress,
            coverData?.date
          );

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

          pdfDoc.pipe(res);
          pdfDoc.end();
          return;
        }
      }
    } catch (error: any) {
      log(`WARN: Could not fetch saved proposal, falling back to legacy generator: ${error?.message}`);
    }

    // 4. Fall back to legacy generator if no WYSIWYG proposal found
    log(`INFO: Using legacy PDF generator for lead ${leadId}`);
    const proposalData = mapProposalData(lead, quote);
    const pdfDoc = await generateProposalPDF(proposalData);

    const legacyFilename = generateProposalFilename(
      lead.projectName,
      lead.projectAddress,
      new Date().toLocaleDateString('en-US')
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${legacyFilename}"`);

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
    const quotes = await cpqStorage.getQuotesByLeadId(leadId);
    const quote: any = quotes.find((q: any) => q.isLatest) || quotes[0] || null;

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
