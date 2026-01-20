/**
 * Contact Enrichment Service
 * 
 * Discovers owner/PM/design professional contacts from public records:
 * - NYC HPD Registration (building owners, managing agents)
 * - NY DOS Business Entity Search (firm contacts)
 * - MA Secretary of State (Boston area firms)
 * 
 * Per Trigger Pod spec: 8-12 minute timebox per firm for manual enrichment
 */

import { log } from "../lib/logger";

// ============================================
// NYC OPEN DATA ENDPOINTS
// ============================================

const NYC_ENDPOINTS = {
    // HPD Registration Contacts
    hpdRegistration: "https://data.cityofnewyork.us/resource/tesw-yqqr.json",
    // HPD Building Info
    hpdBuildings: "https://data.cityofnewyork.us/resource/kj4p-ruqc.json",
    // Geoclient (for BBL lookup)
    geoclient: "https://api.nyc.gov/geo/geoclient/v1/address.json",
};

const MA_ENDPOINTS = {
    // MA Secretary of State Corporation Search
    secState: "https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx",
};

// ============================================
// INTERFACES
// ============================================

export interface ContactInfo {
    name: string;
    role: "owner" | "managing_agent" | "design_professional" | "applicant" | "principal";
    email?: string;
    phone?: string;
    company?: string;
    address?: string;
    source: string;
    confidence: number; // 0-100
}

export interface EnrichmentResult {
    success: boolean;
    contacts: ContactInfo[];
    sources_checked: string[];
    errors: string[];
    duration_ms: number;
}

export interface PropertyIdentifier {
    bbl?: string; // NYC Borough-Block-Lot
    bin?: string; // NYC Building ID Number
    address?: string;
    city?: string;
    state?: string;
}

// ============================================
// NYC HPD REGISTRATION LOOKUP
// ============================================

/**
 * Look up building owner and managing agent from NYC HPD Registration
 * HPD requires all NYC buildings to register annually
 */
export async function lookupHpdContacts(identifier: PropertyIdentifier): Promise<ContactInfo[]> {
    const contacts: ContactInfo[] = [];

    try {
        if (!identifier.bbl && !identifier.bin) {
            log("[ContactEnrich] No BBL or BIN provided for HPD lookup");
            return contacts;
        }

        // Build query based on available identifier
        const url = new URL(NYC_ENDPOINTS.hpdRegistration);
        if (identifier.bbl) {
            url.searchParams.set("$where", `boroid || block || lot = '${identifier.bbl}'`);
        } else if (identifier.bin) {
            url.searchParams.set("bin", identifier.bin);
        }
        url.searchParams.set("$limit", "10");

        log(`[ContactEnrich] Looking up HPD registration for ${identifier.bbl || identifier.bin}`);

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`HPD API failed: ${response.status}`);
        }

        const registrations = await response.json();

        for (const reg of registrations) {
            // Owner contact
            if (reg.corporationname || reg.ownerfirstname) {
                const ownerName = reg.corporationname ||
                    `${reg.ownerfirstname || ""} ${reg.ownerlastname || ""}`.trim();

                contacts.push({
                    name: ownerName,
                    role: "owner",
                    company: reg.corporationname,
                    address: reg.businessaddr,
                    phone: reg.businessphone,
                    source: "NYC HPD Registration",
                    confidence: 85,
                });
            }

            // Managing agent contact
            if (reg.agentfirstname || reg.agentcorporationname) {
                const agentName = reg.agentcorporationname ||
                    `${reg.agentfirstname || ""} ${reg.agentlastname || ""}`.trim();

                contacts.push({
                    name: agentName,
                    role: "managing_agent",
                    company: reg.agentcorporationname,
                    address: reg.agentbusinessaddress,
                    phone: reg.agentbusinessphone,
                    source: "NYC HPD Registration",
                    confidence: 80,
                });
            }
        }

        log(`[ContactEnrich] Found ${contacts.length} contacts from HPD`);
    } catch (error: any) {
        log(`[ContactEnrich] HPD lookup error: ${error.message}`);
    }

    return contacts;
}

// ============================================
// NY DOS BUSINESS ENTITY SEARCH
// ============================================

/**
 * Search NY Department of State for business entity information
 * Note: DOS doesn't have a public API, this simulates the workflow
 */
export async function searchNyDosEntity(companyName: string): Promise<ContactInfo[]> {
    const contacts: ContactInfo[] = [];

    try {
        log(`[ContactEnrich] Searching NY DOS for: ${companyName}`);

        // NY DOS doesn't have a public API - this would need to be:
        // 1. Manual lookup at https://apps.dos.ny.gov/publicInquiry/
        // 2. Or scraping with proper authorization
        // 3. Or using a paid data service (OpenCorporates, etc.)

        // For now, return a placeholder indicating manual lookup needed
        contacts.push({
            name: companyName,
            role: "principal",
            company: companyName,
            source: "NY DOS (manual lookup required)",
            confidence: 30, // Low confidence until verified
        });

        log(`[ContactEnrich] NY DOS requires manual verification for: ${companyName}`);
    } catch (error: any) {
        log(`[ContactEnrich] NY DOS search error: ${error.message}`);
    }

    return contacts;
}

// ============================================
// MA SECRETARY OF STATE SEARCH
// ============================================

/**
 * Search MA Secretary of State for corporation details
 * Boston-area firms for BERDO/BEUDO compliance
 */
