/**
 * Variable Substitution Module
 * 
 * Provides {{variable}} substitution for proposal templates in PDF generation.
 * Mirror of client-side substituteVariables with additional server context.
 */

import type { Lead, CpqQuote } from "@shared/schema";
import type { ProposalData, LineItem } from "../pdf/proposalGenerator";
import {
    calculateTotalSqft,
    extractScope,
    extractDisciplines,
    extractLodLevels,
    generateLineItems,
} from "./proposalDataMapper";

/**
 * Format currency for display
 */
export function formatCurrency(value: number | string | null | undefined): string {
    const num = Number(value) || 0;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(num);
}

/**
 * Format currency with cents
 */
export function formatCurrencyWithCents(value: number | string | null | undefined): string {
    const num = Number(value) || 0;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Format number with commas
 */
export function formatNumber(value: number | null | undefined): string {
    const num = Number(value) || 0;
    return num.toLocaleString("en-US");
}

/**
 * Generate a markdown pricing table from line items
 */
export function generatePricingTableMarkdown(lineItems: LineItem[]): string {
    if (lineItems.length === 0) {
        return "*No pricing available*";
    }

    const lines: string[] = [
        "| Service | Qty | Rate | Amount |",
        "|---------|-----|------|--------|",
    ];

    lineItems.forEach((item) => {
        const qty = typeof item.qty === "number" ? formatNumber(item.qty) : String(item.qty);
        const rate = formatCurrencyWithCents(item.rate);
        const amount = formatCurrency(item.amount);
        lines.push(`| ${item.item} | ${qty} | ${rate} | ${amount} |`);
    });

    const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
    lines.push(`| **Total** | | | **${formatCurrency(total)}** |`);

    return lines.join("\n");
}

/**
 * Build the complete variable map for substitution
 */
export function buildVariableMap(
    lead: Lead,
    quote: CpqQuote | null,
    proposalData?: ProposalData
): Record<string, string> {
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + 30);

    // Calculate values from quote or fallback to lead
    const totalSqft = quote ? calculateTotalSqft(quote.areas as any[]) : lead.sqft || 0;
    const scopeSummary = quote ? extractScope(quote.areas as any[]) : lead.scope || "Full Building";
    const disciplines = quote ? extractDisciplines(quote.areas as any[]) : "Architecture";
    const lodLevels = quote ? extractLodLevels(quote.areas as any[]) : ["300"];
    const lineItems = generateLineItems(quote, lead);
    const total = quote?.totalPrice ? Number(quote.totalPrice) : lineItems.reduce((sum, i) => sum + i.amount, 0);
    const upfrontAmount = total * 0.5;

    // Use proposalData if provided (already computed values)
    const projectName = proposalData?.projectTitle || quote?.projectName || lead.projectName || lead.clientName || "";
    const clientName = proposalData?.clientName || quote?.clientName || lead.clientName || "";
    const projectAddress = proposalData?.location || quote?.projectAddress || lead.projectAddress || "";
    const buildingType = proposalData?.overview?.buildingType || (quote as any)?.typeOfBuilding || lead.buildingType || "";

    return {
        // Project identifiers
        project_name: projectName,
        projectName: projectName,
        client_name: clientName,
        clientName: clientName,

        // Location
        project_address: projectAddress,
        projectAddress: projectAddress,
        location: projectAddress,

        // Building info
        building_type: buildingType,
        buildingType: buildingType,
        total_sqft: formatNumber(totalSqft),
        totalSqft: formatNumber(totalSqft),
        sqft: formatNumber(totalSqft),

        // Scope
        scope: scopeSummary,
        scope_summary: scopeSummary,
        disciplines: disciplines,
        lod_levels: lodLevels.join(", "),
        lodLevels: lodLevels.join(", "),

        // Deliverables
        bim_deliverable: (quote as any)?.scopingData?.bimDeliverable || lead.bimDeliverable || "Revit",
        bimDeliverable: (quote as any)?.scopingData?.bimDeliverable || lead.bimDeliverable || "Revit",
        bim_version: (quote as any)?.scopingData?.bimVersion || lead.bimVersion || "2024",
        bimVersion: (quote as any)?.scopingData?.bimVersion || lead.bimVersion || "2024",
        deliverables: proposalData?.scope?.deliverables || "Revit Model, Point Cloud",

        // Timeline
        timeline: proposalData?.timeline?.duration || lead.timeline || "4-6 weeks",
        duration: proposalData?.timeline?.duration || lead.timeline || "4-6 weeks",

        // Pricing
        total_price: formatCurrency(total),
        totalPrice: formatCurrency(total),
        total: formatCurrency(total),
        subtotal: formatCurrency(proposalData?.subtotal || total),
        upfront_amount: formatCurrency(upfrontAmount),
        upfrontAmount: formatCurrency(upfrontAmount),
        final_amount: formatCurrency(total - upfrontAmount),
        finalAmount: formatCurrency(total - upfrontAmount),

        // Line items (markdown table)
        line_items_table: generatePricingTableMarkdown(lineItems),
        lineItemsTable: generatePricingTableMarkdown(lineItems),
        pricing_table: generatePricingTableMarkdown(lineItems),

        // Payment terms
        payment_terms: lead.paymentTerms || quote?.paymentTerms || "Net 30",
        paymentTerms: lead.paymentTerms || quote?.paymentTerms || "Net 30",

        // Dates
        quote_date: formatDate(now),
        quoteDate: formatDate(now),
        date: formatDate(now),
        valid_until: formatDate(validUntil),
        validUntil: formatDate(validUntil),
        proposal_date: formatDate(now),
        proposalDate: formatDate(now),

        // Contact info
        contact_name: lead.contactName || "",
        contactName: lead.contactName || "",
        contact_email: lead.contactEmail || "",
        contactEmail: lead.contactEmail || "",
        contact_phone: lead.contactPhone || "",
        contactPhone: lead.contactPhone || "",

        // Company info (hardcoded for Scan2Plan)
        company_name: "Scan2Plan",
        companyName: "Scan2Plan",
        company_address: "188 1st St, Troy, NY 12180",
        companyAddress: "188 1st St, Troy, NY 12180",
        company_phone: "(518) 362-2403",
        companyPhone: "(518) 362-2403",
        company_email: "admin@scan2plan.io",
        companyEmail: "admin@scan2plan.io",
        company_website: "www.scan2plan.com",
        companyWebsite: "www.scan2plan.com",
    };
}

