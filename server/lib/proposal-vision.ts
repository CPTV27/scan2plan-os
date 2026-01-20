import OpenAI from "openai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { log } from "./logger";

const execAsync = promisify(exec);

// Enhanced schema with confidence scoring per field
const LineItemSchema = z.object({
  sku: z.string().optional().nullable(),
  title: z.string(),
  description: z.string().optional().nullable(),
  qty: z.number(),
  unit: z.string().optional().nullable(), // sqft, each, hours, etc.
  rate: z.number(),
  total: z.number(),
  confidence: z.number().optional(), // 0-100 confidence for this line
});

const ProposalSchema = z.object({
  client: z.object({
    name: z.string(),
    company: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    confidence: z.number().optional(),
  }),
  project: z.object({
    address: z.string(),
    date: z.string().optional().nullable(),
    confidence: z.number().optional(),
  }),
  lineItems: z.array(LineItemSchema),
  grandTotal: z.number(),
  subtotal: z.number().optional().nullable(),
  tax: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  estimatePageNumber: z.number().optional(), // Which page had the pricing table
  extractionNotes: z.array(z.string()).optional(), // Any issues noticed
});

export type ProposalData = z.infer<typeof ProposalSchema>;

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

// Phase 1: Find the estimate/pricing page
const PAGE_FINDER_PROMPT = `You are analyzing PandaDoc proposal pages to find the ESTIMATE page.

LOOK FOR THIS SPECIFIC LAYOUT:
- Blue "Estimate" header text at the top
- "ADDRESS" section with client name and property/location name
- "ESTIMATE" number and "DATE" fields on the right
- A table with column headers: DESCRIPTION, QTY, RATE, AMOUNT
- Line items with service names, quantities (often sqft), rates, and amounts
- "TOTAL" row at the bottom with a dollar amount

IGNORE these pages:
- Cover pages with just logos/company info
- Terms & conditions pages
- Signature/acceptance pages
- Pages without a pricing table

For each page, respond with:
- page_number (1-indexed)
- is_estimate_page: true/false
- confidence: 0-100
- reason: brief explanation

Return JSON array:
[{"page_number": 1, "is_estimate_page": false, "confidence": 95, "reason": "Cover page only"}]`;

// Phase 2: Extract data from estimate page with enhanced prompting
const EXTRACTION_PROMPT = `You are extracting data from a Scan2Plan PandaDoc proposal estimate page.

THE ESTIMATE PAGE HAS THIS EXACT LAYOUT:

1. HEADER SECTION:
   - Blue "Estimate" text
   - "ADDRESS" label with client name on first line, property/project name on second line
   - "ESTIMATE" number (e.g., "2122") and "DATE" (e.g., "12/02/2025") on the right

2. PRICING TABLE:
   - Column headers: DESCRIPTION | QTY | RATE | AMOUNT
   - Each row has:
     * Service name in bold (e.g., "Scan2Plan Residential - LoD 200")
     * Description text below (property address, sqft, deliverables)
     * QTY = square footage (e.g., 5,500)
     * RATE = price per sqft (e.g., 0.746)
     * AMOUNT = line total (e.g., 4,103.00)

3. TOTAL ROW:
   - "TOTAL" label with final dollar amount (e.g., "$4,598.00")

EXTRACTION RULES:

1. CLIENT INFO:
   - Name = first line under "ADDRESS" (e.g., "Jackson Lehr")
   - Project = second line under "ADDRESS" (e.g., "Dotori Ranch")

2. LINE ITEMS:
   - Title = bold service name (e.g., "Scan2Plan Residential - LoD 200")
   - Description = the paragraph below describing the service
   - QTY = the sqft value in QTY column (always a number, often 4-6 digits)
   - RATE = price per sqft (small decimal like 0.09, 0.15, 0.746)
   - AMOUNT = the total for that line item

3. VALIDATION:
   - QTY × RATE should approximately equal AMOUNT
   - Sum of all AMOUNT values should equal TOTAL
   - If numbers don't match, use the AMOUNT column as truth

Return ONLY valid JSON:
{
  "client": {
    "name": "Client Name from ADDRESS section",
    "company": "Property/Project name from ADDRESS section",
    "email": null,
    "confidence": 90
  },
  "project": {
    "address": "Full property address from description",
    "date": "Date from ESTIMATE DATE field",
    "confidence": 90
  },
  "lineItems": [
    {
      "sku": null,
      "title": "Service Name (bold text)",
      "description": "Full description paragraph",
      "qty": 5500,
      "unit": "sqft",
      "rate": 0.746,
      "total": 4103.00,
      "confidence": 95
    }
  ],
  "grandTotal": 4598.00,
  "subtotal": null,
  "tax": null,
  "discount": null,
  "estimatePageNumber": 1,
  "extractionNotes": []
}`;

