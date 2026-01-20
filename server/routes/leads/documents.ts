import { Router } from "express";
import { storage } from "../../storage";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { log } from "../../lib/logger";

export const leadsDocumentsRouter = Router();

// GET /api/leads/:id/estimate-pdf
leadsDocumentsRouter.get(
    "/api/leads/:id/estimate-pdf",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const leadId = Number(req.params.id);
            const lead = await storage.getLead(leadId);

            if (!lead) {
                return res.status(404).json({ message: "Lead not found" });
            }

            const { generateEstimatePDF } = await import("../../pdf-generator");
            const doc = generateEstimatePDF({ lead });

            const filename = `Estimate-${lead.projectCode || lead.id}-${lead.clientName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

            doc.pipe(res);
            doc.end();
        } catch (err) {
            log("ERROR: PDF generation error - " + (err as any)?.message);
            return res.status(500).json({ message: "Failed to generate PDF estimate" });
        }
    })
);
