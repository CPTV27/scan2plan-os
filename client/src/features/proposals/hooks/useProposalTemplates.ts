/**
 * useProposalTemplates Hook
 * 
 * Fetches proposal templates and template groups from the API.
 * Provides variable substitution utilities for the layout editor.
 */

import { useQuery } from "@tanstack/react-query";
import type { ProposalTemplate, ProposalTemplateGroup, Lead, CpqQuote } from "@shared/schema";

interface GroupedTemplates {
    [category: string]: ProposalTemplate[];
}

interface ExpandedSection {
    templateId: number;
    sortOrder: number;
    required: boolean;
    template: ProposalTemplate;
}

interface ExpandedTemplateGroup extends ProposalTemplateGroup {
    expandedSections: ExpandedSection[];
}

// Variable context for substitution
interface VariableContext {
    lead: Lead | null;
    quote: CpqQuote | null;
}

// Format currency helper
function formatCurrency(value: number | string | null | undefined): string {
    const num = Number(value) || 0;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(num);
}

// Format date helper
function formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

// Generate pricing table as markdown
function generatePricingTable(quote: CpqQuote | null): string {
    if (!quote) return "*No pricing available*";

    const breakdown = (quote.pricingBreakdown as Record<string, number> | null) || {};

    const rows = [
        ["Service", "Amount"],
        ["---", "---"],
    ];

    if (breakdown.scanningTotal) {
        rows.push(["Laser Scanning Services", formatCurrency(breakdown.scanningTotal)]);
    }
    if (breakdown.bimTotal) {
        rows.push(["BIM Modeling Services", formatCurrency(breakdown.bimTotal)]);
    }
    if (breakdown.travelTotal) {
        rows.push(["Travel & Logistics", formatCurrency(breakdown.travelTotal)]);
    }
    if (breakdown.addOnsTotal && Number(breakdown.addOnsTotal) > 0) {
        rows.push(["Additional Services", formatCurrency(breakdown.addOnsTotal)]);
    }
    rows.push(["**Total**", `**${formatCurrency(quote.totalPrice)}**`]);

    return rows.map(row => `| ${row.join(" | ")} |`).join("\n");
}

// Substitute variables in template content
export function substituteVariables(content: string, context: VariableContext): string {
    const { lead, quote } = context;

    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + 30);

    const variables: Record<string, string> = {
        // Lead data
        client_name: lead?.clientName || "[Client Name]",
        project_name: lead?.projectName || lead?.clientName || "[Project Name]",
        project_address: lead?.projectAddress || "[Project Address]",
        building_type: lead?.buildingType || "[Building Type]",
        scope: lead?.scope || "Full Building",
        contact_name: lead?.contactName || "[Contact Name]",
        contact_email: lead?.contactEmail || "[Contact Email]",

        // Quote data
        total_price: formatCurrency(quote?.totalPrice),
        timeline: "2-4 weeks",
        line_items_table: generatePricingTable(quote),

        // Computed fields
        quote_date: formatDate(now),
        valid_until: formatDate(validUntil),

        // Company info
        company_name: "Scan2Plan",
        company_address: "188 1st St, Troy, NY 12180",
        company_phone: "(518) 362-2403",
    };

    // Replace all {{variable}} patterns
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] || match;
    });
}

// Hook to fetch all templates
export function useProposalTemplates() {
    return useQuery<ProposalTemplate[]>({
        queryKey: ["/api/proposal-templates"],
    });
}

// Hook to fetch templates grouped by category
export function useGroupedTemplates() {
    return useQuery<GroupedTemplates>({
        queryKey: ["/api/proposal-templates/grouped"],
    });
}

// Hook to fetch template groups
export function useTemplateGroups() {
    return useQuery<ProposalTemplateGroup[]>({
        queryKey: ["/api/proposal-template-groups"],
    });
}

// Hook to fetch a specific template group with expanded sections
export function useTemplateGroup(groupId: number | null) {
    return useQuery<ExpandedTemplateGroup>({
        queryKey: ["/api/proposal-template-groups", groupId],
        enabled: !!groupId,
    });
}

// Default section structure for a new proposal
export interface ProposalSection {
    id: string; // Unique key for React
    templateId: number;
    category: string;
    name: string;
    content: string;
    sortOrder: number;
    included: boolean;
}

// Build default sections from a template group
export function buildDefaultSections(
    group: ExpandedTemplateGroup | undefined,
    context: VariableContext
): ProposalSection[] {
    if (!group?.expandedSections) return [];

    return group.expandedSections.map((section, idx) => ({
        id: `section-${section.templateId}-${idx}`,
        templateId: section.templateId,
        category: section.template.category || "other",
        name: section.template.name,
        content: substituteVariables(section.template.content, context),
        sortOrder: section.sortOrder,
        included: true,
    }));
}

// Category display names
export const CATEGORY_LABELS: Record<string, string> = {
    intro: "Introduction",
    company: "Company Info",
    scope: "Scope & Deliverables",
    pricing: "Pricing",
    terms: "Payment Terms",
    legal: "Legal",
    appendix: "Appendix",
    boilerplate: "Boilerplate",
    other: "Other",
};

// Category order for sorting
export const CATEGORY_ORDER = ["intro", "company", "scope", "pricing", "terms", "legal", "appendix", "other"];
