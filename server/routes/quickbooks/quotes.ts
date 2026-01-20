import { Router } from "express";
import { isAuthenticated, requireRole } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { quickbooksClient } from "../../quickbooks-client";
import { storage } from "../../storage";
import { log } from "../../lib/logger";
import { z } from "zod";
import skuMapper from "../../lib/skuMapper";

export const quickbooksQuotesRouter = Router();

// Map QBO estimate status to deal stage
export function mapQboStatusToDealStage(estimate: any): string {
    const status = estimate.TxnStatus;

    if (estimate.LinkedTxn?.some((txn: any) => txn.TxnType === 'Invoice')) {
        return 'Closed Won';
    }

    switch (status) {
        case 'Accepted': return 'Closed Won';
        case 'Rejected': return 'Closed Lost';
        case 'Closed': return 'Closed Lost';
        case 'Pending':
        default: return 'Proposal';
    }
}

// Get probability based on deal stage
export function getStageProbability(stage: string): number {
    switch (stage) {
        case 'Closed Won': return 100;
        case 'Closed Lost': return 0;
        case 'Negotiation': return 75;
        case 'Proposal': return 50;
        case 'Qualified': return 25;
        default: return 10;
    }
}

// Helper: Create a project from a Closed Won lead (if not already exists)
export async function ensureProjectForClosedWonLead(leadId: number): Promise<boolean> {
    try {
        const existingProject = await storage.getProjectByLeadId(leadId);
        if (existingProject) {
            log(`[Project Creation] Project already exists for lead ${leadId} (project ID: ${existingProject.id})`);
            return false;
        }

        const lead = await storage.getLead(leadId);
        if (!lead || lead.dealStage !== "Closed Won") return false;

        const quotes = await storage.getCpqQuotesByLead(leadId);
        const latestQuote = quotes.find(q => q.isLatest) || quotes[0];

        const project = await storage.createProject({
            name: lead.projectName || `${lead.clientName} Project`,
            leadId: lead.id,
            status: "Scheduling",
            priority: "Medium",
            progress: 0,
            clientName: lead.clientName,
            clientContact: lead.contactName,
            clientEmail: lead.contactEmail,
            clientPhone: lead.contactPhone,
            projectAddress: lead.projectAddress,
            dispatchLocation: lead.dispatchLocation,
            distance: lead.distance ? parseInt(String(lead.distance)) : undefined,
            estimatedSqft: latestQuote?.areas ?
                (latestQuote.areas as any[])?.reduce((sum: number, area: any) => sum + (area.sqft || 0), 0) : undefined,
            quotedPrice: latestQuote?.totalPrice ? String(latestQuote.totalPrice) : lead.value,
            quotedMargin: undefined,
            quotedAreas: latestQuote?.areas as any[] | undefined,
            quotedRisks: latestQuote?.risks as any,
            quotedTravel: latestQuote?.travel as any,
            quotedServices: latestQuote?.services as any,
            siteReadiness: lead.siteReadiness as any,
            scopeSummary: undefined,
        } as any);

        log(`[Project Creation] Created project ID ${project.id} from Closed Won lead ${leadId}`);
        return true;
    } catch (error: any) {
        log(`[Project Creation] Error creating project for lead ${leadId}: ${error.message}`);
        return false;
    }
}

// GET /api/quickbooks/estimate-url/:leadId
quickbooksQuotesRouter.get(
    "/api/quickbooks/estimate-url/:leadId",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const leadId = Number(req.params.leadId);
            const lead = await storage.getLead(leadId);
            if (!lead) return res.status(404).json({ message: "Lead not found" });

            const isConnected = await quickbooksClient.isConnected();
            const realmId = isConnected ? await quickbooksClient.getRealmId() : null;

            if (!isConnected || !realmId) {
                return res.json({ url: null, connected: false, estimateId: lead.qboEstimateId, estimateNumber: lead.qboEstimateNumber });
            }

            if (!lead.qboEstimateId) return res.json({ url: null, connected: true });

            const url = quickbooksClient.getEstimateUrl(lead.qboEstimateId, realmId);
            res.json({ url, connected: true, estimateId: lead.qboEstimateId, estimateNumber: lead.qboEstimateNumber });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);

