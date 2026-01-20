import { Router } from "express";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { storage } from "../storage";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";
import { log } from "../lib/logger";

export const dealsRouter = Router();
const upload = multer({ dest: "/tmp/uploads/" });

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

async function extractDealFromPDF(pdfText: string, filename: string): Promise<any> {
    const systemPrompt = `You are an expert at extracting structured data from PandaDoc proposals for a laser scanning and BIM company. Return ONLY valid JSON.
Fields: clientName, projectName, projectAddress, value (number), buildingType, sqft (number), scope, disciplines, bimDeliverable, contactName, contactEmail, contactPhone, notes.
Also "unmappedFields": [{field, value}].`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Extract deal data from (filename: ${filename}):\n\n${pdfText.substring(0, 15000)}` }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No response from AI");

        const parsed = JSON.parse(content);
        return {
            clientName: parsed.clientName || "Unknown Client",
            projectName: parsed.projectName || null,
            projectAddress: parsed.projectAddress || null,
            value: typeof parsed.value === 'number' ? parsed.value : parseFloat(parsed.value) || 0,
            buildingType: parsed.buildingType || null,
            sqft: typeof parsed.sqft === 'number' ? parsed.sqft : parseInt(parsed.sqft) || null,
            scope: parsed.scope || null,
            disciplines: parsed.disciplines || null,
            bimDeliverable: parsed.bimDeliverable || null,
            contactName: parsed.contactName || null,
            contactEmail: parsed.contactEmail || null,
            contactPhone: parsed.contactPhone || null,
            notes: parsed.notes || null,
            unmappedFields: Array.isArray(parsed.unmappedFields) ? parsed.unmappedFields : []
        };
    } catch (error: any) {
        log("ERROR: AI extraction error - " + (error?.message || error));
        // Fallback regex extraction could go here, omitting for brevity
        return {
            clientName: filename.replace(/\.pdf$/i, ""),
            notes: `AI extraction failed: ${error.message}. Manual review recommended.`,
            unmappedFields: []
        };
    }
}

dealsRouter.post("/leads/import-pdf", isAuthenticated, requireRole("ceo", "sales"), upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
        const buffer = fs.readFileSync(req.file.path);
        fs.unlinkSync(req.file.path);
        const { text } = await parsePdf(buffer);

        if (!text || text.trim().length < 50) return res.status(400).json({ message: "Could not extract text. File may be image-based." });

        const extracted = await extractDealFromPDF(text, req.file.originalname);
        const leadData = {
            ...extracted,
            dealStage: "Leads" as const,
            probability: 50,
            leadPriority: 3,
            notes: extracted.notes ? `${extracted.notes}\n\n[Imported from PDF: ${req.file.originalname}]` : `[Imported from PDF: ${req.file.originalname}]`,
        };

        const lead = await storage.createLead(leadData);
        res.status(201).json({ lead, extracted, message: `Successfully imported lead`, hasUnmappedFields: extracted.unmappedFields.length > 0 });
    } catch (err: any) {
        log("ERROR: PDF import error - " + (err?.message || err));
        res.status(500).json({ message: err.message || "Failed to import PDF" });
    }
}));
