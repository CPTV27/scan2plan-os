/**
 * Outreach Automation Service
 * 
 * Manages the 48-hour SLA queue and automated outreach for trigger pod leads.
 * Integrates with Mautic for email campaigns and GHL for SMS/calls.
 * 
 * Per Trigger Pod spec:
 * - First touch within 48 hours of permit filing
 * - Priority routing based on S2P Scoping Bot score
 * - Template-based sequences by trigger type
 */

import { db } from "../db";
import { intelNewsItems, leads, type IntelNewsType } from "@shared/schema";
import { eq, and, gte, lte, desc, isNull, or } from "drizzle-orm";
import { log } from "../lib/logger";
import { enrichContacts, type ContactInfo } from "./contactEnrichment";

// ============================================
// CONSTANTS
// ============================================

const SLA_HOURS = 48; // First touch SLA

// Outreach templates by trigger type
const OUTREACH_TEMPLATES: Record<string, {
    subject: string;
    previewHook: string;
    ctaText: string;
}> = {
    permit: {
        subject: "We noticed your A1/NB filing at {{address}}",
        previewHook: "Need existing conditions documentation for your renovation project?",
        ctaText: "View Sample Deliverables",
    },
    compliance: {
        subject: "{{law}} deadline approaching for {{address}}",
        previewHook: "Accurate as-builts are essential for compliance documentation.",
        ctaText: "Schedule a Quick Call",
    },
    procurement: {
        subject: "Scan-to-BIM support for {{projectName}}",
        previewHook: "We've helped teams win similar RFPs with our precision deliverables.",
        ctaText: "See Proof Vault",
    },
};

// ============================================
// INTERFACES
// ============================================

export interface OutreachQueueItem {
    id: number;
    type: IntelNewsType;
    title: string;
    address?: string;
    contacts: ContactInfo[];
    relevanceScore: number;
    slaStatus: "on_track" | "at_risk" | "overdue";
    hoursUntilSla: number;
    triggerDate: Date;
    recommendedAction: string;
    template?: typeof OUTREACH_TEMPLATES[keyof typeof OUTREACH_TEMPLATES];
}

export interface SlaQueueSummary {
    total: number;
    onTrack: number;
    atRisk: number;
    overdue: number;
    byType: Record<string, number>;
    avgRelevanceScore: number;
}

// ============================================
// SLA QUEUE FUNCTIONS
// ============================================

/**
 * Get all items in the 48-hour SLA queue
 * Sorted by urgency (hours until SLA breach)
 */
export async function getSlaQueue(options?: {
    limit?: number;
    type?: IntelNewsType;
    status?: "on_track" | "at_risk" | "overdue";
}): Promise<OutreachQueueItem[]> {
    const { limit = 50, type, status } = options || {};

    // Get trigger pod items (permit, compliance, procurement)
    const items = await db
        .select()
        .from(intelNewsItems)
        .where(
            and(
                eq(intelNewsItems.isArchived, false),
                or(
                    eq(intelNewsItems.type, "permit"),
                    eq(intelNewsItems.type, "compliance"),
                    eq(intelNewsItems.type, "procurement")
                ),
                type ? eq(intelNewsItems.type, type) : undefined
            )
        )
        .orderBy(desc(intelNewsItems.relevanceScore))
        .limit(limit * 2); // Get extra to filter

    const now = new Date();
    const queueItems: OutreachQueueItem[] = [];

    for (const item of items) {
        const metadata = item.metadata as any || {};
        const triggerDate = item.createdAt || new Date();
        const msElapsed = now.getTime() - triggerDate.getTime();
        const hoursElapsed = msElapsed / (1000 * 60 * 60);
        const hoursUntilSla = SLA_HOURS - hoursElapsed;

        let slaStatus: "on_track" | "at_risk" | "overdue";
        if (hoursUntilSla <= 0) {
            slaStatus = "overdue";
        } else if (hoursUntilSla <= 12) {
            slaStatus = "at_risk";
        } else {
            slaStatus = "on_track";
        }

        // Filter by status if requested
        if (status && slaStatus !== status) continue;

        // Determine recommended action
        let recommendedAction = "Review and qualify";
        if (metadata.enrichedContacts?.length > 0) {
            recommendedAction = "Send outreach email";
        } else if (metadata.qualification?.status === "qualified") {
            recommendedAction = "Enrich contacts";
        }

        queueItems.push({
            id: item.id,
            type: item.type as IntelNewsType,
            title: item.title,
            address: metadata.address || item.title.match(/\] (.+)/)?.[1],
            contacts: metadata.enrichedContacts || [],
            relevanceScore: item.relevanceScore || 50,
            slaStatus,
            hoursUntilSla: Math.max(0, hoursUntilSla),
            triggerDate,
            recommendedAction,
            template: OUTREACH_TEMPLATES[item.type as string],
        });
    }

    // Sort by SLA urgency (overdue first, then by hours)
    queueItems.sort((a, b) => {
        if (a.slaStatus === "overdue" && b.slaStatus !== "overdue") return -1;
        if (b.slaStatus === "overdue" && a.slaStatus !== "overdue") return 1;
        return a.hoursUntilSla - b.hoursUntilSla;
    });

    return queueItems.slice(0, limit);
}