export async function convertPdfToImages(pdfBuffer: Buffer, maxPages: number = 10): Promise<string[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outputPrefix = path.join(tmpDir, "page");
  
  try {
    await fs.writeFile(pdfPath, pdfBuffer);
    
    // Higher DPI (200) for better text clarity in tables
    // Using -gray for faster processing and often cleaner text
    await execAsync(`pdftoppm -png -r 200 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`);
    
    const files = await fs.readdir(tmpDir);
    const pngFiles = files.filter(f => f.endsWith(".png")).sort();
    
    const base64Images: string[] = [];
    for (const pngFile of pngFiles) {
      const imagePath = path.join(tmpDir, pngFile);
      const imageBuffer = await fs.readFile(imagePath);
      const base64 = imageBuffer.toString("base64");
      base64Images.push(`data:image/png;base64,${base64}`);
    }
    
    log(`Converted ${base64Images.length} pages to images at 200 DPI`, "vision");
    return base64Images;
  } finally {
    try {
      const files = await fs.readdir(tmpDir);
      for (const file of files) {
        await fs.unlink(path.join(tmpDir, file));
      }
      await fs.rmdir(tmpDir);
    } catch (e) {
      // Cleanup errors are non-fatal
    }
  }
}

// Phase 1: Identify which page contains the estimate/pricing table
async function findEstimatePage(images: string[]): Promise<{ pageIndex: number; confidence: number }> {
  const openai = getOpenAI();
  
  // Scan ALL pages to find estimate - pricing tables can be anywhere
  const imageContents = images.map((base64Image, idx) => ({
    type: "image_url" as const,
    image_url: {
      url: base64Image,
      detail: "low" as const, // Low detail for page finding is sufficient
    },
  }));

  log(`Phase 1: Scanning ALL ${images.length} pages to find estimate...`, "vision");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PAGE_FINDER_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze these ${images.length} proposal pages and identify which one contains the pricing/estimate table. Pages are numbered 1 through ${images.length}. The pricing table may be near the end of the document.` },
            ...imageContents,
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    let jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const pages = JSON.parse(jsonStr) as Array<{
      page_number: number;
      is_estimate_page: boolean;
      confidence: number;
      reason: string;
    }>;

    const estimatePage = pages
      .filter(p => p.is_estimate_page)
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (estimatePage) {
      log(`Found estimate on page ${estimatePage.page_number} (${estimatePage.confidence}% confidence): ${estimatePage.reason}`, "vision");
      return { pageIndex: estimatePage.page_number - 1, confidence: estimatePage.confidence };
    }

    // Fallback: scan pages looking for any with numbers/tables (pages 2-3 are common)
    log("No estimate page identified with high confidence, using heuristic fallback", "vision");
    
    // Try the middle of the document as fallback (common for estimates)
    const fallbackIndex = Math.min(Math.floor(images.length / 2), images.length - 1);
    return { pageIndex: fallbackIndex, confidence: 40 };
  } catch (error) {
    log(`Page finder error: ${error instanceof Error ? error.message : String(error)}`, "vision");
    // On error, try to extract from all pages at once
    return { pageIndex: -1, confidence: 20 }; // -1 signals "use all pages"
  }
}

// Phase 2: Extract data from the estimate page with focused attention
async function extractFromEstimatePage(
  images: string[],
  estimatePageIndex: number
): Promise<ProposalData> {
  const openai = getOpenAI();

  let relevantImages: string[];
  let contextInfo: string;

  if (estimatePageIndex < 0) {
    // Use all pages when page detection failed
    relevantImages = images;
    contextInfo = `You are looking at all ${images.length} pages of the proposal. Find the pricing/estimate table and extract all data.`;
    log(`Phase 2: Extracting from ALL ${images.length} pages (page detection failed)...`, "vision");
  } else {
    // Dynamic window: include 1 page before and ALL pages after the estimate
    // This ensures we capture totals/signatures that may follow
    const startIdx = Math.max(0, estimatePageIndex - 1);
    const endIdx = images.length; // Always include to end of document
    relevantImages = images.slice(startIdx, endIdx);
    contextInfo = `You are looking at pages ${startIdx + 1} through ${endIdx} of the proposal. The pricing table should be on page ${estimatePageIndex + 1}. Include any totals or additional pricing from subsequent pages.`;
    log(`Phase 2: Extracting from pages ${startIdx + 1}-${endIdx} (estimate on page ${estimatePageIndex + 1})...`, "vision");
  }
  
  const imageContents = relevantImages.map((base64Image, idx) => ({
    type: "image_url" as const,
    image_url: {
      url: base64Image,
      detail: "high" as const, // High detail for actual extraction
    },
  }));

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: `${contextInfo}

Extract all proposal data including:
1. Client name, company, and email (may be on cover page)
2. Project/site address (the location being scanned, not client's office)
3. ALL line items from the pricing table with accurate quantities, rates, and totals
4. Grand total, subtotal, tax, and any discounts

Pay special attention to:
- Correctly reading numeric values (don't confuse sqft with dollars)
- Including all line items, not just the main ones
- Noting your confidence level for each extracted field`
          },
          ...imageContents,
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error("No response from GPT-4o");
  }

  log("Response received, parsing...", "vision");

  // Clean up JSON response
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    log(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`, "vision");
    log(`Raw content (truncated): ${content.substring(0, 500)}`, "vision");
    throw new Error(`Failed to parse response as JSON: ${parseError}`);
  }

  // Validate with schema
  const validated = ProposalSchema.safeParse(parsed);
  
  if (!validated.success) {
    log(`Schema validation failed: ${JSON.stringify(validated.error.errors)}`, "vision");
    
    // Build fallback from partial data
    const data = parsed as any;
    return buildFallbackData(data, estimatePageIndex);
  }

  // Add page number if not set
  if (!validated.data.estimatePageNumber) {
    validated.data.estimatePageNumber = estimatePageIndex + 1;
  }

  // Validate totals match
  const lineItemSum = validated.data.lineItems.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = validated.data.grandTotal;
  const discrepancy = Math.abs(lineItemSum - grandTotal);
  const discrepancyPercent = (discrepancy / grandTotal) * 100;

  if (discrepancyPercent > 10) {
    validated.data.extractionNotes = validated.data.extractionNotes || [];
    validated.data.extractionNotes.push(
      `Warning: Line item sum ($${lineItemSum.toFixed(2)}) differs from grand total ($${grandTotal.toFixed(2)}) by ${discrepancyPercent.toFixed(1)}%`
    );
  }

  console.log("[Vision] Extraction successful:", {
    client: validated.data.client.name,
    lineItems: validated.data.lineItems.length,
    grandTotal: validated.data.grandTotal,
    avgConfidence: calculateAverageConfidence(validated.data),
  });

  return validated.data;
}

