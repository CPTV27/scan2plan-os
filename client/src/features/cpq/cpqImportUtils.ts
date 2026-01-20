/**
 * CPQ Import Utilities
 * 
 * Type definitions and mapping functions for importing
 * JSON exports from the external CPQ system.
 */

// CPQ JSON Schema Types
export interface CpqProjectDetails {
    clientName: string;
    projectName: string;
    projectAddress: string;
    specificBuilding?: string;
    typeOfBuilding?: string;
    hasBasement?: boolean;
    hasAttic?: boolean;
    notes?: string;
}

export interface CpqArea {
    id: string;
    name: string;
    buildingType: string;
    squareFeet: string;
    scope: string;
    disciplines: string[];
    disciplineLods?: Record<string, string>;
    gradeAroundBuilding?: boolean;
    gradeLod?: string;
}

export interface CpqTravel {
    dispatchLocation: string;
    distance: number;
    distanceCalculated?: boolean;
    customTravelCost?: number | null;
}

export interface CpqCrmData {
    accountContact?: string;
    accountContactEmail?: string;
    accountContactPhone?: string;
    phoneNumber?: string;
    designProContact?: string;
    designProCompanyContact?: string;
    otherContact?: string;
    source?: string;
    sourceNote?: string;
    assist?: string;
    probabilityOfClosing?: string;
    projectStatus?: string;
    projectStatusOther?: string;
}

export interface CpqScopingData {
    bimDeliverable?: string[];
    sqftAssumptions?: string;
    assumedGrossMargin?: string;
    projectNotes?: string;
    estimatedTimeline?: string;
    paymentTerms?: string;
    [key: string]: any;
}

export interface CpqPricingLineItem {
    label: string;
    value: number;
    isDiscount?: boolean;
    isTotal?: boolean;
    upteamCost?: number;
}

export interface CpqPricing {
    lineItems: CpqPricingLineItem[];
    totalClientPrice: number;
    totalUpteamCost: number;
}

export interface CpqAttachment {
    name: string;
    url: string;
}

export interface CpqAttachments {
    customTemplateFiles?: CpqAttachment[];
    sqftAssumptionsFiles?: CpqAttachment[];
    scopingDocuments?: CpqAttachment[];
    ndaFiles?: CpqAttachment[];
}

// Main CPQ Export Interface
export interface CpqExportData {
    schemaVersion: string;
    exportedAt: string;
    quoteNumber: string;
    projectDetails: CpqProjectDetails;
    areas: CpqArea[];
    risks: string[];
    travel?: CpqTravel;
    additionalServices?: Record<string, any>;
    scopingData?: CpqScopingData;
    crmData?: CpqCrmData;
    attachments?: CpqAttachments;
    pricing?: CpqPricing;
}

// Configurator Area Type (matches QuoteConfigurator)
export interface ConfiguratorArea {
    id: string;
    name: string;
    buildingType: string;
    squareFeet: string;
    lod: string;
    scope: string;
    disciplines: string[];
    expanded: boolean;
}

// Mapped Configurator Data
export interface MappedConfiguratorData {
    projectLocation: string;
    projectName: string;
    clientName: string;
    areas: ConfiguratorArea[];
    landscape: {
        include: boolean;
        type: "built" | "natural";
        acres: string;
        lod: string;
    } | null;
    travel?: {
        dispatchLocation: string;
        distance: number;
    };
    quoteNumber: string;
    originalPricing?: CpqPricing;
    notes?: string;
}

/**
 * Validate CPQ JSON structure
 */
export function validateCpqJson(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "Invalid JSON structure" };
    }

    if (!data.schemaVersion) {
        return { valid: false, error: "Missing schema version" };
    }

    if (!data.projectDetails) {
        return { valid: false, error: "Missing project details" };
    }

    if (!data.areas || !Array.isArray(data.areas)) {
        return { valid: false, error: "Missing or invalid areas" };
    }

    return { valid: true };
}

/**
 * Extract landscape configuration from areas
 */
export function extractLandscapeFromAreas(areas: CpqArea[]): MappedConfiguratorData["landscape"] {
    // Find landscape areas (buildingType 14 = Built, 15 = Natural)
    const landscapeArea = areas.find(
        (a) => a.buildingType === "14" || a.buildingType === "15"
    );

    if (!landscapeArea) {
        return null;
    }

    // Determine type based on buildingType
    const type: "built" | "natural" = landscapeArea.buildingType === "14" ? "built" : "natural";

    // Get LOD from disciplineLods or default to 300
    const lod = landscapeArea.disciplineLods?.site ||
        landscapeArea.disciplineLods?.architecture ||
        "300";

    // squareFeet for landscape is in acres (the value is already in acres)
    const acres = landscapeArea.squareFeet;

    return {
        include: true,
        type,
        acres,
        lod,
    };
}

/**
 * Map CPQ export data to configurator format
 */
export function mapCpqToConfigurator(cpqData: CpqExportData): MappedConfiguratorData {
    // Filter out landscape areas for regular areas list
    const regularAreas = cpqData.areas.filter(
        (a) => a.buildingType !== "14" && a.buildingType !== "15"
    );

    // Map areas to configurator format
    const mappedAreas: ConfiguratorArea[] = regularAreas.map((area) => {
        // Get primary LOD from disciplineLods (prefer architecture)
        const lod =
            area.disciplineLods?.architecture ||
            area.disciplineLods?.mepf ||
            area.disciplineLods?.structure ||
            "300";

        // Filter out matterport from disciplines (it's a service, not a discipline)
        const disciplines = area.disciplines.filter(
            (d) => d !== "matterport" && d !== "site"
        );

        return {
            id: area.id,
            name: area.name,
            buildingType: area.buildingType,
            squareFeet: area.squareFeet,
            lod,
            scope: area.scope || "full",
            disciplines: disciplines.length > 0 ? disciplines : ["architecture"],
            expanded: true,
        };
    });

    // Extract landscape
    const landscape = extractLandscapeFromAreas(cpqData.areas);

    // Build result
    return {
        projectLocation: cpqData.projectDetails.projectAddress || "",
        projectName: cpqData.projectDetails.projectName || "",
        clientName: cpqData.projectDetails.clientName || "",
        areas: mappedAreas.length > 0 ? mappedAreas : [
            {
                id: "1",
                name: "Main Building",
                buildingType: "4",
                squareFeet: "",
                lod: "300",
                scope: "full",
                disciplines: ["architecture"],
                expanded: true,
            },
        ],
        landscape,
        travel: cpqData.travel
            ? {
                dispatchLocation: cpqData.travel.dispatchLocation,
                distance: cpqData.travel.distance,
            }
            : undefined,
        quoteNumber: cpqData.quoteNumber || "",
        originalPricing: cpqData.pricing,
        notes: cpqData.projectDetails.notes || cpqData.scopingData?.projectNotes,
    };
}

/**
 * Parse and validate CPQ JSON file
 */
export async function parseCpqJsonFile(file: File): Promise<{
    success: boolean;
    data?: MappedConfiguratorData;
    rawData?: CpqExportData;
    error?: string;
}> {
    try {
        const text = await file.text();
        const json = JSON.parse(text);

        const validation = validateCpqJson(json);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const mappedData = mapCpqToConfigurator(json as CpqExportData);

        return {
            success: true,
            data: mappedData,
            rawData: json as CpqExportData,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to parse JSON",
        };
    }
}
