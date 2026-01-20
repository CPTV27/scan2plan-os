import { Router } from "express";
import { storage } from "../../storage";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { leadService } from "../../services/leadService";
import { log } from "../../lib/logger";
import multer from "multer";
import fs from "fs";

export const leadsImportRouter = Router();

const ALLOWED_IMPORT_TYPES = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const upload = multer({
    dest: "/tmp/uploads/",
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max for imports
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMPORT_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} is not allowed. Allowed: CSV, Excel`));
        }
    },
});

// POST /api/leads/import
leadsImportRouter.post(
    "/api/leads/import",
    isAuthenticated,
    requireRole("ceo", "sales"),
    upload.single("file"),
    asyncHandler(async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }

            const content = fs.readFileSync(req.file.path, "utf-8");
            fs.unlinkSync(req.file.path);

            const lines = content.split(/\r?\n/).filter(line => line.trim());
            if (lines.length < 2) {
                return res.status(400).json({ message: "CSV must have a header row and at least one data row" });
            }

            const headerLine = lines[0];
            const headers = leadService.parseCSVLine(headerLine).map(h => h.toLowerCase().trim());

            const fieldMapping: Record<string, string> = {
                "client": "clientName",
                "client name": "clientName",
                "clientname": "clientName",
                "company": "clientName",
                "business name": "clientName",
                "project": "projectName",
                "project name": "projectName",
                "address": "projectAddress",
                "project address": "projectAddress",
                "value": "value",
                "deal value": "value",
                "amount": "value",
                "probability": "probability",
                "stage": "dealStage",
                "deal stage": "dealStage",
                "notes": "notes",
                "contact": "contactName",
                "contact name": "contactName",
                "name": "contactName",
                "first name": "_firstName",
                "last name": "_lastName",
                "email": "contactEmail",
                "phone": "contactPhone",
                "source": "leadSource",
                "priority": "leadPriority",
                "building type": "buildingType",
                "sqft": "sqft",
                "scope": "scope",
            };

            const columnMap: Record<number, string> = {};
            headers.forEach((header, idx) => {
                const mapped = fieldMapping[header];
                if (mapped) {
                    columnMap[idx] = mapped;
                }
            });

            const hasClientName = Object.values(columnMap).includes("clientName");
            const hasContactName = Object.values(columnMap).includes("contactName");
            const hasFirstName = Object.values(columnMap).includes("_firstName");
            const hasEmail = Object.values(columnMap).includes("contactEmail");

            if (!hasClientName && !hasContactName && !hasFirstName && !hasEmail) {
                return res.status(400).json({
                    message: "CSV must have at least one of: 'Client Name', 'Business Name', 'Contact Name', 'First Name', or 'Email'. Found headers: " + headers.join(", ")
                });
            }

            const results = { imported: 0, errors: [] as string[] };

            for (let i = 1; i < lines.length; i++) {
                const values = leadService.parseCSVLine(lines[i]);
                if (values.length === 0 || values.every(v => !v.trim())) continue;

                try {
                    const leadData: Record<string, any> = {
                        dealStage: "Leads",
                        probability: 50,
                        value: 0,
                        leadPriority: 3,
                    };

                    let firstName = "";
                    let lastName = "";

                    Object.entries(columnMap).forEach(([colIdx, field]) => {
                        const val = values[Number(colIdx)]?.trim();
                        if (val) {
                            if (field === "_firstName") {
                                firstName = val;
                            } else if (field === "_lastName") {
                                lastName = val;
                            } else if (field === "value" || field === "probability" || field === "sqft" || field === "leadPriority") {
                                const num = parseFloat(val.replace(/[$,]/g, ""));
                                if (!isNaN(num)) leadData[field] = num;
                            } else {
                                leadData[field] = val;
                            }
                        }
                    });

                    if ((firstName || lastName) && !leadData.contactName) {
                        leadData.contactName = [firstName, lastName].filter(Boolean).join(" ");
                    }

                    if (!leadData.clientName) {
                        if (leadData.contactName) {
                            leadData.clientName = leadData.contactName;
                        } else if (leadData.contactEmail) {
                            const domain = leadData.contactEmail.split("@")[1];
                            if (domain && !domain.includes("gmail") && !domain.includes("yahoo")) {
                                leadData.clientName = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
                            } else {
                                leadData.clientName = leadData.contactEmail;
                            }
                        } else {
                            results.errors.push(`Row ${i + 1}: No client name or contact info found`);
                            continue;
                        }
                    }

                    await storage.createLead(leadData as any);
                    results.imported++;
                } catch (err: any) {
                    results.errors.push(`Row ${i + 1}: ${err.message || "Invalid data"}`);
                }
            }

            res.json({
                message: `Imported ${results.imported} leads successfully`,
                imported: results.imported,
                errors: results.errors.slice(0, 10),
                totalErrors: results.errors.length,
            });
        } catch (err: any) {
            log("ERROR: CSV Import error - " + (err?.message || err));
            res.status(500).json({ message: err.message || "Failed to import CSV" });
        }
    })
);

// Helper for mapping CPQ status to deal stage
function mapCpqStatusToStage(status?: string): string {
    if (!status) return "Leads";
    const s = status.toLowerCase();
    if (s === "proposal") return "Proposal";
    if (s === "contract" || s === "negotiation") return "Negotiation";
    if (s === "in hand" || s === "accepted") return "Closed Won";
    if (s === "rejected" || s === "lost") return "Closed Lost";
    if (s === "on hold") return "On Hold";
    return "Leads";
}

// POST /api/leads/cpq-import
leadsImportRouter.post(
    "/api/leads/cpq-import",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const cpqData = req.body;

            if (!cpqData || typeof cpqData !== 'object') {
                return res.status(400).json({ message: "Invalid JSON payload" });
            }

            // Basic validation of CPQ structure
            if (!cpqData.projectDetails?.clientName) {
                return res.status(400).json({ message: "Missing clientName in CPQ data" });
            }

            const crmData = cpqData.crmData || {};
            const projectDetails = cpqData.projectDetails || {};
            const pricing = cpqData.pricing || {};

            const leadData: any = {
                clientName: projectDetails.clientName,
                projectName: projectDetails.projectName || "New Project",
                projectAddress: projectDetails.projectAddress || "Address TBD",
                value: String(pricing.totalClientPrice || 0), // Lead schema uses decimal (string)
                probability: parseInt(String(crmData.probabilityOfClosing || "50")) || 50,
                contactName: crmData.accountContact || "Contact TBD",
                contactEmail: crmData.accountContactEmail,
                contactPhone: crmData.accountContactPhone,
                quoteNumber: cpqData.quoteNumber,
                dealStage: mapCpqStatusToStage(crmData.projectStatus),
                importSource: "cpq_json",
                source: "existing_customer", // Default for CPQ exports

                // Rich CPQ Data
                cpqAreas: cpqData.areas || [],
                cpqRisks: cpqData.risks || [],
                cpqTravel: cpqData.travel || {},
                cpqServices: cpqData.additionalServices || {},
                cpqScopingData: {
                    ...(cpqData.scopingData || {}),
                    crmData: crmData,
                    attachments: cpqData.attachments || {}
                },
                // Flatten some fields for core schema compatibility
                sqft: cpqData.areas?.[0]?.squareFeet ? parseInt(String(cpqData.areas[0].squareFeet)) : undefined,
                buildingType: cpqData.areas?.[0]?.buildingType,
                scope: cpqData.areas?.[0]?.scope,
                dispatchLocation: cpqData.travel?.dispatchLocation,
                distance: cpqData.travel?.distance,
                timeline: cpqData.scopingData?.estimatedTimeline,
                paymentTerms: cpqData.scopingData?.paymentTerms,
            };

            const lead = await storage.createLead(leadData);

            log(`INFO: CPQ JSON Import - Created lead ${lead.id} for "${lead.clientName}"`);

            res.status(201).json({
                success: true,
                message: "Lead created successfully from CPQ JSON",
                leadId: lead.id
            });
        } catch (err: any) {
            log("ERROR: CPQ JSON Import error - " + (err?.message || err));
            res.status(500).json({ message: err.message || "Failed to import CPQ JSON" });
        }
    })
);