export async function searchMaSecState(companyName: string): Promise<ContactInfo[]> {
    const contacts: ContactInfo[] = [];

    try {
        log(`[ContactEnrich] Searching MA Sec State for: ${companyName}`);

        // MA Secretary of State also requires manual lookup
        // URL: https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx

        contacts.push({
            name: companyName,
            role: "principal",
            company: companyName,
            source: "MA Sec State (manual lookup required)",
            confidence: 30,
        });

        log(`[ContactEnrich] MA Sec State requires manual verification for: ${companyName}`);
    } catch (error: any) {
        log(`[ContactEnrich] MA Sec State search error: ${error.message}`);
    }

    return contacts;
}

// ============================================
// EMAIL DISCOVERY
// ============================================

/**
 * Attempt to discover email for a contact using common patterns
 * Pattern guessing per trigger pod spec:
 * - firstname.lastname@domain.com
 * - flastname@domain.com
 * - firstnamel@domain.com
 */
export function generateEmailPatterns(
    firstName: string,
    lastName: string,
    domain: string
): string[] {
    const f = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const l = lastName.toLowerCase().replace(/[^a-z]/g, "");

    if (!f || !l || !domain) return [];

    return [
        `${f}.${l}@${domain}`,
        `${f}${l}@${domain}`,
        `${f[0]}${l}@${domain}`,
        `${f}${l[0]}@${domain}`,
        `${l}.${f}@${domain}`,
        `${f}_${l}@${domain}`,
        `${f}@${domain}`,
    ];
}

/**
 * Extract domain from company website or name
 */
export function guessDomainFromCompany(companyName: string): string | null {
    if (!companyName) return null;

    // Clean company name
    const cleaned = companyName
        .toLowerCase()
        .replace(/\s+(llc|inc|corp|co|ltd|llp|pllc|pc|pa)\.?$/i, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();

    if (cleaned.length < 3) return null;

    return `${cleaned}.com`;
}

// ============================================
// UNIFIED ENRICHMENT FUNCTION
// ============================================

/**
 * Enrich a property/firm with contact information
 * Follows the 8-12 minute timebox guideline for thorough enrichment
 */
export async function enrichContacts(
    identifier: PropertyIdentifier,
    firmName?: string
): Promise<EnrichmentResult> {
    const startTime = Date.now();
    const allContacts: ContactInfo[] = [];
    const sourcesChecked: string[] = [];
    const errors: string[] = [];

    // 1. NYC HPD Registration (if NYC property)
    if (identifier.bbl || identifier.bin) {
        try {
            sourcesChecked.push("NYC HPD Registration");
            const hpdContacts = await lookupHpdContacts(identifier);
            allContacts.push(...hpdContacts);
        } catch (e: any) {
            errors.push(`HPD: ${e.message}`);
        }
    }

    // 2. NY DOS Entity Search (if firm name provided)
    if (firmName && (identifier.state === "NY" || !identifier.state)) {
        try {
            sourcesChecked.push("NY DOS Entity Search");
            const dosContacts = await searchNyDosEntity(firmName);
            allContacts.push(...dosContacts);
        } catch (e: any) {
            errors.push(`NY DOS: ${e.message}`);
        }
    }

    // 3. MA Secretary of State (if MA property)
    if (firmName && identifier.state === "MA") {
        try {
            sourcesChecked.push("MA Sec State");
            const maContacts = await searchMaSecState(firmName);
            allContacts.push(...maContacts);
        } catch (e: any) {
            errors.push(`MA Sec State: ${e.message}`);
        }
    }

    // 4. Generate email patterns for contacts without emails
    for (const contact of allContacts) {
        if (!contact.email && contact.name && contact.company) {
            const domain = guessDomainFromCompany(contact.company);
            if (domain) {
                const nameParts = contact.name.split(" ");
                if (nameParts.length >= 2) {
                    const patterns = generateEmailPatterns(
                        nameParts[0],
                        nameParts[nameParts.length - 1],
                        domain
                    );
                    // Store best guess pattern
                    contact.email = patterns[0]; // firstname.lastname@domain.com
                    contact.confidence = Math.max(contact.confidence - 20, 20); // Lower confidence for guessed emails
                }
            }
        }
    }

    // Deduplicate contacts by name
    const uniqueContacts = deduplicateContacts(allContacts);

    return {
        success: errors.length === 0,
        contacts: uniqueContacts,
        sources_checked: sourcesChecked,
        errors,
        duration_ms: Date.now() - startTime,
    };
}

/**
 * Deduplicate contacts by name, keeping highest confidence
 */
function deduplicateContacts(contacts: ContactInfo[]): ContactInfo[] {
    const byName = new Map<string, ContactInfo>();

    for (const contact of contacts) {
        const key = contact.name.toLowerCase();
        const existing = byName.get(key);

        if (!existing || contact.confidence > existing.confidence) {
            byName.set(key, contact);
        }
    }

    return Array.from(byName.values());
}

// ============================================
// BATCH ENRICHMENT
// ============================================

/**
 * Enrich multiple properties/firms in batch
 * Respects rate limits and provides progress updates
 */
export async function batchEnrichContacts(
    items: Array<{ identifier: PropertyIdentifier; firmName?: string }>,
    delayMs: number = 1000
): Promise<{
    results: EnrichmentResult[];
    summary: {
        total: number;
        successful: number;
        totalContacts: number;
        avgDurationMs: number;
    };
}> {
    const results: EnrichmentResult[] = [];
    let totalContacts = 0;
    let totalDuration = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        log(`[ContactEnrich] Processing ${i + 1}/${items.length}: ${item.identifier.address || item.identifier.bbl || item.firmName}`);

        const result = await enrichContacts(item.identifier, item.firmName);
        results.push(result);
        totalContacts += result.contacts.length;
        totalDuration += result.duration_ms;

        // Rate limiting
        if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return {
        results,
        summary: {
            total: items.length,
            successful: results.filter(r => r.success).length,
            totalContacts,
            avgDurationMs: Math.round(totalDuration / items.length),
        },
    };
}