/**
 * Substitute all {{variable}} placeholders in a template string
 * 
 * Supports both snake_case and camelCase variable names.
 * Unmatched variables are left as-is for debugging visibility.
 */
export function substituteVariables(
    template: string,
    lead: Lead,
    quote: CpqQuote | null,
    proposalData?: ProposalData
): string {
    const variables = buildVariableMap(lead, quote, proposalData);

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        // Try exact match first
        if (key in variables) {
            return variables[key];
        }

        // Try converting camelCase to snake_case
        const snakeCase = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        if (snakeCase in variables) {
            return variables[snakeCase];
        }

        // Try converting snake_case to camelCase
        const camelCase = key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
        if (camelCase in variables) {
            return variables[camelCase];
        }

        // Return original if no match found
        return match;
    });
}

/**
 * Process an array of template sections with variable substitution
 */
export function processTemplateSections(
    sections: Array<{ content: string;[key: string]: any }>,
    lead: Lead,
    quote: CpqQuote | null,
    proposalData?: ProposalData
): Array<{ content: string;[key: string]: any }> {
    return sections.map((section) => ({
        ...section,
        content: substituteVariables(section.content, lead, quote, proposalData),
    }));
}

/**
 * Get a list of all available variable names for documentation
 */
export function getAvailableVariables(): Array<{ name: string; description: string }> {
    return [
        // Project
        { name: "project_name", description: "Project name" },
        { name: "client_name", description: "Client/company name" },
        { name: "project_address", description: "Project address/location" },
        { name: "building_type", description: "Type of building (e.g., Office, Warehouse)" },
        { name: "total_sqft", description: "Total square footage with commas" },

        // Scope
        { name: "scope", description: "Scope summary (e.g., Interior + Exterior)" },
        { name: "disciplines", description: "Modeling disciplines with LOD levels" },
        { name: "lod_levels", description: "LOD levels as comma-separated list" },
        { name: "bim_deliverable", description: "BIM deliverable format (e.g., Revit)" },
        { name: "bim_version", description: "BIM software version (e.g., 2024)" },
        { name: "deliverables", description: "Full deliverables description" },

        // Timeline
        { name: "timeline", description: "Project timeline (e.g., 4-6 weeks)" },

        // Pricing
        { name: "total_price", description: "Total price formatted as currency" },
        { name: "subtotal", description: "Subtotal formatted as currency" },
        { name: "upfront_amount", description: "50% upfront payment amount" },
        { name: "final_amount", description: "50% final payment amount" },
        { name: "line_items_table", description: "Pricing table as markdown" },

        // Payment
        { name: "payment_terms", description: "Payment terms (e.g., Net 30)" },

        // Dates
        { name: "quote_date", description: "Quote creation date" },
        { name: "valid_until", description: "Quote expiration date (30 days)" },

        // Contact
        { name: "contact_name", description: "Primary contact name" },
        { name: "contact_email", description: "Primary contact email" },
        { name: "contact_phone", description: "Primary contact phone" },

        // Company
        { name: "company_name", description: "Company name (Scan2Plan)" },
        { name: "company_address", description: "Company address" },
        { name: "company_phone", description: "Company phone" },
        { name: "company_email", description: "Company email" },
    ];
}
