// Simplified staleness module for Sales and Production
// Full staleness tracking removed in stripped-down version

import { storage } from "./storage";
import { log } from "./lib/logger";

interface StalenessStatus {
    isStale: boolean;
    level: "fresh" | "warning" | "critical";
    daysSinceContact: number;
    message: string;
}

interface ApplyResult {
    updated: number;
    leads: { id: number; clientName: string }[];
}

/**
 * Get staleness status for a lead based on last contact date
 */
export function getStalenessStatus(lastContactDate: Date | string | null | undefined): StalenessStatus {
    if (!lastContactDate) {
        return {
            isStale: false,
            level: "fresh",
            daysSinceContact: 0,
            message: "No contact date recorded"
        };
    }

    const now = new Date();
    const contactDate = new Date(lastContactDate);
    const daysSinceContact = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceContact >= 14) {
        return {
            isStale: true,
            level: "critical",
            daysSinceContact,
            message: "Critical: No contact in over 2 weeks"
        };
    } else if (daysSinceContact >= 7) {
        return {
            isStale: true,
            level: "warning",
            daysSinceContact,
            message: "Warning: No contact in over 1 week"
        };
    }

    return {
        isStale: false,
        level: "fresh",
        daysSinceContact,
        message: "Recently contacted"
    };
}

/**
 * Apply staleness penalties to leads - simplified version
 */
export async function applyStalenessPenalties(): Promise<ApplyResult> {
    const leads = await storage.getLeads();
    const updatedLeads: { id: number; clientName: string }[] = [];

    for (const lead of leads) {
        const status = getStalenessStatus(lead.lastContactDate);

        if (status.isStale && lead.probability && lead.probability > 10) {
            // Apply a simple penalty
            const penalty = status.level === "critical" ? 10 : 5;
            const newProbability = Math.max(10, (lead.probability || 50) - penalty);

            await storage.updateLead(lead.id, { probability: newProbability });
            updatedLeads.push({ id: lead.id, clientName: lead.clientName });
        }
    }

    log(`[Staleness] Applied penalties to ${updatedLeads.length} leads`);

    return {
        updated: updatedLeads.length,
        leads: updatedLeads
    };
}