const createEstimateSchema = z.object({
    quoteId: z.number().int().positive(),
    contactEmail: z.string().email().optional(),
    forceResync: z.boolean().optional().default(false),
});

// POST /api/quickbooks/estimate
quickbooksQuotesRouter.post(
    "/api/quickbooks/estimate",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const parsed = createEstimateSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    message: "Invalid request data",
                    errors: parsed.error.errors
                });
            }

            const { quoteId, contactEmail, forceResync } = parsed.data;

            const quote = await storage.getCpqQuote(quoteId);
            if (!quote) return res.status(404).json({ message: "Quote not found" });
            if (!quote.leadId) return res.status(400).json({ message: "Quote is not linked to a lead" });

            const lead = await storage.getLead(quote.leadId);
            if (!lead) return res.status(404).json({ message: "Lead not found" });

            if (lead.qboEstimateId && !forceResync) {
                return res.status(409).json({
                    message: "Estimate already exists in QuickBooks",
                    estimateId: lead.qboEstimateId,
                    estimateNumber: lead.qboEstimateNumber,
                });
            }

            const isConnected = await quickbooksClient.isConnected();
            if (!isConnected) {
                return res.status(401).json({ message: "QuickBooks not connected", needsReauth: true });
            }

            // Transform CPQ quote pricing_breakdown into line items with official SKUs
            const lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number; discipline?: string; sku?: string }> = [];
            const pricingBreakdown = quote.pricingBreakdown as any;
            const areas = quote.areas as any[];

            const areaBreakdown = pricingBreakdown?.areaBreakdown || pricingBreakdown?.areas || [];
            if (Array.isArray(areaBreakdown)) {
                for (const area of areaBreakdown) {
                    const areaName = area.name || area.label || `Area ${area.id}`;
                    const price = Number(area.price || area.subtotal || area.total || 0);

                    const areaConfig = areas?.find(a => a.name === area.name || a.id === area.id);
                    const disciplines = areaConfig?.disciplines as string[] || [];
                    const primaryDiscipline = disciplines[0];
                    const buildingType = areaConfig?.buildingType || "1";
                    const primaryLod = areaConfig?.disciplineLods?.architecture?.lod || areaConfig?.lod || "300";
                    const scope = areaConfig?.disciplineLods?.architecture?.scope || areaConfig?.scope || "full";

                    // Get official SKU for primary service
                    const primarySku = skuMapper.getPrimaryServiceSku(buildingType, primaryLod, scope);

                    if (price > 0 && !isNaN(price)) {
                        lineItems.push({
                            description: `${areaName}${disciplines.length > 0 ? ` (${disciplines.join(', ')})` : ''}`,
                            quantity: 1,
                            unitPrice: price,
                            amount: price,
                            discipline: primaryDiscipline,
                            sku: primarySku,
                        });
                    }

                    // Add added discipline line items (MEPF, Structure, etc.)
                    // Price is bundled in area total, so these are $0 tracking line items with official SKUs
                    for (const disc of disciplines) {
                        if (disc === 'architecture' || disc === 'arch') continue;
                        const discLod = areaConfig?.disciplineLods?.[disc]?.lod || primaryLod;
                        const discSku = skuMapper.getAddedDisciplineSku(disc, discLod);
                        
                        // Add as $0 line item for QB SKU tracking (included in area price above)
                        lineItems.push({
                            description: `${areaName} - ${disc.toUpperCase()} (Included)`,
                            quantity: 1,
                            unitPrice: 0,
                            amount: 0,
                            discipline: disc,
                            sku: discSku,
                        });
                    }
                }
            }

            const travelCost = Number(pricingBreakdown?.travelCost || 0);
            const travel = quote.travel as any;
            if (travelCost > 0 && !isNaN(travelCost)) {
                lineItems.push({
                    description: `Travel - ${travel?.distance || 0} miles from ${travel?.dispatchLocation || 'Office'}`,
                    quantity: 1,
                    unitPrice: travelCost,
                    amount: travelCost,
                });
            }

            // Add services (Matterport, etc.) with SKUs
            const services = quote.services as Record<string, number> | null;
            if (services) {
                for (const [service, qty] of Object.entries(services)) {
                    if (qty && qty > 0) {
                        const serviceSku = skuMapper.getServiceSku(service);
                        const serviceCost = Number(pricingBreakdown?.serviceCosts?.[service] || 0);
                        if (serviceCost > 0) {
                            lineItems.push({
                                description: `${service.charAt(0).toUpperCase() + service.slice(1)} Service`,
                                quantity: qty,
                                unitPrice: serviceCost / qty,
                                amount: serviceCost,
                                sku: serviceSku,
                            });
                        }
                    }
                }
            }

            // Add risk modifiers with SKUs
            const risks = quote.risks as string[] | null;
            if (risks && Array.isArray(risks)) {
                for (const risk of risks) {
                    const riskSku = skuMapper.getPriceModSku(risk);
                    const riskCost = Number(pricingBreakdown?.riskPremiums?.[risk] || 0);
                    if (riskCost > 0) {
                        lineItems.push({
                            description: `Risk Premium: ${risk.charAt(0).toUpperCase() + risk.slice(1)}`,
                            quantity: 1,
                            unitPrice: riskCost,
                            amount: riskCost,
                            sku: riskSku,
                        });
                    }
                }
            }

            // Add adjustments/reconciliation logic (omitted for brevity, essentially the same as original)
            // Check total diff
            const quoteTotalPrice = Number(quote.totalPrice || pricingBreakdown?.totalPrice || 0);
            const lineItemsTotal = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

            if (quoteTotalPrice > 0 && !isNaN(quoteTotalPrice) && !isNaN(lineItemsTotal)) {
                const difference = Math.round((quoteTotalPrice - lineItemsTotal) * 100) / 100;
                if (Math.abs(difference) >= 0.01) {
                    lineItems.push({
                        description: difference > 0 ? 'Project Adjustments' : 'Discount Adjustment',
                        quantity: 1,
                        unitPrice: difference,
                        amount: difference,
                    });
                }
            }

            const clientName = quote.clientName || lead.clientName || 'Unknown Client';
            const projectName = quote.projectName || lead.projectName || 'Project';
            const email = contactEmail || lead.contactEmail || lead.billingContactEmail || (quote as any).billingContactEmail || undefined;

            let result;
            try {
                result = await quickbooksClient.createEstimateFromQuote(
                    lead.id,
                    clientName,
                    projectName,
                    lineItems,
                    email
                );
            } catch (qbError: any) {
                throw qbError;
            }

            try {
                await storage.updateLead(lead.id, {
                    qboEstimateId: result.estimateId,
                    qboEstimateNumber: result.estimateNumber,
                    qboCustomerId: result.customerId,
                    qboSyncedAt: new Date(),
                } as any);
            } catch (updateError: any) {
                return res.status(500).json({
                    message: `Estimate ${result.estimateNumber} created but failed to save locally.`,
                    estimateId: result.estimateId,
                    partialSuccess: true,
                });
            }

            log(`[QuickBooks] Created estimate ${result.estimateNumber} for lead ${lead.id}`);

            res.json({
                message: "Estimate created successfully",
                estimateId: result.estimateId,
                estimateNumber: result.estimateNumber,
                customerId: result.customerId,
            });
        } catch (error: any) {
            log("ERROR: [QuickBooks] Create estimate error - " + error.message);
            res.status(500).json({ message: error.message || "Failed to create estimate" });
        }
    })
);

// GET /api/quickbooks/estimate/:estimateId/pdf
quickbooksQuotesRouter.get(
    "/api/quickbooks/estimate/:estimateId/pdf",
    isAuthenticated,
    requireRole("ceo", "sales"),
    asyncHandler(async (req, res) => {
        try {
            const { estimateId } = req.params;
            if (!estimateId) return res.status(400).json({ message: "Estimate ID is required" });

            const isConnected = await quickbooksClient.isConnected();
            if (!isConnected) return res.status(401).json({ message: "QuickBooks not connected", needsReauth: true });

            const pdfBuffer = await quickbooksClient.downloadEstimatePdf(estimateId);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="estimate-${estimateId}.pdf"`);
            res.setHeader("Content-Length", pdfBuffer.length.toString());
            res.send(pdfBuffer);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    })
);
