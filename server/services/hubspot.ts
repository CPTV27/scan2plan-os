// Simplified HubSpot service stub for Sales and Production
// Full HubSpot integration removed in stripped-down version

import { log } from "../lib/logger";
import type { Lead } from "../../shared/schema";

interface Persona {
    code: string;
    name: string;
}

interface SyncResult {
    success: boolean;
    error?: string;
    contactId?: string;
}

/**
 * Check if HubSpot is connected
 * Always returns false in stripped-down version
 */
export async function isHubSpotConnected(): Promise<boolean> {
    return false;
}

/**
 * Get personas list
 * Returns empty array in stripped-down version
 */
export async function getPersonas(): Promise<Persona[]> {
    return [];
}

/**
 * Sync lead to HubSpot
 * Returns stub result in stripped-down version
 */
export async function syncLead(lead: Lead, persona: Persona): Promise<SyncResult> {
    log(`[HubSpot] Would sync lead ${lead.id} with persona ${persona.code}`);

    return {
        success: false,
        error: "HubSpot integration not available in this version"
    };
}

/**
 * Update lead from HubSpot deal
 * No-op in stripped-down version
 */
export async function updateLeadFromHubSpotDeal(objectId: string, propertyValue: string): Promise<void> {
    log(`[HubSpot] Would update lead from deal ${objectId} with value ${propertyValue}`);
}