function buildFallbackData(data: any, estimatePageIndex: number): ProposalData {
  // Parse line items with multiple fallback strategies
  const lineItems = (data?.lineItems || []).map((item: any) => {
    // Try multiple field name variations
    const qty = parseFloat(item?.qty) || parseFloat(item?.quantity) || parseFloat(item?.sqft) || 1;
    const rate = parseFloat(item?.rate) || parseFloat(item?.unitPrice) || parseFloat(item?.price) || 0;
    let total = parseFloat(item?.total) || parseFloat(item?.amount) || parseFloat(item?.lineTotal) || 0;
    
    // If total is missing but we have qty and rate, calculate it
    if (total === 0 && rate > 0) {
      total = qty * rate;
    }
    
    return {
      sku: item?.sku || item?.itemNumber || null,
      title: item?.title || item?.name || item?.service || item?.description?.substring(0, 50) || "Unknown Item",
      description: item?.description || item?.details || null,
      qty,
      unit: item?.unit || item?.uom || null,
      rate,
      total,
      confidence: 40,
    };
  });

  // Calculate line item sum for validation
  const lineItemSum = lineItems.reduce((sum: number, item: any) => sum + item.total, 0);
  
  // Parse grand total with multiple fallbacks
  let grandTotal = parseFloat(data?.grandTotal) || 
                   parseFloat(data?.total) || 
                   parseFloat(data?.totalAmount) ||
                   parseFloat(data?.estimateTotal) || 0;
  
  // If grand total is 0 but we have line items, use their sum
  if (grandTotal === 0 && lineItemSum > 0) {
    grandTotal = lineItemSum;
  }
  
  // If grand total exists but line items don't sum correctly, note it
  const notes: string[] = ["Schema validation failed, using fallback parsing"];
  if (grandTotal > 0 && lineItemSum > 0) {
    const discrepancy = Math.abs(lineItemSum - grandTotal) / grandTotal * 100;
    if (discrepancy > 10) {
      notes.push(`Line items sum ($${lineItemSum.toFixed(2)}) differs from grand total ($${grandTotal.toFixed(2)}) by ${discrepancy.toFixed(1)}%`);
    }
  }

  return {
    client: {
      name: data?.client?.name || data?.clientName || "Unknown",
      company: data?.client?.company || data?.clientCompany || null,
      email: data?.client?.email || data?.clientEmail || null,
      confidence: 50,
    },
    project: {
      address: data?.project?.address || data?.projectAddress || data?.siteAddress || "Unknown",
      date: data?.project?.date || data?.projectDate || null,
      confidence: 50,
    },
    lineItems,
    grandTotal,
    subtotal: parseFloat(data?.subtotal) || null,
    tax: parseFloat(data?.tax) || null,
    discount: parseFloat(data?.discount) || null,
    estimatePageNumber: estimatePageIndex >= 0 ? estimatePageIndex + 1 : undefined,
    extractionNotes: notes,
  };
}

