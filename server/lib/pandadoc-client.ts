import { db } from "../db";
import { 
  pandaDocImportBatches, 
  pandaDocDocuments, 
  cpqQuotes,
  leads,
  type PandaDocDocument,
  type InsertPandaDocDocument,
  type PandaDocImportBatch,
  type InsertPandaDocImportBatch,
  PANDADOC_STATUS_MAP,
  type PandaDocStage,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import OpenAI from "openai";
import { extractProposalData, convertVisionToExtractedData } from "./proposal-vision";
import { log } from "./logger";

// pdf-parse is a CJS-only package
// In ESM (dev), use dynamic import. In CJS (prod), esbuild bundles it directly.
let pdfParse: any;
async function getPdfParse() {
  if (!pdfParse) {
    // Dynamic import with interop for CJS default export
    const mod = await import("pdf-parse") as any;
    pdfParse = mod.default || mod;
  }
  return pdfParse;
}

const PANDADOC_STATUS_TO_CODE: Record<string, number> = {
  "document.draft": 0,
  "document.sent": 1,
  "document.completed": 2,
  "document.uploaded": 3,
  "document.error": 4,
  "document.viewed": 5,
  "document.waiting_approval": 6,
  "document.approved": 7,
  "document.rejected": 8,
  "document.waiting_pay": 9,
  "document.paid": 10,
  "document.voided": 11,
  "document.declined": 12,
};

function mapStatusTextToStage(statusText: string): PandaDocStage {
  const code = PANDADOC_STATUS_TO_CODE[statusText];
  if (code === undefined) return "unknown";
  return PANDADOC_STATUS_MAP[code] || "unknown";
}

function mapStatusTextToCode(statusText: string): number | null {
  return PANDADOC_STATUS_TO_CODE[statusText] ?? null;
}

const PANDADOC_API_BASE = "https://api.pandadoc.com/public/v1";

interface PandaDocListResponse {
  results: PandaDocListItem[];
  next?: string;
}

interface PandaDocListItem {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
  version: string;
}

interface PandaDocDetailsResponse {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
  version: string;
  recipients?: Array<{
    email: string;
    first_name: string;
    last_name: string;
    company?: string;
  }>;
  tokens?: Array<{
    name: string;
    value: string;
  }>;
  pricing?: {
    tables: Array<{
      name: string;
      total: number;
      items: Array<{
        name: string;
        description?: string;
        price?: number;
        qty?: number;
        discount?: number;
        subtotal?: number;
      }>;
    }>;
  };
  fields?: Record<string, any>;
  metadata?: Record<string, any>;
  grand_total?: {
    amount: number;
    currency: string;
  };
}

interface ExtractedLineItem {
  name: string;
  description?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
}

interface ExtractedQuoteData {
  projectName?: string;
  clientName?: string;
  projectAddress?: string;
  totalPrice?: number;
  currency?: string;
  areas?: Array<{
    name: string;
    sqft?: number;
    buildingType?: string;
    price?: number;
  }>;
  services?: Array<{
    name: string;
    description?: string;
    price?: number;
    quantity?: number;
    rate?: number;
    unit?: string;
    confidence?: number;
  }>;
  lineItems?: ExtractedLineItem[];
  contacts?: Array<{
    name: string;
    email?: string;
    company?: string;
  }>;
  variables?: Record<string, string>;
  confidence: number;
  unmappedFields?: string[];
  rawPdfText?: string;
  estimateNumber?: string;
  estimateDate?: string;
  extractionNotes?: string[];
  subtotal?: number;
  tax?: number;
  discount?: number;
}

export class PandaDocClient {
  private apiKey: string;
  private openai: OpenAI | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PANDADOC_API_KEY || "";
    if (!this.apiKey) {
      console.warn("PandaDoc API key not configured");
    }
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.apiKey) {
      throw new Error("PandaDoc API key not configured");
    }

    const response = await fetch(`${PANDADOC_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `API-Key ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PandaDoc API error: ${response.status} - ${error}`);
    }

    return response;
  }

  async listDocuments(params: {
    createdFrom?: string;
    createdTo?: string;
    page?: number;
    count?: number;
  } = {}): Promise<PandaDocListResponse> {
    const queryParams = new URLSearchParams();
    if (params.createdFrom) queryParams.set("date_from", params.createdFrom);
    if (params.createdTo) queryParams.set("date_to", params.createdTo);
    if (params.page) queryParams.set("page", params.page.toString());
    queryParams.set("count", (params.count || 50).toString());

    const response = await this.fetch(`/documents?${queryParams.toString()}`);
    return response.json();
  }

  async getDocumentDetails(documentId: string): Promise<PandaDocDetailsResponse> {
    const response = await this.fetch(`/documents/${documentId}/details`);
    return response.json();
  }

  async getDocumentPdfUrl(documentId: string): Promise<string> {
    return `${PANDADOC_API_BASE}/documents/${documentId}/download`;
  }

  async downloadPdf(documentId: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error("PandaDoc API key not configured");
    }

    const response = await fetch(`${PANDADOC_API_BASE}/documents/${documentId}/download`, {
      headers: {
        "Authorization": `API-Key ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`PDF download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async downloadPdfById(pandaDocId: string): Promise<Buffer> {
    return this.downloadPdf(pandaDocId);
  }

  /**
   * Create a document from a template with pre-filled data
   */
  async createDocumentFromTemplate(params: {
    templateId: string;
    name: string;
    recipients: Array<{
      email: string;
      first_name?: string;
      last_name?: string;
      role?: string;
    }>;
    tokens?: Array<{ name: string; value: string }>;
    metadata?: Record<string, string>;
    pricingTables?: Array<{
      name: string;
      items: Array<{
        name: string;
        description?: string;
        price: number;
        qty?: number;
      }>;
    }>;
  }): Promise<{ id: string; status: string }> {
    const body: any = {
      name: params.name,
      template_uuid: params.templateId,
      recipients: params.recipients.map(r => ({
        email: r.email,
        first_name: r.first_name || "",
        last_name: r.last_name || "",
        role: r.role || "Signer",
      })),
    };
    
    if (params.tokens) {
      body.tokens = params.tokens;
    }
    if (params.metadata) {
      body.metadata = params.metadata;
    }
    if (params.pricingTables) {
      body.pricing_tables = params.pricingTables.map(table => ({
        name: table.name,
        options: { currency: "USD" },
        sections: [{
          title: "Services",
          default: true,
          rows: table.items.map(item => ({
            options: { optional: false, optional_selected: false },
            data: {
              name: item.name,
              description: item.description || "",
              price: item.price,
              qty: item.qty || 1,
            },
          })),
        }],
      }));
    }
    
    const response = await this.fetch("/documents", {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    return response.json();
  }

  /**
   * Create an editing session for a document (returns E-Token for embedded editing)
   */
  async createDocumentEditingSession(documentId: string): Promise<{ token: string; expires_at: string }> {
    const response = await this.fetch(`/documents/${documentId}/editing-sessions`, {
      method: "POST",
    });
    
    return response.json();
  }

  /**
   * Create a signing session for a document (returns link for embedded signing)
   */
  async createDocumentSession(documentId: string, recipientEmail: string): Promise<{ id: string; expires_at: string }> {
    const response = await this.fetch(`/documents/${documentId}/session`, {
      method: "POST",
      body: JSON.stringify({ recipient: recipientEmail }),
    });
    
    return response.json();
  }

  /**
   * Send a document for signing
   */
  async sendDocument(documentId: string, message?: string, subject?: string): Promise<{ id: string; status: string }> {
    const body: any = {};
    if (message) body.message = message;
    if (subject) body.subject = subject;
    
    const response = await this.fetch(`/documents/${documentId}/send`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    return response.json();
  }

  /**
   * Get document status
   */
  async getDocumentStatus(documentId: string): Promise<{ id: string; name: string; status: string; date_created: string; date_modified: string }> {
    const response = await this.fetch(`/documents/${documentId}`);
    return response.json();
  }

  async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    try {
      const parser = await getPdfParse();
      const data = await parser(pdfBuffer);
      return data.text;
    } catch (error) {
      console.error("PDF text extraction failed:", error);
      return "";
    }
  }

  parsePricingFromText(text: string): { 
    lineItems: ExtractedLineItem[]; 
    total: number; 
    estimateNumber?: string;
    estimateDate?: string;
  } {
    const lineItems: ExtractedLineItem[] = [];
    let total = 0;
    let estimateNumber: string | undefined;
    let estimateDate: string | undefined;

    const estimateMatch = text.match(/ESTIMATE\s+(\d+)/i);
    if (estimateMatch) {
      estimateNumber = estimateMatch[1];
    }

    const dateMatch = text.match(/DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dateMatch) {
      estimateDate = dateMatch[1];
    }

    const totalMatch = text.match(/TOTAL\s+\$?([\d,]+\.?\d*)/i);
    if (totalMatch) {
      total = parseFloat(totalMatch[1].replace(/,/g, ""));
    }

    const servicePatterns = [
      /Scan2Plan\s+(Residential|Commercial)\s*[-–]?\s*(LoD\s*\d+)?/gi,
      /MEPF\s+LoD\s*\d+/gi,
      /Structural\s+Modeling\s*[-–]?\s*LoD\s*\d+/gi,
      /CAD\s+Standard\s+Package/gi,
    ];

    const lines = text.split("\n");
    let currentService: Partial<ExtractedLineItem> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      for (const pattern of servicePatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match) {
          if (currentService && currentService.name) {
            lineItems.push(currentService as ExtractedLineItem);
          }
          currentService = { name: match[0].trim() };
          break;
        }
      }

      const priceLineMatch = line.match(/([\d,]+)\s+([\d.]+)\s+\$?([\d,]+\.?\d*)/);
      if (priceLineMatch && currentService) {
        currentService.quantity = parseFloat(priceLineMatch[1].replace(/,/g, ""));
        currentService.rate = parseFloat(priceLineMatch[2]);
        currentService.amount = parseFloat(priceLineMatch[3].replace(/,/g, ""));
      }

      const sqftMatch = line.match(/([\d,]+)\s*(?:sqft|sq\s*ft|square\s*feet)/i);
      if (sqftMatch && currentService) {
        currentService.quantity = parseFloat(sqftMatch[1].replace(/,/g, ""));
      }

      const amountMatch = line.match(/\$\s*([\d,]+\.?\d*)\s*$/);
      if (amountMatch && currentService && !currentService.amount) {
        currentService.amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      }
    }

    if (currentService && currentService.name) {
      lineItems.push(currentService as ExtractedLineItem);
    }

    return { lineItems, total, estimateNumber, estimateDate };
  }

  async extractQuoteData(details: PandaDocDetailsResponse, pdfText?: string): Promise<ExtractedQuoteData> {
    const extracted: ExtractedQuoteData = {
      confidence: 0,
      unmappedFields: [],
    };

    let confidencePoints = 0;
    let totalPoints = 0;

    if (details.name) {
      extracted.projectName = details.name;
      
      const s2pMatch = details.name.match(/^S2P\s*Proposal\s*[-–—]\s*(.+)$/i);
      if (s2pMatch) {
        const addressPart = s2pMatch[1].trim();
        extracted.projectAddress = addressPart;
        extracted.projectName = `S2P Proposal - ${addressPart}`;
        confidencePoints += 15;
      } else {
        confidencePoints += 10;
      }
    }
    totalPoints += 15;

    if (details.recipients && details.recipients.length > 0) {
      extracted.contacts = details.recipients.map(r => ({
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        email: r.email,
        company: r.company,
      }));
      if (details.recipients[0].company) {
        extracted.clientName = details.recipients[0].company;
        confidencePoints += 15;
      } else if (extracted.contacts[0].name) {
        extracted.clientName = extracted.contacts[0].name;
        confidencePoints += 10;
      }
    }
    totalPoints += 15;

    if (details.tokens) {
      extracted.variables = {};
      for (const token of details.tokens) {
        extracted.variables[token.name] = token.value;
        if (token.name.toLowerCase().includes("address") && !extracted.projectAddress) {
          extracted.projectAddress = token.value;
          confidencePoints += 10;
        }
        if (token.name.toLowerCase().includes("sqft") || token.name.toLowerCase().includes("square")) {
          confidencePoints += 5;
        }
      }
    }
    totalPoints += 15;

    let calculatedTotal = 0;
    if (details.pricing?.tables && details.pricing.tables.length > 0) {
      extracted.services = [];
      extracted.areas = [];
      
      for (const table of details.pricing.tables) {
        for (const item of table.items) {
          const itemPrice = item.subtotal || item.price || 0;
          const service = {
            name: item.name,
            description: item.description,
            price: itemPrice,
            quantity: item.qty,
          };
          extracted.services.push(service);
          calculatedTotal += itemPrice;

          const nameLower = (item.name || "").toLowerCase();
          if (nameLower.includes("scan") || nameLower.includes("model") || 
              nameLower.includes("bim") || nameLower.includes("residential") ||
              nameLower.includes("commercial") || nameLower.includes("lod")) {
            const sqftMatch = item.description?.match(/(\d{1,3}(?:,\d{3})*)\s*(?:sqft|sq\s*ft|square\s*feet)/i);
            extracted.areas.push({
              name: item.name,
              price: itemPrice,
              sqft: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ""), 10) : item.qty,
            });
          }
        }
      }
      confidencePoints += 25;
    }
    totalPoints += 25;

    if (details.grand_total) {
      extracted.totalPrice = details.grand_total.amount;
      extracted.currency = details.grand_total.currency;
      confidencePoints += 20;
    } else if (calculatedTotal > 0) {
      extracted.totalPrice = calculatedTotal;
      extracted.currency = "USD";
      confidencePoints += 15;
    }
    totalPoints += 20;

    if (pdfText) {
      extracted.rawPdfText = pdfText;
      const pdfPricing = this.parsePricingFromText(pdfText);
      
      if (pdfPricing.total > 0 && !extracted.totalPrice) {
        extracted.totalPrice = pdfPricing.total;
        extracted.currency = "USD";
        confidencePoints += 20;
      }
      
      if (pdfPricing.lineItems.length > 0) {
        extracted.lineItems = pdfPricing.lineItems;
        if (!extracted.services || extracted.services.length === 0) {
          extracted.services = pdfPricing.lineItems.map(item => ({
            name: item.name,
            description: item.description,
            price: item.amount,
            quantity: item.quantity,
            rate: item.rate,
          }));
        }
        confidencePoints += 15;
      }
      
      if (pdfPricing.estimateNumber) {
        extracted.estimateNumber = pdfPricing.estimateNumber;
      }
      if (pdfPricing.estimateDate) {
        extracted.estimateDate = pdfPricing.estimateDate;
      }
    }
    totalPoints += 35;

    if (this.openai && pdfText) {
      try {
        const aiExtraction = await this.aiEnhanceExtraction(details, extracted, pdfText);
        if (aiExtraction) {
          if (aiExtraction.projectAddress && !extracted.projectAddress) {
            extracted.projectAddress = aiExtraction.projectAddress;
            confidencePoints += 10;
          }
          if (aiExtraction.totalPrice && !extracted.totalPrice) {
            extracted.totalPrice = aiExtraction.totalPrice;
            confidencePoints += 20;
          }
          if (aiExtraction.areas && aiExtraction.areas.length > 0) {
            extracted.areas = aiExtraction.areas;
            confidencePoints += 15;
          }
          if (aiExtraction.unmappedFields) {
            extracted.unmappedFields = aiExtraction.unmappedFields;
          }
          if (aiExtraction.lineItems && aiExtraction.lineItems.length > 0) {
            extracted.lineItems = aiExtraction.lineItems;
            extracted.services = aiExtraction.lineItems.map((item: ExtractedLineItem) => ({
              name: item.name,
              description: item.description,
              price: item.amount,
              quantity: item.quantity,
              rate: item.rate,
            }));
            confidencePoints += 20;
          }
        }
      } catch (error) {
        console.error("AI extraction enhancement failed:", error);
      }
    }
    totalPoints += 25;

    extracted.confidence = Math.round((confidencePoints / totalPoints) * 100);
    return extracted;
  }

  private async aiEnhanceExtraction(
    details: PandaDocDetailsResponse,
    current: ExtractedQuoteData,
    pdfText?: string
  ): Promise<Partial<ExtractedQuoteData & { lineItems?: ExtractedLineItem[] }> | null> {
    if (!this.openai) return null;

    const estimateSection = pdfText 
      ? this.extractEstimateSection(pdfText)
      : "";
    
    const prompt = `You are analyzing a Scan2Plan (S2P) laser scanning proposal PDF. Extract ALL pricing and service information.

DOCUMENT NAME: ${details.name}

${estimateSection ? `ESTIMATE SECTION FROM PDF:
${estimateSection}` : ""}

RECIPIENTS: ${JSON.stringify(details.recipients?.map(r => ({ name: `${r.first_name} ${r.last_name}`, company: r.company, email: r.email })) || [], null, 2)}

INSTRUCTIONS:
1. Parse the project address from the document name (text after "S2P Proposal - ")
2. Find ALL line items in the Estimate section with their QTY (sqft), RATE ($/sqft), AMOUNT ($)
3. Find the TOTAL amount
4. Common S2P services: "Scan2Plan Residential/Commercial - LoD XXX", "MEPF LoD XXX", "Structural Modeling", "CAD Standard Package", "Discount"

Return JSON:
{
  "projectAddress": "street address, city, state zip",
  "totalPrice": number,
  "lineItems": [
    {"name": "service name", "description": "optional description", "quantity": sqft_number, "rate": rate_per_sqft, "amount": total_amount}
  ],
  "areas": [{"name": "area name", "sqft": number, "buildingType": "residential|commercial"}],
  "unmappedFields": [],
  "buildingType": "residential" | "commercial",
  "lod": "200" | "300" | "350"
}

Return ONLY valid JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const content = response.choices[0].message.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed;
      }
    } catch (error) {
      console.error("AI extraction error:", error);
    }
    return null;
  }

  private extractEstimateSection(pdfText: string): string {
    const lines = pdfText.split("\n");
    let inEstimate = false;
    let estimateLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.match(/^Estimate$/i) || trimmed.match(/^ESTIMATE\s+\d+/i)) {
        inEstimate = true;
      }
      
      if (inEstimate) {
        estimateLines.push(trimmed);
        
        if (trimmed.match(/^TOTAL\s+\$?[\d,]+/i) || 
            trimmed.match(/^Accepted\s+By/i) ||
            trimmed.match(/^Payment\s+Terms/i)) {
          break;
        }
      }
    }
    
    return estimateLines.slice(0, 100).join("\n");
  }

  async createImportBatch(name?: string, createdBy?: string): Promise<PandaDocImportBatch> {
    const [batch] = await db.insert(pandaDocImportBatches).values({
      name: name || `Import ${new Date().toISOString().split("T")[0]}`,
      status: "pending",
      createdBy,
    }).returning();
    return batch;
  }

  async startImport(batchId: number, options: {
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ documentsFound: number; documentsImported: number }> {
    await db.update(pandaDocImportBatches)
      .set({ status: "in_progress", startedAt: new Date() })
      .where(eq(pandaDocImportBatches.id, batchId));

    let documentsFound = 0;
    let documentsImported = 0;
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        const listResponse = await this.listDocuments({
          createdFrom: options.dateFrom,
          createdTo: options.dateTo,
          page,
          count: 50,
        });

        documentsFound += listResponse.results.length;

        for (const doc of listResponse.results) {
          const existing = await db.select()
            .from(pandaDocDocuments)
            .where(eq(pandaDocDocuments.pandaDocId, doc.id))
            .limit(1);

          const stage = mapStatusTextToStage(doc.status);
          const statusCode = mapStatusTextToCode(doc.status);

          if (existing.length === 0) {
            await db.insert(pandaDocDocuments).values({
              batchId,
              pandaDocId: doc.id,
              pandaDocName: doc.name,
              pandaDocStatus: doc.status,
              pandaDocStatusCode: statusCode,
              pandaDocStage: stage,
              pandaDocVersion: doc.version,
              pandaDocCreatedAt: new Date(doc.date_created),
              pandaDocUpdatedAt: new Date(doc.date_modified),
              importStatus: "pending",
            });
            documentsImported++;
          } else {
            const needsUpdate = 
              existing[0].pandaDocStatus !== doc.status ||
              existing[0].pandaDocStage !== stage ||
              existing[0].pandaDocStatusCode !== statusCode;
            
            if (needsUpdate) {
              await db.update(pandaDocDocuments)
                .set({ 
                  pandaDocStatus: doc.status,
                  pandaDocStatusCode: statusCode,
                  pandaDocStage: stage,
                  pandaDocUpdatedAt: new Date(doc.date_modified),
                  updatedAt: new Date(),
                })
                .where(eq(pandaDocDocuments.id, existing[0].id));
            }
          }
        }

        await db.update(pandaDocImportBatches)
          .set({ 
            totalDocuments: documentsFound,
            processedDocuments: documentsImported,
          })
          .where(eq(pandaDocImportBatches.id, batchId));

        hasMore = !!listResponse.next;
        page++;

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await db.update(pandaDocImportBatches)
        .set({ 
          status: "completed",
          completedAt: new Date(),
          totalDocuments: documentsFound,
          processedDocuments: documentsImported,
          successfulDocuments: documentsImported,
        })
        .where(eq(pandaDocImportBatches.id, batchId));

    } catch (error) {
      await db.update(pandaDocImportBatches)
        .set({ status: "failed" })
        .where(eq(pandaDocImportBatches.id, batchId));
      throw error;
    }

    return { documentsFound, documentsImported };
  }

  private async fetchWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isRateLimited = error.message?.includes("429") || error.status === 429;
        const isServerError = error.message?.includes("5") && /50[0-9]/.test(error.message);
        
        if (isRateLimited || isServerError) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          log(`PandaDoc API retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`, "pandadoc");
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw lastError;
  }

  async processDocument(documentId: number): Promise<PandaDocDocument> {
    const [doc] = await db.select()
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      throw new Error("Document not found");
    }

    await db.update(pandaDocDocuments)
      .set({ importStatus: "fetching" })
      .where(eq(pandaDocDocuments.id, documentId));

    try {
      const details = await this.fetchWithRetry(
        () => this.getDocumentDetails(doc.pandaDocId),
        3,
        1000
      );

      let extracted: ExtractedQuoteData;
      
      try {
        log(`Starting GPT-4o Vision extraction for document ${documentId}...`, "pandadoc");
        const pdfBuffer = await this.fetchWithRetry(
          () => this.downloadPdf(doc.pandaDocId),
          2,
          2000
        );
        
        const visionData = await extractProposalData(pdfBuffer);
        extracted = convertVisionToExtractedData(visionData);
        
        if (details.recipients?.length) {
          extracted.contacts = details.recipients.map((r: any) => ({
            name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
            email: r.email,
            company: r.company,
          }));
        }
        
        log(`Vision extraction successful: ${extracted.services?.length || 0} services found`, "pandadoc");
      } catch (visionError) {
        log(`Vision extraction failed, falling back to text extraction: ${visionError instanceof Error ? visionError.message : String(visionError)}`, "pandadoc");
        
        let pdfText = "";
        try {
          const pdfBuffer = await this.downloadPdf(doc.pandaDocId);
          pdfText = await this.extractTextFromPdf(pdfBuffer);
        } catch (textError) {
          log(`Text extraction also failed: ${textError instanceof Error ? textError.message : String(textError)}`, "pandadoc");
        }
        
        extracted = await this.extractQuoteData(details, pdfText);
      }

      const pdfUrl = await this.getDocumentPdfUrl(doc.pandaDocId);

      const [updated] = await db.update(pandaDocDocuments)
        .set({
          importStatus: "extracted",
          rawPandaDocData: details as any,
          pricingTableData: details.pricing as any,
          recipientsData: details.recipients as any,
          variablesData: details.tokens as any,
          extractedData: extracted as any,
          extractionConfidence: extracted.confidence.toString(),
          pandaDocPdfUrl: pdfUrl,
          updatedAt: new Date(),
        })
        .where(eq(pandaDocDocuments.id, documentId))
        .returning();

      return updated;

    } catch (error: any) {
      const errorDetails = {
        message: String(error?.message || error),
        status: error?.status,
        type: error?.name,
        timestamp: new Date().toISOString(),
      };
      
      log(`PandaDoc extraction failed for doc ${documentId}: ${JSON.stringify(errorDetails)}`, "pandadoc");
      
      await db.update(pandaDocDocuments)
        .set({
          importStatus: "error",
          extractionErrors: errorDetails as any,
          updatedAt: new Date(),
        })
        .where(eq(pandaDocDocuments.id, documentId));
      throw error;
    }
  }

  async approveDocument(
    documentId: number,
    reviewedBy: string,
    editedData?: Partial<ExtractedQuoteData>,
    reviewNotes?: string
  ): Promise<{ document: PandaDocDocument; quote?: typeof cpqQuotes.$inferSelect; lead?: typeof leads.$inferSelect }> {
    const [doc] = await db.select()
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      throw new Error("Document not found");
    }

    const finalData = editedData 
      ? { ...(doc.extractedData as ExtractedQuoteData), ...editedData }
      : doc.extractedData as ExtractedQuoteData;

    const quoteNumber = `PD-${doc.pandaDocId.substring(0, 8).toUpperCase()}`;
    
    // Map PandaDoc stage to pipeline deal stage
    const pandaDocStage = doc.pandaDocStage;
    let dealStage: string;
    if (pandaDocStage === "closed_won" || pandaDocStage === "paid") {
      dealStage = "Closed Won";
    } else if (pandaDocStage === "closed_lost" || pandaDocStage === "voided" || pandaDocStage === "declined") {
      dealStage = "Closed Lost";
    } else if (pandaDocStage === "sent" || pandaDocStage === "viewed") {
      dealStage = "Proposal";
    } else {
      dealStage = "Proposal"; // Default for imported proposals
    }
    
    // First create a lead for the pipeline
    const [lead] = await db.insert(leads).values({
      clientName: finalData.clientName || "Unknown Client",
      projectName: finalData.projectName || doc.pandaDocName || "Imported Project",
      projectAddress: finalData.projectAddress || "TBD",
      value: finalData.totalPrice?.toString() || "0",
      dealStage,
      probability: dealStage === "Closed Won" ? 100 : dealStage === "Closed Lost" ? 0 : 50,
      notes: `Imported from PandaDoc: ${doc.pandaDocName}\n${reviewNotes || ""}`,
      leadSource: "PandaDoc Import",
    }).returning();
    
    // Then create the CPQ quote linked to the lead
    const [quote] = await db.insert(cpqQuotes).values({
      leadId: lead.id,
      quoteNumber,
      projectName: finalData.projectName || doc.pandaDocName || "Imported Quote",
      projectAddress: finalData.projectAddress || "TBD",
      clientName: finalData.clientName,
      typeOfBuilding: "Commercial / Office",
      areas: finalData.areas || [],
      risks: [],
      services: finalData.services || {},
      dispatchLocation: "Brooklyn",
      totalPrice: finalData.totalPrice?.toString() || "0",
      pricingBreakdown: {
        source: "pandadoc_import",
        originalDocId: doc.pandaDocId,
        importedAt: new Date().toISOString(),
      },
      scopingData: {
        pandaDocVariables: finalData.variables,
        pandaDocContacts: finalData.contacts,
      },
      createdBy: reviewedBy,
    }).returning();

    const [updated] = await db.update(pandaDocDocuments)
      .set({
        importStatus: "approved",
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes,
        extractedData: finalData as any,
        cpqQuoteId: quote.id,
        leadId: lead.id,
        updatedAt: new Date(),
      })
      .where(eq(pandaDocDocuments.id, documentId))
      .returning();

    log(`PandaDoc approved: Created lead ${lead.id} (${dealStage}) and quote ${quote.id}`, "pandadoc");

    return { document: updated, quote, lead };
  }

  async rejectDocument(
    documentId: number,
    reviewedBy: string,
    reviewNotes?: string
  ): Promise<PandaDocDocument> {
    const [updated] = await db.update(pandaDocDocuments)
      .set({
        importStatus: "rejected",
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(pandaDocDocuments.id, documentId))
      .returning();

    return updated;
  }

  async getBatches(): Promise<PandaDocImportBatch[]> {
    return db.select()
      .from(pandaDocImportBatches)
      .orderBy(desc(pandaDocImportBatches.createdAt));
  }

  async getBatchDocuments(batchId: number): Promise<PandaDocDocument[]> {
    return db.select()
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.batchId, batchId))
      .orderBy(desc(pandaDocDocuments.createdAt));
  }

  async getAllDocuments(status?: string): Promise<PandaDocDocument[]> {
    const query = db.select().from(pandaDocDocuments);
    if (status) {
      return query.where(eq(pandaDocDocuments.importStatus, status))
        .orderBy(desc(pandaDocDocuments.createdAt));
    }
    return query.orderBy(desc(pandaDocDocuments.createdAt));
  }

  async getDocument(id: number): Promise<PandaDocDocument | null> {
    const [doc] = await db.select()
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.id, id))
      .limit(1);
    return doc || null;
  }

  async getStats(): Promise<{
    totalBatches: number;
    totalDocuments: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    errors: number;
  }> {
    const batches = await db.select({ count: sql<number>`count(*)` })
      .from(pandaDocImportBatches);
    
    const documents = await db.select({ count: sql<number>`count(*)` })
      .from(pandaDocDocuments);
    
    const pendingReview = await db.select({ count: sql<number>`count(*)` })
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.importStatus, "extracted"));
    
    const approved = await db.select({ count: sql<number>`count(*)` })
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.importStatus, "approved"));
    
    const rejected = await db.select({ count: sql<number>`count(*)` })
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.importStatus, "rejected"));
    
    const errors = await db.select({ count: sql<number>`count(*)` })
      .from(pandaDocDocuments)
      .where(eq(pandaDocDocuments.importStatus, "error"));

    return {
      totalBatches: Number(batches[0]?.count || 0),
      totalDocuments: Number(documents[0]?.count || 0),
      pendingReview: Number(pendingReview[0]?.count || 0),
      approved: Number(approved[0]?.count || 0),
      rejected: Number(rejected[0]?.count || 0),
      errors: Number(errors[0]?.count || 0),
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const pandaDocClient = new PandaDocClient();
