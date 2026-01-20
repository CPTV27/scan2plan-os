import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";
import OpenAI from "openai";

const UPLOADS_DIR = "uploads/lead-documents";

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function parsePdf(dataBuffer: Buffer): Promise<{ text: string }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  
  const uint8Array = new Uint8Array(dataBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;
  
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }
  
  return { text: fullText };
}

async function extractRfpData(pdfText: string, filename: string): Promise<{
  documentType: string;
  projectName: string | null;
  clientName: string | null;
  projectAddress: string | null;
  budget: number | null;
  deadline: string | null;
  scope: string | null;
  requirements: string[];
  deliverables: string[];
  contactInfo: { name: string | null; email: string | null; phone: string | null };
  keyDates: { description: string; date: string }[];
  specialRequirements: string | null;
  summary: string;
}> {
  const systemPrompt = `You are an expert at extracting structured data from RFPs (Request for Proposals), client documents, and project specifications for a laser scanning and BIM company.

Analyze the document and extract:
- documentType: Type of document (RFP, Proposal, Contract, Specification, Quote Request, Site Plan, etc.)
- projectName: Project title or name
- clientName: Client/company name
- projectAddress: Project site address or location
- budget: Budget amount as a number (no $ or commas), null if not specified
- deadline: Submission or project deadline (ISO date string or descriptive)
- scope: Scope of work description
- requirements: Array of specific requirements
- deliverables: Array of expected deliverables
- contactInfo: { name, email, phone } of primary contact
- keyDates: Array of { description, date } for important milestones
- specialRequirements: Any special conditions, insurance requirements, certifications needed
- summary: A brief executive summary of the document (2-3 sentences)

Return ONLY valid JSON:
{
  "documentType": "...",
  "projectName": "...",
  "clientName": "...",
  "projectAddress": "...",
  "budget": null,
  "deadline": "...",
  "scope": "...",
  "requirements": ["..."],
  "deliverables": ["..."],
  "contactInfo": { "name": "...", "email": "...", "phone": "..." },
  "keyDates": [{ "description": "...", "date": "..." }],
  "specialRequirements": "...",
  "summary": "..."
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract data from this document (filename: ${filename}):\n\n${pdfText.substring(0, 15000)}` }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return {
      documentType: parsed.documentType || "Unknown",
      projectName: parsed.projectName || null,
      clientName: parsed.clientName || null,
      projectAddress: parsed.projectAddress || null,
      budget: typeof parsed.budget === 'number' ? parsed.budget : null,
      deadline: parsed.deadline || null,
      scope: parsed.scope || null,
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
      contactInfo: {
        name: parsed.contactInfo?.name || null,
        email: parsed.contactInfo?.email || null,
        phone: parsed.contactInfo?.phone || null,
      },
      keyDates: Array.isArray(parsed.keyDates) ? parsed.keyDates : [],
      specialRequirements: parsed.specialRequirements || null,
      summary: parsed.summary || "Document analysis complete.",
    };
  } catch (error: any) {
    log("ERROR: RFP extraction error - " + (error?.message || error));
    return {
      documentType: "Unknown",
      projectName: null,
      clientName: null,
      projectAddress: null,
      budget: null,
      deadline: null,
      scope: null,
      requirements: [],
      deliverables: [],
      contactInfo: { name: null, email: null, phone: null },
      keyDates: [],
      specialRequirements: null,
      summary: `AI extraction failed: ${error.message}. Manual review recommended.`,
    };
  }
}

export function registerDocumentRoutes(app: Express) {
  app.get("/api/leads/:leadId/documents", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    try {
      const leadId = Number(req.params.leadId);
      const documents = await storage.getLeadDocuments(leadId);
      res.json(documents);
    } catch (error) {
      log("ERROR: Error fetching documents - " + (error as Error)?.message);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  }));

  app.post("/api/leads/:leadId/documents", isAuthenticated, requireRole("ceo", "sales"), upload.single("file"), asyncHandler(async (req: any, res) => {
    try {
      const leadId = Number(req.params.leadId);
      const file = req.file;
      const user = req.user;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const lead = await storage.getLead(leadId);
      if (!lead) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ message: "Lead not found" });
      }

      const document = await storage.createLeadDocument({
        leadId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: file.path,
        uploadedBy: user?.id,
      });

      res.status(201).json(document);
    } catch (error) {
      log("ERROR: Error uploading document - " + (error as Error)?.message);
      res.status(500).json({ message: "Failed to upload document" });
    }
  }));

  app.post("/api/leads/:leadId/documents/parse-rfp", isAuthenticated, requireRole("ceo", "sales"), upload.single("file"), asyncHandler(async (req: any, res) => {
    try {
      const leadId = Number(req.params.leadId);
      const file = req.file;
      const user = req.user;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const lead = await storage.getLead(leadId);
      if (!lead) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ message: "Lead/Deal not found" });
      }

      if (file.mimetype !== "application/pdf") {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Only PDF files can be parsed. Upload other file types without parsing." });
      }

      const buffer = fs.readFileSync(file.path);
      const { text } = await parsePdf(buffer);
      
      if (!text || text.trim().length < 50) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Could not extract text from PDF. File may be image-based or corrupted." });
      }

      const extracted = await extractRfpData(text, file.originalname);

      const document = await storage.createLeadDocument({
        leadId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: file.path,
        uploadedBy: user?.id,
      });

      if (document.id) {
        await storage.updateLeadDocument(document.id, { metadata: extracted } as any);
      }

      res.status(201).json({
        document,
        extracted,
        message: `Successfully parsed "${file.originalname}"`,
      });
    } catch (error: any) {
      log("ERROR: RFP parse error - " + (error?.message || error));
      res.status(500).json({ message: error.message || "Failed to parse document" });
    }
  }));

  app.get("/api/documents/:id/download", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const document = await storage.getLeadDocument(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!fs.existsSync(document.storageKey)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${document.originalName}"`);
      res.setHeader("Content-Type", document.mimeType);
      res.sendFile(path.resolve(document.storageKey));
    } catch (error) {
      log("ERROR: Error downloading document - " + (error as Error)?.message);
      res.status(500).json({ message: "Failed to download document" });
    }
  }));

  app.delete("/api/documents/:id", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const document = await storage.getLeadDocument(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (fs.existsSync(document.storageKey)) {
        fs.unlinkSync(document.storageKey);
      }

      await storage.deleteLeadDocument(documentId);
      res.status(204).send();
    } catch (error) {
      log("ERROR: Error deleting document - " + (error as Error)?.message);
      res.status(500).json({ message: "Failed to delete document" });
    }
  }));

  app.post("/api/documents/:id/reparse", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    try {
      const documentId = Number(req.params.id);
      const document = await storage.getLeadDocument(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.mimeType !== "application/pdf") {
        return res.status(400).json({ message: "Only PDF files can be parsed" });
      }

      if (!fs.existsSync(document.storageKey)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      const buffer = fs.readFileSync(document.storageKey);
      const { text } = await parsePdf(buffer);
      
      if (!text || text.trim().length < 50) {
        return res.status(400).json({ message: "Could not extract text from PDF" });
      }

      const extracted = await extractRfpData(text, document.originalName);

      await storage.updateLeadDocument(documentId, { metadata: extracted });

      res.json({
        document: { ...document, metadata: extracted },
        extracted,
        message: `Successfully re-parsed "${document.originalName}"`,
      });
    } catch (error: any) {
      log("ERROR: Document reparse error - " + (error?.message || error));
      res.status(500).json({ message: error.message || "Failed to reparse document" });
    }
  }));
}