function calculateAverageConfidence(data: ProposalData): number {
  const confidences: number[] = [];
  
  if (data.client.confidence) confidences.push(data.client.confidence);
  if (data.project.confidence) confidences.push(data.project.confidence);
  
  data.lineItems.forEach(item => {
    if (item.confidence) confidences.push(item.confidence);
  });

  if (confidences.length === 0) return 75; // Default
  return Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);
}

// Main extraction function - now uses two-pass approach
export async function extractProposalData(pdfBuffer: Buffer): Promise<ProposalData> {
  log("Starting enhanced two-pass proposal extraction...", "vision");
  
  const images = await convertPdfToImages(pdfBuffer, 10);
  
  if (images.length === 0) {
    throw new Error("No images extracted from PDF");
  }

  // Phase 1: Find the estimate page
  const { pageIndex, confidence: pageConfidence } = await findEstimatePage(images);
  
  // Phase 2: Extract data with focus on the estimate page
  const data = await extractFromEstimatePage(images, pageIndex);
  
  // Add extraction notes about the process
  data.extractionNotes = data.extractionNotes || [];
  if (pageConfidence < 70) {
    data.extractionNotes.push(`Estimate page location confidence was low (${pageConfidence}%), results may vary`);
  }

  return data;
}

export function convertVisionToExtractedData(visionData: ProposalData) {
  const grandTotal = visionData.grandTotal;
  
  // Calculate sum of line items
  const lineItemSum = visionData.lineItems.reduce((sum, item) => sum + item.total, 0);
  
  // Check for data integrity
  const discrepancyPercent = grandTotal > 0 
    ? Math.abs(lineItemSum - grandTotal) / grandTotal * 100 
    : 0;
  
  const hasDiscrepancy = discrepancyPercent > 15;
  
  if (hasDiscrepancy) {
    log(`Price discrepancy detected: Line item sum $${lineItemSum.toLocaleString()} vs grand total $${grandTotal.toLocaleString()} (${discrepancyPercent.toFixed(1)}% diff)`, "vision");
  }

  // Map line items with quality metrics
  const services = visionData.lineItems.map(item => ({
    name: item.title,
    description: item.description || undefined,
    quantity: item.qty,
    unit: item.unit || undefined,
    price: item.total,
    confidence: item.confidence || 75,
  }));

  // Calculate overall confidence
  const avgLineConfidence = calculateAverageConfidence(visionData);
  let confidence = avgLineConfidence;
  
  // Reduce confidence if there are issues
  if (hasDiscrepancy) confidence -= 15;
  if (visionData.extractionNotes?.some(n => n.includes("Warning"))) confidence -= 5;
  if (visionData.extractionNotes?.some(n => n.includes("fallback"))) confidence -= 20;
  
  confidence = Math.max(30, Math.min(95, confidence));

  return {
    projectName: visionData.project.address,
    projectAddress: visionData.project.address,
    clientName: visionData.client.company || visionData.client.name,
    totalPrice: grandTotal,
    confidence,
    contacts: [{
      name: visionData.client.name,
      email: visionData.client.email || undefined,
      company: visionData.client.company || undefined,
    }].filter(c => c.name),
    services,
    subtotal: visionData.subtotal || undefined,
    tax: visionData.tax || undefined,
    discount: visionData.discount || undefined,
    areas: [],
    variables: {},
    unmappedFields: [],
    extractionNotes: visionData.extractionNotes || [],
  };
}
