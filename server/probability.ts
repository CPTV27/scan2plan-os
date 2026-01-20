// Simplified probability module for Sales and Production
// Full probability calculations removed in stripped-down version

import { storage } from "./storage";
import { log } from "./lib/logger";
import type { Lead } from "../shared/schema";

interface ProbabilityFactors {
    baseScore: number;
    stageBonus: number;
    engagementBonus: number;
    stalenessPenalty: number;
    finalScore: number;
}

interface RecalculateResult {
    updated: number;
    leads: { id: number; clientName: string; oldProbability: number; newProbability: number }[];
}

interface StageStaleness {
    isStale: boolean;
    daysSinceContact: number;
    expectedDays: number;
}

// Base probabilities by deal stage
const STAGE_BASE_PROBABILITIES: Record<string, number> = {
    "Leads": 20,
    "Contacted": 30,
    "Proposal": 50,
    "Negotiation": 70,
    "On Hold": 30,
    "Closed Won": 100,
    "Closed Lost": 0
};

/**
 * Calculate probability factors for a lead
 */
export function calculateProbability(lead: Lead): ProbabilityFactors {
    const stage = lead.dealStage || "Leads";
    const baseScore = STAGE_BASE_PROBABILITIES[stage] || 20;

    // Simple engagement bonus based on value
    const engagementBonus = lead.value ? Math.min(10, parseInt(lead.value) / 10000) : 0;

    // Stage bonus for advanced stages
    const stageBonus = stage === "Negotiation" ? 10 : stage === "Proposal" ? 5 : 0;

    // Staleness penalty
    let stalenessPenalty = 0;
    if (lead.lastContactDate) {
        const daysSince = Math.floor((Date.now() - new Date(lead.lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > 14) stalenessPenalty = 15;
        else if (daysSince > 7) stalenessPenalty = 5;
    }

    const finalScore = Math.max(0, Math.min(100, baseScore + stageBonus + engagementBonus - stalenessPenalty));

    return {
        baseScore,
        stageBonus,
        engagementBonus,
        stalenessPenalty,
        finalScore
    };
}

/**
 * Recalculate probabilities for all leads
 */
export async function recalculateAllProbabilities(): Promise<RecalculateResult> {
    const leads = await storage.getLeads();
    const updatedLeads: { id: number; clientName: string; oldProbability: number; newProbability: number }[] = [];

    for (const lead of leads) {
        const factors = calculateProbability(lead);
        const oldProbability = lead.probability || 0;

        if (Math.abs(factors.finalScore - oldProbability) > 1) {
            await storage.updateLead(lead.id, { probability: factors.finalScore });
            updatedLeads.push({
                id: lead.id,
                clientName: lead.clientName,
                oldProbability,
                newProbability: factors.finalScore
            });
        }
    }

    log(`[Probability] Recalculated ${updatedLeads.length} leads`);

    return {
        updated: updatedLeads.length,
        leads: updatedLeads
    };
}

/**
 * Get stage-specific staleness thresholds
 */
export function getStageSpecificStaleness(stage: string, lastContactDate: Date | string | null | undefined): StageStaleness {
    const expectedDays: Record<string, number> = {
        "Leads": 7,
        "Contacted": 5,
        "Proposal": 3,
        "Negotiation": 2,
        "On Hold": 14,
        "Closed Won": 30,
        "Closed Lost": 30
    };

    const expected = expectedDays[stage] || 7;

    if (!lastContactDate) {
        return { isStale: true, daysSinceContact: 0, expectedDays: expected };
    }

    const daysSince = Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24));

    return {
        isStale: daysSince > expected,
        daysSinceContact: daysSince,
        expectedDays: expected
    };
}