/**
 * Get summary statistics for the SLA queue
 */
export async function getSlaQueueSummary(): Promise<SlaQueueSummary> {
    const items = await getSlaQueue({ limit: 500 });

    const byType: Record<string, number> = {};
    let totalScore = 0;

    for (const item of items) {
        byType[item.type] = (byType[item.type] || 0) + 1;
        totalScore += item.relevanceScore;
    }

    return {
        total: items.length,
        onTrack: items.filter(i => i.slaStatus === "on_track").length,
        atRisk: items.filter(i => i.slaStatus === "at_risk").length,
        overdue: items.filter(i => i.slaStatus === "overdue").length,
        byType,
        avgRelevanceScore: items.length > 0 ? Math.round(totalScore / items.length) : 0,
    };
}

// ============================================
// OUTREACH GENERATION
// ============================================

/**
 * Generate personalized outreach email for a queue item
 */
export function generateOutreachEmail(
    item: OutreachQueueItem,
    contact: ContactInfo
): {
    to: string;
    subject: string;
    body: string;
    plainText: string;
} {
    const template = item.template || OUTREACH_TEMPLATES.permit;

    // Variable replacement
    const vars: Record<string, string> = {
        address: item.address || "your project",
        projectName: item.title,
        law: item.type === "compliance" ? "LL97" : "",
        contactName: contact.name.split(" ")[0] || "there",
        company: contact.company || "your firm",
    };

    let subject = template.subject;
    let body = template.previewHook;

    for (const [key, value] of Object.entries(vars)) {
        subject = subject.replace(`{{${key}}}`, value);
        body = body.replace(`{{${key}}}`, value);
    }

    const fullBody = `Hi ${vars.contactName},

${body}

Scan2Plan specializes in precise existing conditions documentation for renovation and capital improvement projects. Our scan-to-BIM deliverables help teams:

• Reduce RFI volume by 40%
• Accelerate pre-design by 2-3 weeks
• Ensure compliance documentation accuracy

Would you have 15 minutes this week to discuss how we might support your project?

${template.ctaText}: https://scan2plan.io/proof-vault

Best regards,
The Scan2Plan Team`;

    return {
        to: contact.email || "",
        subject,
        body: fullBody,
        plainText: fullBody.replace(/<[^>]*>/g, ""),
    };
}

// ============================================
// MAUTIC INTEGRATION HELPERS
// ============================================

/**
 * Prepare leads for Mautic sync from SLA queue items
 */
export async function prepareLeadsFromQueue(
    items: OutreachQueueItem[]
): Promise<number> {
    let created = 0;

    for (const item of items) {
        for (const contact of item.contacts) {
            if (!contact.email) continue;

            // Check if lead already exists
            const existing = await db
                .select()
                .from(leads)
                .where(eq(leads.contactEmail, contact.email))
                .limit(1);

            if (existing.length > 0) continue;

            // Create lead from trigger pod item
            await db.insert(leads).values({
                clientName: contact.company || contact.name,
                projectName: item.title,
                projectAddress: item.address,
                contactName: contact.name,
                contactEmail: contact.email,
                contactPhone: contact.phone,
                dealStage: "prospecting",
                source: `trigger-pod-${item.type}`,
                buildingType: "Unknown",
                value: "0",
                probability: 20,
            });
            created++;
        }
    }

    log(`[Outreach] Created ${created} leads from SLA queue`);
    return created;
}

// ============================================
// SEQUENCE AUTOMATION
// ============================================

export interface OutreachSequence {
    name: string;
    triggerType: IntelNewsType;
    steps: Array<{
        delayDays: number;
        channel: "email" | "sms" | "call";
        template: string;
    }>;
}

// Default sequences per trigger type
export const DEFAULT_SEQUENCES: OutreachSequence[] = [
    {
        name: "Permit Filing Outreach",
        triggerType: "permit",
        steps: [
            { delayDays: 0, channel: "email", template: "permit_initial" },
            { delayDays: 3, channel: "email", template: "permit_followup" },
            { delayDays: 7, channel: "email", template: "permit_value_add" },
        ],
    },
    {
        name: "Compliance Alert Outreach",
        triggerType: "compliance",
        steps: [
            { delayDays: 0, channel: "email", template: "compliance_alert" },
            { delayDays: 2, channel: "email", template: "compliance_urgency" },
            { delayDays: 5, channel: "call", template: "compliance_call_script" },
        ],
    },
    {
        name: "RFP Response Outreach",
        triggerType: "procurement",
        steps: [
            { delayDays: 0, channel: "email", template: "rfp_intro" },
            { delayDays: 2, channel: "email", template: "rfp_case_study" },
            { delayDays: 4, channel: "email", template: "rfp_meeting_request" },
        ],
    },
];

/**
 * Get the appropriate sequence for a trigger type
 */
export function getSequenceForType(type: IntelNewsType): OutreachSequence | null {
    return DEFAULT_SEQUENCES.find(s => s.triggerType === type) || null;
}
