import { Router, Request, Response } from "express";
import { pandaDocClient } from "../lib/pandadoc-client";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { leads, cpqQuotes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { validatePandaDocSend } from "../validators/cpqValidator";

const router = Router();

// Create a PandaDoc document from a quote
router.post("/documents", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { quoteId, leadId } = req.body;
    
    if (!quoteId || !leadId) {
      return res.status(400).json({ error: "quoteId and leadId are required" });
    }
    
    // Get the quote
    const [quote] = await db.select().from(cpqQuotes).where(eq(cpqQuotes.id, quoteId));
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    
    // Get the lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    const validation = validatePandaDocSend(
      { leadId: quote.leadId },
      lead,
      req.body
    );
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        message: validation.errors[0]?.message,
      });
    }
    
    const recipientEmail = lead.contactEmail || lead.billingContactEmail || "";
    const recipientName = lead.contactName || lead.billingContactName || lead.clientName;
    
    // Parse line items from quote's pricingBreakdown
    const pricingBreakdown = quote.pricingBreakdown as any;
    const lineItems = pricingBreakdown?.lineItems || [];
    const pricingItems = lineItems
      .filter((item: any) => item.clientPrice && item.clientPrice > 0)
      .map((item: any) => ({
        name: item.label || "Service",
        description: item.description || "",
        price: Number(item.clientPrice) || 0,
        qty: 1,
      }));
    
    // Create document from template
    const templateId = process.env.PANDADOC_TEMPLATE_ID;
    
    if (!templateId) {
      return res.status(500).json({ error: "PandaDoc template ID not configured. Please set PANDADOC_TEMPLATE_ID environment variable." });
    }
    
    const nameParts = recipientName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    
    // Parse areas and disciplines from quote
    const areas = (quote.areas as any[]) || [];
    const disciplinesList = areas.flatMap((area: any) => area.disciplines || []);
    const uniqueDisciplines = Array.from(new Set(disciplinesList));
    const disciplineLabels: Record<string, string> = {
      arch: "Architectural",
      mepf: "MEP/F",
      struct: "Structural",
      civil: "Civil",
      facade: "Facade",
    };
    const formattedDisciplines = uniqueDisciplines
      .map((d: string) => disciplineLabels[d] || d)
      .join(", ");
    
    // Calculate total square footage
    const totalSqft = areas.reduce((sum: number, area: any) => 
      sum + (parseInt(area.squareFeet) || 0), 0);
    
    // Parse scope summary
    const scopingData = quote.scopingData as any;
    const scopeSummary = scopingData?.summary || "";
    
    // Parse risks
    const risks = (quote.risks as any[]) || [];
    const riskLabels = risks.map((r: any) => r.label || r.name).filter(Boolean).join(", ");
    
    // Travel info
    const travel = quote.travel as any;
    const travelDistance = travel?.distance || quote.distance || 0;
    const dispatchLocation = quote.dispatchLocation || "";
    
    // Get margin from pricing breakdown
    const marginPercent = pricingBreakdown?.marginPercentage 
      ? `${(Number(pricingBreakdown.marginPercentage) * 100).toFixed(1)}%` 
      : "";
    
    // Build comprehensive tokens
    const tokens = [
      { name: "client_name", value: lead.clientName || "" },
      { name: "client_company", value: lead.clientName || "" },
      { name: "contact_name", value: recipientName || "" },
      { name: "contact_email", value: recipientEmail || "" },
      { name: "project_name", value: lead.projectName || quote.projectName || "" },
      { name: "project_address", value: lead.projectAddress || quote.projectAddress || "" },
      { name: "quote_number", value: quote.quoteNumber || "" },
      { name: "total_price", value: `$${Number(quote.totalPrice || 0).toLocaleString()}` },
      { name: "total_cost", value: `$${Number(pricingBreakdown?.totalCost || 0).toLocaleString()}` },
      { name: "margin_percent", value: marginPercent },
      { name: "disciplines", value: formattedDisciplines },
      { name: "total_sqft", value: totalSqft.toLocaleString() },
      { name: "building_type", value: quote.typeOfBuilding || "" },
      { name: "scope_summary", value: scopeSummary },
      { name: "risks", value: riskLabels },
      { name: "travel_distance", value: `${travelDistance} miles` },
      { name: "dispatch_location", value: dispatchLocation },
      { name: "has_basement", value: quote.hasBasement ? "Yes" : "No" },
      { name: "has_attic", value: quote.hasAttic ? "Yes" : "No" },
      { name: "notes", value: quote.notes || "" },
      { name: "date", value: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
    ];
    
    const document = await pandaDocClient.createDocumentFromTemplate({
      templateId,
      name: `Proposal - ${lead.projectName || lead.clientName}`,
      recipients: [{
        email: recipientEmail,
        first_name: firstName,
        last_name: lastName,
        role: "Client",
      }],
      tokens,
      pricingTables: pricingItems.length > 0 ? [{
        name: "Pricing",
        items: pricingItems,
      }] : undefined,
      metadata: {
        lead_id: String(leadId),
        quote_id: String(quoteId),
      },
    });
    
    // Update lead with pandaDocId
    await db.update(leads)
      .set({ pandaDocId: document.id })
      .where(eq(leads.id, leadId));
    
    res.status(201).json(document);
  } catch (error) {
    console.error("Create PandaDoc document error:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.get("/status", async (req: Request, res: Response) => {
  try {
    const isConfigured = pandaDocClient.isConfigured();
    const stats = await pandaDocClient.getStats();
    res.json({ 
      configured: isConfigured,
      ...stats,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/batches", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const batches = await pandaDocClient.getBatches();
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/batches", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const userId = (req.user as any)?.id;
    const batch = await pandaDocClient.createImportBatch(name, userId);
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/batches/:batchId/start", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId);
    const { dateFrom, dateTo } = req.body;
    
    const result = await pandaDocClient.startImport(batchId, {
      dateFrom,
      dateTo,
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/batches/:batchId/documents", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId);
    const documents = await pandaDocClient.getBatchDocuments(batchId);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/documents", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const documents = await pandaDocClient.getAllDocuments(status as string);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/documents/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const document = await pandaDocClient.getDocument(id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/documents/:id/process", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const document = await pandaDocClient.processDocument(id);
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/documents/:id/approve", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { editedData, reviewNotes } = req.body;
    const userId = (req.user as any)?.id || "system";
    
    const result = await pandaDocClient.approveDocument(id, userId, editedData, reviewNotes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/documents/:id/reject", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { reviewNotes } = req.body;
    const userId = (req.user as any)?.id || "system";
    
    const document = await pandaDocClient.rejectDocument(id, userId, reviewNotes);
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/sync", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.body;
    const userId = (req.user as any)?.id;
    
    const batch = await pandaDocClient.createImportBatch(
      `Sync ${new Date().toISOString()}`,
      userId
    );
    
    const result = await pandaDocClient.startImport(batch.id, {
      dateFrom,
      dateTo,
    });
    
    res.json({ batch, ...result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/process-all-pending", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const documents = await pandaDocClient.getAllDocuments("pending");
    const results = [];
    
    for (const doc of documents) {
      try {
        const processed = await pandaDocClient.processDocument(doc.id);
        results.push({ id: doc.id, status: "success", document: processed });
      } catch (error) {
        results.push({ id: doc.id, status: "error", error: String(error) });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    res.json({ processed: results.length, results });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/documents/:id/pdf", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const document = await pandaDocClient.getDocument(id);
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    const pdfBuffer = await pandaDocClient.downloadPdfById(document.pandaDocId);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${document.pandaDocName || "document"}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF proxy error:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.post("/create-from-template", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { templateId, name, recipients, tokens, metadata, pricingTables } = req.body;
    
    if (!templateId || !name || !recipients || recipients.length === 0) {
      return res.status(400).json({ error: "templateId, name, and at least one recipient are required" });
    }
    
    const document = await pandaDocClient.createDocumentFromTemplate({
      templateId,
      name,
      recipients,
      tokens,
      metadata,
      pricingTables,
    });
    
    res.json(document);
  } catch (error) {
    console.error("Create document error:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.post("/documents/:pandaDocId/editing-session", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { pandaDocId } = req.params;
    
    const session = await pandaDocClient.createDocumentEditingSession(pandaDocId);
    res.json(session);
  } catch (error) {
    console.error("Create editing session error:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.post("/documents/:pandaDocId/send", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { pandaDocId } = req.params;
    const { message, subject } = req.body;
    
    const result = await pandaDocClient.sendDocument(pandaDocId, message, subject);
    res.json(result);
  } catch (error) {
    console.error("Send document error:", error);
    res.status(500).json({ error: String(error) });
  }
});

router.get("/documents/:pandaDocId/status", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { pandaDocId } = req.params;
    
    const status = await pandaDocClient.getDocumentStatus(pandaDocId);
    res.json(status);
  } catch (error) {
    console.error("Get document status error:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
