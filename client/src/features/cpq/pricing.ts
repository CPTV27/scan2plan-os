/**
 * CPQ Pricing Engine - Client-Side Calculation Module
 * 
 * This module contains all pricing calculation logic for the CPQ system.
 * Calculations happen entirely in the browser for instant feedback.
 * Only quote persistence uses server API calls.
 */

import { FY26_GOALS, validateMarginGate, getMarginStatus } from '@shared/businessGoals';

// Boundary coordinate for landscape areas
export interface BoundaryCoordinate {
  lat: number;
  lng: number;
}

// Facade definition for building exteriors
export interface Facade {
  id: string;
  type: "standard" | "ornate" | "curtainwall";
  lod: string;
}

// Per-discipline LoD configuration (CPQ-aligned format)
export interface DisciplineLodConfig {
  discipline: string;
  lod: string;
  scope?: string; // 'full', 'interior', 'exterior', 'mixed'
}

// Helper function to check if building type is landscape
// Supports both CPQ numeric IDs (14, 15) and legacy string IDs
export function isLandscapeBuildingType(buildingType: string): boolean {
  // CPQ numeric IDs
  if (buildingType === "14" || buildingType === "15") return true;
  // Legacy string IDs (backwards compatibility)
  if (buildingType === "landscape_built" || buildingType === "landscape_natural") return true;
  return false;
}

// Normalize dispatch location to lowercase for CPQ/UI display
// Accepts both uppercase (legacy) and lowercase (CPQ) formats
export function normalizeDispatchLocation(location: string): string {
  return location.toLowerCase();
}

// Convert dispatch location to uppercase for persistence (legacy format)
// Maintains backwards compatibility with downstream systems (QB, Salesforce, etc.)
export function toUppercaseDispatchLocation(location: string): string {
  const normalized = location.toLowerCase();
  const mapping: Record<string, string> = {
    woodstock: "WOODSTOCK",
    brooklyn: "BROOKLYN",
    troy: "TROY",
    fly_out: "FLY_OUT",
  };
  return mapping[normalized] || location.toUpperCase();
}

// Check if dispatch location matches (case-insensitive)
export function isDispatchLocation(location: string, target: string): boolean {
  return location.toLowerCase() === target.toLowerCase();
}

// Types for pricing calculations
export interface Area {
  id: string;
  name: string;
  buildingType: string;
  squareFeet: string; // For standard: sqft, for landscape (types 14-15): acres
  lod: string; // Default LoD (fallback when disciplineLods not specified)
  disciplines: string[];
  scope?: string;
  includeCadDeliverable?: boolean;
  additionalElevations?: number;
  // Mixed scope separate LoDs
  mixedInteriorLod?: string;
  mixedExteriorLod?: string;
  // Per-discipline LoD configuration (CPQ-aligned)
  disciplineLods?: Record<string, DisciplineLodConfig>;
  // Roof/plan count
  numberOfRoofs?: number;
  // Facade definitions
  facades?: Facade[];
  // Grade around building
  gradeAroundBuilding?: boolean;
  gradeLod?: string;
  // Legacy compatibility - deprecated, use disciplineLods
  interiorLod?: string;
  exteriorLod?: string;
  boundary?: BoundaryCoordinate[]; // Landscape area boundary coordinates
  boundaryImageUrl?: string; // Static map image of the boundary for proposals
  // Legacy kind field - deprecated, infer from buildingType (14-15 = landscape)
  kind?: "standard" | "landscape";
}

// Facade type options
export const FACADE_TYPES = [
  { id: "standard", label: "Standard" },
  { id: "ornate", label: "Ornate/Historical" },
  { id: "curtainwall", label: "Curtain Wall" },
];

// Legacy landscape types (use LANDSCAPE_TYPES from below for configurator)
// Kept for backwards compatibility with existing area configurations

// Acres to sqft conversion constant
export const ACRES_TO_SQFT = 43560;

export interface TravelConfig {
  dispatchLocation: string;
  distance: number;
  customCost?: number;
}

export interface PricingLineItem {
  label: string;
  value: number;
  editable?: boolean;
  isDiscount?: boolean;
  isTotal?: boolean;
  upteamCost?: number;
}

// Margin warning for target margin calculations
export interface MarginWarning {
  code: "BELOW_GUARDRAIL" | "BELOW_FLOOR" | "MARGIN_ADJUSTED";
  message: string;
  targetMargin?: number;
  calculatedMargin?: number;
}

export interface PricingResult {
  items: PricingLineItem[];
  subtotal: number;
  totalClientPrice: number;
  totalUpteamCost: number;
  profitMargin: number;
  // Margin target support for slider
  marginTarget?: number;
  marginWarnings?: MarginWarning[];
  // Discipline breakdowns for deterministic QBO estimate sync
  disciplineTotals: {
    architecture: number;
    mep: number;
    structural: number;
    site: number;
    travel: number;
    services: number;  // CAD, Matterport, elevations, etc.
    risk: number;      // Risk premiums
    scanning: number;  // Scanning labor costs
  };
  // Scanning estimate breakdown
  scanningEstimate?: {
    totalSqft: number;
    scanDays: number;
    dailyRate: number;
    scanningCost: number;
    hotelPerDiemDays: number;
    hotelPerDiemCost: number;
    totalScanningCost: number;
  };
}

// Static pricing configuration
// These rates are embedded in the client for instant calculations

// Building types aligned with CPQ
export const BUILDING_TYPES = [
  { id: "1", label: "Commercial - Simple" },
  { id: "2", label: "Residential - Standard" },
  { id: "3", label: "Residential - Luxury" },
  { id: "4", label: "Commercial / Office" },
  { id: "5", label: "Retail / Restaurants" },
  { id: "6", label: "Kitchen / Catering Facilities" },
  { id: "7", label: "Education" },
  { id: "8", label: "Hotel / Theatre / Museum" },
  { id: "9", label: "Hospitals / Mixed Use" },
  { id: "10", label: "Mechanical / Utility Rooms" },
  { id: "11", label: "Warehouse / Storage" },
  { id: "12", label: "Religious Buildings" },
  { id: "13", label: "Infrastructure / Roads / Bridges" },
  { id: "14", label: "Built Landscape" },
  { id: "15", label: "Natural Landscape" },
  { id: "16", label: "ACT (Above Ceiling Tiles)" },
];

export const DISCIPLINES = [
  { id: "architecture", label: "Architecture" },
  { id: "mepf", label: "MEP/F" },
  { id: "structure", label: "Structure" },
  { id: "site", label: "Grade" },
];

export const LOD_OPTIONS = [
  { id: "100", label: "LOD 100" },
  { id: "200", label: "LOD 200" },
  { id: "250", label: "LOD 250" },
  { id: "300", label: "LOD 300" },
  { id: "350", label: "LOD 350" },
  { id: "400", label: "LOD 400" },
];

export const SCOPE_OPTIONS = [
  { id: "full", label: "Full (Interior + Exterior)" },
  { id: "interior", label: "Interior Only" },
  { id: "exterior", label: "Exterior Only" },
  { id: "roof", label: "Roof & Facades" },
  { id: "facade", label: "Facade Only (Front/Side)" },
];

// Landscape pricing configuration (per acre rates)
export const LANDSCAPE_TYPES = [
  { id: "built", label: "Built Landscape", description: "Manicured areas - flower beds, shrubbery, mowed land" },
  { id: "natural", label: "Natural Landscape", description: "Unmaintained - forests, dense vegetation, waterways" },
];

export const LANDSCAPE_LOD_OPTIONS = [
  { id: "200", label: "LOD 200", description: "Basic topography with approximate dimensions" },
  { id: "300", label: "LOD 300", description: "Topography + type, pattern, ground features" },
  { id: "350", label: "LOD 350", description: "Detailed topography + development features, equipment" },
];

// Landscape rates per acre by type and LOD
// Tier 1: ≤5 acres, Tier 2: 5-20, Tier 3: 20-50, Tier 4: 50-100, Tier 5: 100+
export const LANDSCAPE_RATES: Record<string, Record<string, { tier1: number; tier2: number; tier3: number; tier4: number; tier5: number }>> = {
  built: {
    "200": { tier1: 175, tier2: 125, tier3: 75, tier4: 50, tier5: 40 },
    "300": { tier1: 200, tier2: 150, tier3: 100, tier4: 75, tier5: 55 },
    "350": { tier1: 250, tier2: 200, tier3: 150, tier4: 100, tier5: 65 },
  },
  natural: {
    "200": { tier1: 125, tier2: 75, tier3: 50, tier4: 40, tier5: 35 },
    "300": { tier1: 150, tier2: 100, tier3: 75, tier4: 55, tier5: 50 },
    "350": { tier1: 200, tier2: 150, tier3: 100, tier4: 65, tier5: 60 },
  },
};

export const LANDSCAPE_MINIMUM = 300;

/**
 * Calculate landscape pricing based on type, acreage, and LOD
 */
export function calculateLandscapePrice(
  type: "built" | "natural",
  acres: number,
  lod: "200" | "300" | "350"
): number {
  if (acres <= 0) return 0;

  const rates = LANDSCAPE_RATES[type]?.[lod];
  if (!rates) return 0;

  let rate: number;
  if (acres <= 5) rate = rates.tier1;
  else if (acres <= 20) rate = rates.tier2;
  else if (acres <= 50) rate = rates.tier3;
  else if (acres <= 100) rate = rates.tier4;
  else rate = rates.tier5;

  const total = rate * acres;
  return Math.max(total, LANDSCAPE_MINIMUM);
}

// Base rates per sqft by building type and discipline (LOD 200)
// Format: { buildingTypeId: { discipline: rate } }
const BASE_RATES: Record<string, Record<string, number>> = {
  "1": { architecture: 0.25, mepf: 0.30, structure: 0.20, site: 0.15 },
  "2": { architecture: 0.20, mepf: 0.25, structure: 0.18, site: 0.12 },
  "3": { architecture: 0.22, mepf: 0.28, structure: 0.19, site: 0.13 },
  "4": { architecture: 0.18, mepf: 0.22, structure: 0.15, site: 0.10 },
  "5": { architecture: 0.24, mepf: 0.28, structure: 0.18, site: 0.14 },
  "6": { architecture: 0.35, mepf: 0.45, structure: 0.25, site: 0.18 },
  "7": { architecture: 0.26, mepf: 0.32, structure: 0.20, site: 0.15 },
  "8": { architecture: 0.28, mepf: 0.35, structure: 0.22, site: 0.16 },
  "9": { architecture: 0.27, mepf: 0.33, structure: 0.21, site: 0.15 },
  "10": { architecture: 0.26, mepf: 0.32, structure: 0.20, site: 0.14 },
  "11": { architecture: 0.30, mepf: 0.35, structure: 0.22, site: 0.16 },
  "12": { architecture: 0.28, mepf: 0.34, structure: 0.21, site: 0.15 },
  "13": { architecture: 0.35, mepf: 0.50, structure: 0.28, site: 0.18 },
};

// LOD multipliers
const LOD_MULTIPLIERS: Record<string, number> = {
  "100": 0.7,
  "200": 1.0,
  "250": 1.15,
  "300": 1.3,
  "350": 1.5,
  "400": 1.8,
};

// Scope multipliers (portion of price applied)
// ALIGNED WITH ORIGINAL CPQ: Interior=65%, Exterior=35%, Facade=25%
const SCOPE_MULTIPLIERS: Record<string, { interior: number; exterior: number }> = {
  full: { interior: 0.65, exterior: 0.35 },     // 100% - full project (65% interior + 35% exterior)
  interior: { interior: 0.65, exterior: 0 },    // 65% - interior only scope
  exterior: { interior: 0, exterior: 0.35 },    // 35% - exterior only scope
  roof: { interior: 0, exterior: 0.35 },        // 35% - roof/facades scope (same as exterior)
  facade: { interior: 0, exterior: 0.25 },      // 25% - facade only (front/side facades)
};

// Area tier breaks for pricing adjustments
const AREA_TIERS = [
  { min: 0, max: 5000, tier: "0-5k", multiplier: 1.0 },
  { min: 5000, max: 10000, tier: "5k-10k", multiplier: 0.95 },
  { min: 10000, max: 20000, tier: "10k-20k", multiplier: 0.90 },
  { min: 20000, max: 30000, tier: "20k-30k", multiplier: 0.85 },
  { min: 30000, max: 40000, tier: "30k-40k", multiplier: 0.82 },
  { min: 40000, max: 50000, tier: "40k-50k", multiplier: 0.80 },
  { min: 50000, max: 75000, tier: "50k-75k", multiplier: 0.78 },
  { min: 75000, max: 100000, tier: "75k-100k", multiplier: 0.75 },
  { min: 100000, max: Infinity, tier: "100k+", multiplier: 0.72 },
];

// Note: LANDSCAPE_RATES is now defined and exported earlier in the file
// with tiered pricing structure (tier1, tier2, etc.)

// Brooklyn Tiered Travel Logic - Gold Standard from CPQ Logic Export
// Dispatch Location determines base fee structure, Project Size determines tier
const BROOKLYN_TRAVEL_TIERS = {
  tierA: { minSqft: 50000, baseFee: 0 },      // >= 50,000 sqft: No base fee
  tierB: { minSqft: 10000, baseFee: 300 },    // 10,000 - 49,999 sqft: $300 base
  tierC: { minSqft: 0, baseFee: 150 },        // < 10,000 sqft: $150 base
};

// Other locations (non-Brooklyn) use per-mile calculation
// Base $0 + $3/mile for all distances
const OTHER_DISPATCH_BASE_FEE = 0;
const OTHER_DISPATCH_PER_MILE_RATE = 3;

// Mileage rate applies after 20 miles for Brooklyn dispatch
const BROOKLYN_MILEAGE_THRESHOLD = 20;
const BROOKLYN_PER_MILE_RATE = 4;

// Additional services rates
export const SERVICE_RATES = {
  matterport: { rate: 0.10, unit: "sqft", label: "Matterport Capture" },
  georeferencing: { rate: 500, unit: "flat", label: "Georeferencing" },
  scanningFullDay: { rate: 2500, unit: "day", label: "Scanning - Full Day" },
  scanningHalfDay: { rate: 1500, unit: "half-day", label: "Scanning - Half Day" },
};

// CAD deliverable base rates
const CAD_BASE_RATES: Record<string, number> = {
  basic_architecture: 0.03,
  a_s_site: 0.05,
  a_s_mep_site: 0.07,
};

// Risk premium factors (Applied ONLY to Architecture discipline)
// Aligned with CPQ - only these three risk factors are recognized
export const RISK_FACTORS = [
  { id: "hazardous", label: "Hazardous Conditions", premium: 0.25 },
  { id: "noPower", label: "No Power/HVAC", premium: 0.20 },
  { id: "occupied", label: "Occupied Building", premium: 0.15 },
];

// Upteam (vendor) cost multiplier
const UPTEAM_MULTIPLIER = 0.65;

// Minimum project charge
const MINIMUM_PROJECT_CHARGE = 3000;

// Scanning cost constants (for non-Tier A projects)
const SCANNING_DAILY_RATE = 600;        // $600/day for scanning
const SCANNING_SQFT_PER_DAY = 10000;    // 1 day per 10,000 sqft
const HOTEL_PER_DIEM_DAILY = 300;       // $300/day for hotel + per diem (for multi-day scans)

/**
 * Determines the area tier and volume discount multiplier for a given square footage.
 * 
 * Larger projects receive volume discounts. Tiers range from "0-5k" (no discount)
 * to "100k+" (28% discount). This implements progressive pricing that rewards
 * larger project commitments.
 * 
 * @param sqft - Project square footage
 * @returns Object with tier label (e.g., "10k-20k") and multiplier (0.72-1.0)
 * 
 * @example
 * getAreaTier(15000) // => { tier: "10k-20k", multiplier: 0.90 }
 * getAreaTier(75000) // => { tier: "75k-100k", multiplier: 0.75 }
 */
export function getAreaTier(sqft: number): { tier: string; multiplier: number } {
  for (const tier of AREA_TIERS) {
    if (sqft >= tier.min && sqft < tier.max) {
      return { tier: tier.tier, multiplier: tier.multiplier };
    }
  }
  return { tier: "100k+", multiplier: 0.72 };
}

/**
 * Calculates the per-square-foot rate for a specific discipline and configuration.
 * 
 * Rate is determined by:
 * 1. Building type (e.g., office, retail, industrial) - base rates vary by complexity
 * 2. Discipline (architecture, mepf, structure, site) - each has different pricing
 * 3. Level of Detail (LOD 100-400) - higher detail = higher multiplier
 * 4. Area tier discount - larger projects get volume discounts
 * 
 * @param buildingTypeId - Building type ID (1-16)
 * @param sqft - Project square footage (for tier discount calculation)
 * @param discipline - BIM discipline ("architecture", "mepf", "structure", "site")
 * @param lod - Level of Detail ("100", "200", "250", "300", "350", "400")
 * @returns Per-square-foot rate in dollars
 * 
 * @example
 * getPricingRate("1", 50000, "architecture", "200") // Office, 50k sqft, Arch LOD 200
 */
export function getPricingRate(
  buildingTypeId: string,
  sqft: number,
  discipline: string,
  lod: string
): number {
  const buildingRates = BASE_RATES[buildingTypeId] || BASE_RATES["1"];
  const baseRate = buildingRates[discipline] || 0.25;
  const lodMultiplier = LOD_MULTIPLIERS[lod] || 1.0;
  const { multiplier: tierMultiplier } = getAreaTier(sqft);

  return baseRate * lodMultiplier * tierMultiplier;
}

// Helper: Get upteam (vendor) pricing rate
export function getUpteamPricingRate(
  buildingTypeId: string,
  sqft: number,
  discipline: string,
  lod: string
): number {
  const clientRate = getPricingRate(buildingTypeId, sqft, discipline, lod);
  return clientRate * UPTEAM_MULTIPLIER;
}

// Landscape type normalization - resolves buildingType to canonical landscape kind
export type LandscapeKind = "built" | "natural" | "mixed";

export function resolveLandscapeKind(buildingType: string): LandscapeKind {
  // Support both new landscape type IDs and legacy buildingType IDs
  if (buildingType === "14" || buildingType === "landscape_built") return "built";
  if (buildingType === "15" || buildingType === "landscape_natural") return "natural";
  if (buildingType === "landscape_mixed") return "mixed";
  // Default to built for any unknown landscape type
  return "built";
}

// Helper: Get acreage tier index for rate lookup
function getAcreageTierIndex(acres: number): number {
  if (acres >= 100) return 4;
  if (acres >= 50) return 3;
  if (acres >= 20) return 2;
  if (acres >= 5) return 1;
  return 0;
}

// Helper: Get landscape per-acre rate
export function getLandscapePerAcreRate(
  buildingType: string,
  acres: number,
  lod: string
): number {
  const landscapeKind = resolveLandscapeKind(buildingType);

  // Get the tier based on acreage
  const getTierValue = (rates: { tier1: number; tier2: number; tier3: number; tier4: number; tier5: number }): number => {
    if (acres >= 100) return rates.tier5;
    if (acres >= 50) return rates.tier4;
    if (acres >= 20) return rates.tier3;
    if (acres >= 5) return rates.tier2;
    return rates.tier1;
  };

  if (landscapeKind === "mixed") {
    // Mixed uses average of built and natural rates
    const builtRates = LANDSCAPE_RATES.built[lod] || LANDSCAPE_RATES.built["200"];
    const naturalRates = LANDSCAPE_RATES.natural[lod] || LANDSCAPE_RATES.natural["200"];
    return (getTierValue(builtRates) + getTierValue(naturalRates)) / 2;
  }

  const rates = landscapeKind === "built"
    ? LANDSCAPE_RATES.built
    : LANDSCAPE_RATES.natural;
  const lodRates = rates[lod] || rates["200"];
  return getTierValue(lodRates);
}

// Helper: Get CAD package type
export function getCadPackageType(disciplineCount: number): string {
  if (disciplineCount >= 3) return "a_s_mep_site";
  if (disciplineCount === 2) return "a_s_site";
  return "basic_architecture";
}

// Helper: Get CAD pricing rate
export function getCadPricingRate(sqft: number, disciplineCount: number): number {
  const packageType = getCadPackageType(disciplineCount);
  const baseRate = CAD_BASE_RATES[packageType] || 0.03;
  const { multiplier: tierMultiplier } = getAreaTier(sqft);
  return baseRate * tierMultiplier;
}

// Helper: Calculate additional elevations price (tiered)
export function calculateAdditionalElevationsPrice(quantity: number): number {
  if (quantity <= 0) return 0;

  let total = 0;
  let remaining = quantity;

  // First 10 at $25/ea
  const tier1 = Math.min(remaining, 10);
  total += tier1 * 25;
  remaining -= tier1;

  // Next 10 (10-20) at $20/ea
  if (remaining > 0) {
    const tier2 = Math.min(remaining, 10);
    total += tier2 * 20;
    remaining -= tier2;
  }

  // Next 80 (20-100) at $15/ea
  if (remaining > 0) {
    const tier3 = Math.min(remaining, 80);
    total += tier3 * 15;
    remaining -= tier3;
  }

  // Next 200 (100-300) at $10/ea
  if (remaining > 0) {
    const tier4 = Math.min(remaining, 200);
    total += tier4 * 10;
    remaining -= tier4;
  }

  // Remaining (300+) at $5/ea
  if (remaining > 0) {
    total += remaining * 5;
  }

  return total;
}

// Helper: Calculate travel cost with Brooklyn tiered logic
// Brooklyn dispatch uses project-size-based tiers + per-mile after 20 miles
// Other locations use flat distance-based rates
export function calculateTravelCost(
  distance: number,
  dispatchLocation: string,
  projectTotalSqft: number,
  customCost?: number
): number {
  if (customCost !== undefined && customCost > 0) {
    return customCost;
  }

  // Check if Brooklyn dispatch (case-insensitive match)
  const isBrooklyn = dispatchLocation.toLowerCase().includes("brooklyn");

  if (isBrooklyn) {
    // Brooklyn tiered pricing based on project size
    let baseFee = BROOKLYN_TRAVEL_TIERS.tierC.baseFee; // Default: < 10k sqft

    if (projectTotalSqft >= BROOKLYN_TRAVEL_TIERS.tierA.minSqft) {
      baseFee = BROOKLYN_TRAVEL_TIERS.tierA.baseFee; // >= 50k: $0
    } else if (projectTotalSqft >= BROOKLYN_TRAVEL_TIERS.tierB.minSqft) {
      baseFee = BROOKLYN_TRAVEL_TIERS.tierB.baseFee; // 10k-49,999: $300
    }

    // Add per-mile rate for distance over threshold
    const additionalMiles = Math.max(0, distance - BROOKLYN_MILEAGE_THRESHOLD);
    const mileageCost = additionalMiles * BROOKLYN_PER_MILE_RATE;

    return baseFee + mileageCost;
  }

  // Non-Brooklyn: $0 base + $3/mile for all distances
  return OTHER_DISPATCH_BASE_FEE + (distance * OTHER_DISPATCH_PER_MILE_RATE);
}

/**
 * Calculates complete pricing for a CPQ quote.
 * 
 * This is the main pricing engine function that processes all areas, services,
 * travel costs, and risk factors to produce a complete quote breakdown.
 * 
 * @param areas - Array of Area objects containing building details (sqft, disciplines, LOD, scope)
 * @param services - Record of additional services with quantities (e.g., { matterport: 10000 })
 * @param travel - Travel configuration with dispatch location, distance, and mileage
 * @param risks - Array of active risk factor IDs (e.g., ["hazardous", "occupied"])
 * @param paymentTerms - Payment terms affecting final pricing (default: "standard")
 * @param marginTarget - Optional target margin (0.35-0.60). When provided, adjusts client price using formula: clientPrice = cost / (1 - marginTarget)
 * 
 * @returns PricingResult containing:
 *   - items: PricingLineItem[] - Line item breakdown with labels and amounts
 *   - subtotal: number - Sum of all line items before adjustments
 *   - totalClientPrice: number - Final client price (with margin adjustment if marginTarget provided)
 *   - totalUpteamCost: number - Vendor/upteam cost total
 *   - profitMargin: number - Calculated margin percentage (0-1)
 *   - marginTarget: number (optional) - The target margin if specified
 *   - marginWarnings: MarginWarning[] (optional) - Warnings if margin is below thresholds
 *   - disciplineTotals: Object - Per-discipline cost breakdown (architecture, mep, structural, site, travel, cad, other)
 * 
 * @example
 * const result = calculatePricing(
 *   [{ squareFeet: "50000", buildingType: "1", disciplines: ["architecture"], lod: "200" }],
 *   { matterport: 50000 },
 *   { dispatchLocation: "brooklyn", distance: 15, mileage: 30 },
 *   ["occupied"],
 *   "standard",
 *   0.45
 * );
 * // result.totalClientPrice = 45000
 * // result.profitMargin = 0.45
 * 
 * @note Risk premiums apply ONLY to Architecture discipline costs.
 * MEPF, Structure, Site, Travel, and services are explicitly excluded from risk adjustments.
 */
export function calculatePricing(
  areas: Area[],
  services: Record<string, number>,
  travel: TravelConfig | null,
  risks: string[],
  paymentTerms: string = "standard",
  marginTarget?: number
): PricingResult {
  const items: PricingLineItem[] = [];

  // Separate tracking for risk-eligible vs risk-exempt costs
  let architectureBaseTotal = 0;  // Architecture discipline ONLY - eligible for risk premiums
  let mepfTotal = 0;              // MEP/F discipline - EXCLUDED from risk premiums
  let structureTotal = 0;         // Structure discipline - EXCLUDED from risk premiums
  let siteTotal = 0;              // Site discipline - EXCLUDED from risk premiums
  let otherCostsTotal = 0;        // CAD, elevations, services, etc. - EXCLUDED from risk premiums
  let travelTotal = 0;            // Travel costs - EXCLUDED from risk premiums
  let riskPremiumTotal = 0;       // Accumulated risk premiums
  let upteamCost = 0;

  // Process each area
  areas.forEach((area) => {
    // Check buildingType for landscape (14-15) - kind field deprecated
    const isLandscape = isLandscapeBuildingType(area.buildingType) || area.kind === "landscape";
    const isACT = area.buildingType === "16";
    // For landscape: squareFeet contains acres, for standard: contains sqft
    const inputValue = isLandscape
      ? parseFloat(area.squareFeet) || 0
      : parseInt(area.squareFeet) || 0;

    const scope = area.scope || "full";
    const disciplines = isLandscape
      ? ["site"]
      : isACT
        ? ["mepf"]
        : area.disciplines.length > 0
          ? area.disciplines
          : [];

    disciplines.forEach((discipline) => {
      // Get per-discipline LoD if available, otherwise use default area LoD
      const disciplineLodConfig = area.disciplineLods?.[discipline];
      const lod = disciplineLodConfig?.lod || area.lod || "200";
      // Discipline-specific scope overrides area scope
      const disciplineScope = disciplineLodConfig?.scope || scope;
      let lineTotal = 0;
      let upteamLineCost = 0;
      let areaLabel = "";

      if (isLandscape) {
        const acres = inputValue;
        const sqft = Math.round(acres * 43560);
        const perAcreRate = getLandscapePerAcreRate(area.buildingType, acres, lod);
        lineTotal = acres * perAcreRate;
        areaLabel = `${acres} acres (${sqft.toLocaleString()} sqft)`;
        upteamLineCost = lineTotal * UPTEAM_MULTIPLIER;
      } else if (isACT) {
        const sqft = Math.max(inputValue, 3000);
        lineTotal = sqft * 2.0;
        areaLabel = `${sqft.toLocaleString()} sqft`;
        upteamLineCost = lineTotal * UPTEAM_MULTIPLIER;
      } else {
        const sqft = Math.max(inputValue, 3000);
        const scopeMultiplier = SCOPE_MULTIPLIERS[disciplineScope] || SCOPE_MULTIPLIERS.full;

        // Check for mixed LOD scenario (separate interior/exterior LODs)
        const hasInteriorLod = area.mixedInteriorLod || area.interiorLod;
        const hasExteriorLod = area.mixedExteriorLod || area.exteriorLod;
        const isMixedLod = hasInteriorLod && hasExteriorLod && hasInteriorLod !== hasExteriorLod;

        if (isMixedLod && scopeMultiplier.interior > 0 && scopeMultiplier.exterior > 0) {
          // Mixed LOD: Calculate interior and exterior portions separately
          const interiorLod = hasInteriorLod || lod;
          const exteriorLod = hasExteriorLod || lod;

          const interiorRate = getPricingRate(area.buildingType, sqft, discipline, interiorLod);
          const exteriorRate = getPricingRate(area.buildingType, sqft, discipline, exteriorLod);

          const interiorCost = sqft * interiorRate * scopeMultiplier.interior;
          const exteriorCost = sqft * exteriorRate * scopeMultiplier.exterior;

          lineTotal = interiorCost + exteriorCost;

          // Calculate effective per-sqft rate for display
          const effectiveRate = lineTotal / sqft;
          areaLabel = `${sqft.toLocaleString()} sqft @ $${effectiveRate.toFixed(3)}/sqft (Int ${interiorLod}/Ext ${exteriorLod})`;
          upteamLineCost = lineTotal * UPTEAM_MULTIPLIER;
        } else {
          // Single LOD: Use standard calculation
          const ratePerSqft = getPricingRate(area.buildingType, sqft, discipline, lod);
          const effectiveMultiplier = scopeMultiplier.interior + scopeMultiplier.exterior;

          lineTotal = sqft * ratePerSqft * effectiveMultiplier;
          areaLabel = `${sqft.toLocaleString()} sqft`;
          upteamLineCost = lineTotal * UPTEAM_MULTIPLIER;
        }
      }

      if (lineTotal > 0) {
        const disciplineLabel = DISCIPLINES.find((d) => d.id === discipline)?.label || discipline;
        items.push({
          label: `${area.name} - ${disciplineLabel} LOD ${lod} (${areaLabel})`,
          value: Math.round(lineTotal * 100) / 100,
          upteamCost: Math.round(upteamLineCost * 100) / 100,
        });

        // Route costs to appropriate bucket based on discipline
        // ONLY architecture is eligible for risk premium multipliers
        switch (discipline) {
          case "architecture":
            architectureBaseTotal += lineTotal;
            break;
          case "mepf":
            mepfTotal += lineTotal;
            break;
          case "structure":
            structureTotal += lineTotal;
            break;
          case "site":
            siteTotal += lineTotal;
            break;
          default:
            otherCostsTotal += lineTotal;
        }
        upteamCost += upteamLineCost;
      }
    });

    // CAD deliverable - NOT eligible for risk premiums
    if (area.includeCadDeliverable) {
      const sqft = Math.max(parseInt(area.squareFeet) || 0, 3000);
      const cadRate = getCadPricingRate(sqft, disciplines.length);
      const cadTotal = Math.max(sqft * cadRate, 250); // Minimum $250
      items.push({
        label: `${area.name} - CAD Deliverable`,
        value: Math.round(cadTotal * 100) / 100,
        upteamCost: Math.round(cadTotal * UPTEAM_MULTIPLIER * 100) / 100,
      });
      otherCostsTotal += cadTotal;
      upteamCost += cadTotal * UPTEAM_MULTIPLIER;
    }

    // Additional elevations - NOT eligible for risk premiums
    const additionalElevations = typeof area.additionalElevations === 'number'
      ? area.additionalElevations
      : parseInt(String(area.additionalElevations || "0")) || 0;
    if (additionalElevations > 0) {
      const elevTotal = calculateAdditionalElevationsPrice(additionalElevations);
      items.push({
        label: `${area.name} - Additional Elevations (${additionalElevations})`,
        value: elevTotal,
        upteamCost: Math.round(elevTotal * UPTEAM_MULTIPLIER * 100) / 100,
      });
      otherCostsTotal += elevTotal;
      upteamCost += elevTotal * UPTEAM_MULTIPLIER;
    }

    // Facades (for roof scope) - NOT eligible for risk premiums
    const facades = area.facades || [];
    if (scope === "roof" && facades.length > 0) {
      facades.forEach((facade) => {
        const facadePrice = architectureBaseTotal * 0.1; // 10% of arch base
        items.push({
          label: `${area.name} - Facade: ${FACADE_TYPES.find(f => f.id === facade.type)?.label || facade.type || "Unnamed"}`,
          value: Math.round(facadePrice * 100) / 100,
          upteamCost: Math.round(facadePrice * UPTEAM_MULTIPLIER * 100) / 100,
        });
        otherCostsTotal += facadePrice;
        upteamCost += facadePrice * UPTEAM_MULTIPLIER;
      });
    }
  });

  // Additional services - NOT eligible for risk premiums
  Object.entries(services).forEach(([serviceId, quantity]) => {
    if (quantity <= 0) return;
    const service = SERVICE_RATES[serviceId as keyof typeof SERVICE_RATES];
    if (!service) return;

    let serviceTotal = 0;
    if (service.unit === "sqft") {
      serviceTotal = quantity * service.rate;
    } else {
      serviceTotal = quantity * service.rate;
    }

    if (serviceTotal > 0) {
      items.push({
        label: `${service.label}${quantity > 1 ? ` x ${quantity}` : ""}`,
        value: Math.round(serviceTotal * 100) / 100,
        upteamCost: Math.round(serviceTotal * UPTEAM_MULTIPLIER * 100) / 100,
      });
      otherCostsTotal += serviceTotal;
      upteamCost += serviceTotal * UPTEAM_MULTIPLIER;
    }
  });

  // RISK PREMIUMS - Applied ONLY to Architecture discipline base cost
  // Explicitly EXCLUDES: MEPF, Structure, Site, Travel, and all other costs
  // Each risk factor is calculated independently against the base (non-compounding)
  if (risks.length > 0 && architectureBaseTotal > 0) {
    risks.forEach((riskId) => {
      const risk = RISK_FACTORS.find((r) => r.id === riskId);
      if (risk) {
        // Calculate premium against Architecture base only (not against other risks)
        const individualPremium = Math.round(architectureBaseTotal * risk.premium * 100) / 100;

        // Add line item for this risk
        items.push({
          label: `Risk Premium: ${risk.label} (Architecture only)`,
          value: individualPremium,
          upteamCost: 0, // Risk premiums are pure profit margin
        });

        // Accumulate premium total (using same rounded value as line item)
        riskPremiumTotal += individualPremium;
      }
    });
  }

  // Calculate total project sqft for travel tier determination
  const projectTotalSqft = areas.reduce((sum, area) => {
    const isLandscape = area.buildingType === "14" || area.buildingType === "15";
    if (isLandscape) {
      const acres = parseFloat(area.squareFeet) || 0;
      return sum + Math.round(acres * 43560); // Convert acres to sqft
    }
    return sum + (parseInt(area.squareFeet) || 0);
  }, 0);

  // Travel costs - NOT eligible for risk premiums (tracked separately)
  // Uses Brooklyn tiered logic for Brooklyn dispatch, flat rates for other locations
  if (travel && travel.distance > 0) {
    const travelCost = calculateTravelCost(
      travel.distance,
      travel.dispatchLocation || "",
      projectTotalSqft,
      travel.customCost
    );
    if (travelCost > 0) {
      const isBrooklyn = (travel.dispatchLocation || "").toLowerCase().includes("brooklyn");
      let travelLabel = `Travel (${travel.distance} mi from ${travel.dispatchLocation}`;

      if (isBrooklyn) {
        // Brooklyn: Show tier and mileage breakdown
        const tierLabel = projectTotalSqft >= 50000 ? "Tier A" : projectTotalSqft >= 10000 ? "Tier B" : "Tier C";
        const additionalMiles = Math.max(0, travel.distance - BROOKLYN_MILEAGE_THRESHOLD);
        if (additionalMiles > 0) {
          travelLabel += ` - ${tierLabel}, +$${BROOKLYN_PER_MILE_RATE}/mi x ${additionalMiles} mi`;
        } else {
          travelLabel += ` - ${tierLabel}`;
        }
      } else {
        // Non-Brooklyn: Show per-mile calculation
        travelLabel += ` @ $${OTHER_DISPATCH_PER_MILE_RATE}/mi`;
      }
      travelLabel += ")";

      items.push({
        label: travelLabel,
        value: travelCost,
        upteamCost: Math.round(travelCost * 0.8 * 100) / 100, // Travel has higher margin
      });
      travelTotal = travelCost;
      upteamCost += travelCost * 0.8;
    }
  }

  // Calculate scanning estimate (for non-Tier A projects only)
  // Tier A projects have manual scanning cost input, so this is for standard quotes
  const scanDays = Math.max(1, Math.ceil(projectTotalSqft / SCANNING_SQFT_PER_DAY));
  const baseScanningCost = scanDays * SCANNING_DAILY_RATE;
  // For multi-day scans, add hotel + per diem for days beyond the first
  const hotelPerDiemDays = Math.max(0, scanDays - 1);
  const hotelPerDiemCost = hotelPerDiemDays * HOTEL_PER_DIEM_DAILY;
  const totalScanningCost = baseScanningCost + hotelPerDiemCost;

  // Add scanning cost to internal (upteam) costs - this is our cost, not client-facing
  // Scanning is 100% internal cost (no markup in this line)
  upteamCost += totalScanningCost;

  const scanningEstimate = {
    totalSqft: projectTotalSqft,
    scanDays,
    dailyRate: SCANNING_DAILY_RATE,
    scanningCost: baseScanningCost,
    hotelPerDiemDays,
    hotelPerDiemCost,
    totalScanningCost,
  };

  // Calculate subtotal with explicit separation:
  // Architecture (with risk) + MEPF + Structure + Site + Other + Travel
  const architectureWithRisk = architectureBaseTotal + riskPremiumTotal;
  const riskExemptTotal = mepfTotal + structureTotal + siteTotal + otherCostsTotal + travelTotal;
  let subtotal = architectureWithRisk + riskExemptTotal;

  // Apply minimum charge
  if (subtotal < MINIMUM_PROJECT_CHARGE && subtotal > 0) {
    const adjustment = MINIMUM_PROJECT_CHARGE - subtotal;
    items.push({
      label: "Minimum Project Charge Adjustment",
      value: adjustment,
      upteamCost: 0,
    });
    subtotal = MINIMUM_PROJECT_CHARGE;
  }

  // Payment term adjustments - ALIGNED WITH ORIGINAL CPQ
  // Partner: -10%, Net30: +5%, Net60: +10%, Net90: +15%
  let paymentAdjustment = 0;
  if (paymentTerms === "partner") {
    paymentAdjustment = -subtotal * 0.10; // 10% discount for partner terms
    items.push({
      label: "Partner Discount (-10%)",
      value: paymentAdjustment,
      isDiscount: true,
    });
  } else if (paymentTerms === "prepaid") {
    paymentAdjustment = -subtotal * 0.05; // 5% discount for prepaid
    items.push({
      label: "Prepaid Discount (-5%)",
      value: paymentAdjustment,
      isDiscount: true,
    });
  } else if (paymentTerms === "50/50") {
    // 50% deposit / 50% on completion - no surcharge, just split payment
    // No pricing adjustment, just a payment structure
  } else if (paymentTerms === "net15") {
    // Net 15 - fast payment, no surcharge
    // No pricing adjustment for fast payment
  } else if (paymentTerms === "net30") {
    paymentAdjustment = subtotal * 0.05; // 5% surcharge for Net 30
    items.push({
      label: "Net 30 Terms (+5%)",
      value: paymentAdjustment,
    });
  } else if (paymentTerms === "net45") {
    paymentAdjustment = subtotal * 0.07; // 7% surcharge for Net 45
    items.push({
      label: "Net 45 Terms (+7%)",
      value: paymentAdjustment,
    });
  } else if (paymentTerms === "net60") {
    paymentAdjustment = subtotal * 0.10; // 10% surcharge for Net 60
    items.push({
      label: "Net 60 Terms (+10%)",
      value: paymentAdjustment,
    });
  } else if (paymentTerms === "net90") {
    paymentAdjustment = subtotal * 0.15; // 15% surcharge for Net 90
    items.push({
      label: "Net 90 Terms (+15%)",
      value: paymentAdjustment,
    });
  }

  let totalClientPrice = Math.round((subtotal + paymentAdjustment) * 100) / 100;
  const totalUpteamCost = Math.round(upteamCost * 100) / 100;
  let profitMargin = totalClientPrice - totalUpteamCost;

  // Margin target support: when marginTarget is provided, recalculate client price to achieve target margin
  // Formula: clientPrice = cost / (1 - marginTarget)
  const marginWarnings: MarginWarning[] = [];
  const MARGIN_GUARDRAIL = 0.45; // 45% minimum recommended margin
  const MARGIN_FLOOR = FY26_GOALS.MARGIN_FLOOR; // 40% hard floor

  if (marginTarget !== undefined) {
    // Validate margin target range (0.35 - 0.60)
    const validMarginTarget = Math.max(0.35, Math.min(0.60, marginTarget));

    // Calculate new client price to achieve target margin
    // margin = (clientPrice - cost) / clientPrice = marginTarget
    // clientPrice = cost / (1 - marginTarget)
    const adjustedClientPrice = Math.round((totalUpteamCost / (1 - validMarginTarget)) * 100) / 100;

    // Check if margin target is below guardrail (45%)
    // Use epsilon tolerance to handle floating point precision (e.g., 0.449999... should equal 0.45)
    const EPSILON = 0.0001;
    if (validMarginTarget < MARGIN_GUARDRAIL - EPSILON) {
      marginWarnings.push({
        code: "BELOW_GUARDRAIL",
        message: `Target margin (${(validMarginTarget * 100).toFixed(1)}%) is below the recommended 45% guardrail`,
        targetMargin: validMarginTarget,
        calculatedMargin: validMarginTarget,
      });
    }

    // Check if margin target is below hard floor (40%)
    if (validMarginTarget < MARGIN_FLOOR - EPSILON) {
      marginWarnings.push({
        code: "BELOW_FLOOR",
        message: `Target margin (${(validMarginTarget * 100).toFixed(1)}%) is below the 40% minimum margin floor. Quote may be blocked.`,
        targetMargin: validMarginTarget,
        calculatedMargin: validMarginTarget,
      });
    }

    // Update the client price and profit margin
    totalClientPrice = adjustedClientPrice;
    profitMargin = totalClientPrice - totalUpteamCost;

    // Update the total line item with adjusted price
    // Note: We need to add a margin adjustment line item if price changed
    const originalPrice = Math.round((subtotal + paymentAdjustment) * 100) / 100;
    const priceAdjustment = adjustedClientPrice - originalPrice;

    if (Math.abs(priceAdjustment) > 0.01) {
      items.push({
        label: `Margin Target Adjustment (${(validMarginTarget * 100).toFixed(1)}%)`,
        value: priceAdjustment,
        isDiscount: priceAdjustment < 0,
      });
    }
  }

  // Add total line
  items.push({
    label: "Total",
    value: totalClientPrice,
    isTotal: true,
  });

  return {
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    totalClientPrice,
    totalUpteamCost,
    profitMargin: Math.round(profitMargin * 100) / 100,
    marginTarget,
    marginWarnings: marginWarnings.length > 0 ? marginWarnings : undefined,
    // Discipline breakdowns for deterministic QBO estimate sync
    disciplineTotals: {
      architecture: Math.round(architectureBaseTotal * 100) / 100,
      mep: Math.round(mepfTotal * 100) / 100,
      structural: Math.round(structureTotal * 100) / 100,
      site: Math.round(siteTotal * 100) / 100,
      travel: Math.round(travelTotal * 100) / 100,
      services: Math.round(otherCostsTotal * 100) / 100,
      risk: Math.round(riskPremiumTotal * 100) / 100,
      scanning: Math.round(totalScanningCost * 100) / 100,
    },
    scanningEstimate,
  };
}

// Export types for components
export type { PricingLineItem as LineItem };

// ============================================
// GM HARD GATE - FY26 Governance Rules
// ============================================
export { FY26_GOALS, validateMarginGate, getMarginStatus };

/**
 * Calculate margin percentage from pricing result
 */
export function calculateMarginPercent(pricing: PricingResult): number {
  if (pricing.totalClientPrice <= 0) return 0;
  return ((pricing.totalClientPrice - pricing.totalUpteamCost) / pricing.totalClientPrice) * 100;
}

/**
 * Check if the quote passes the GM Hard Gate (40% minimum margin)
 * Returns true if margin is at or above the floor, false otherwise
 */
export function passesMarginGate(pricing: PricingResult): boolean {
  const marginPercent = calculateMarginPercent(pricing);
  return marginPercent >= (FY26_GOALS.MARGIN_FLOOR * 100);
}

/**
 * Get margin gate validation result
 * Returns null if passed, error message if blocked
 */
export function getMarginGateError(pricing: PricingResult): string | null {
  const marginPercent = calculateMarginPercent(pricing);
  return validateMarginGate(marginPercent);
}

// ============================================
// TIER A PRICING - Large Projects (≥50,000 sqft)
// ============================================
import { TIER_A_THRESHOLD, TIER_A_SCANNING_COSTS, TIER_A_MARGINS, TRAVEL_TIERS } from '@shared/schema';

export { TIER_A_THRESHOLD, TIER_A_SCANNING_COSTS, TIER_A_MARGINS, TRAVEL_TIERS };

export interface TierAPricingConfig {
  scanningCost: keyof typeof TIER_A_SCANNING_COSTS | 'other' | '' | null;
  scanningCostOther?: number;
  modelingCost: number;
  margin: keyof typeof TIER_A_MARGINS | '' | null;
}

export interface TierAPricingResult {
  scanningCost: number;
  modelingCost: number;
  subtotal: number;
  margin: number;
  marginLabel: string;
  clientPrice: number;
  travelCost: number;
  totalWithTravel: number;
}

/**
 * Check if a project qualifies for Tier A pricing (≥50,000 sqft)
 */
export function isTierAProject(totalSqft: number): boolean {
  return totalSqft >= TIER_A_THRESHOLD;
}

/**
 * Get square feet from an area, converting acres to sqft for landscape areas
 * Uses buildingType (14-15) to determine landscape, with fallback to kind field
 */
export function getAreaSqft(area: Area): number {
  const value = parseFloat(area.squareFeet) || 0;
  const isLandscape = isLandscapeBuildingType(area.buildingType) || area.kind === "landscape";
  if (isLandscape) {
    return Math.round(value * ACRES_TO_SQFT);
  }
  return value;
}

/**
 * Calculate total sqft from all areas (standard + landscape)
 */
export function calculateTotalSqft(areas: Area[]): number {
  return areas.reduce((sum, area) => sum + getAreaSqft(area), 0);
}

/**
 * Calculate Tier A travel cost based on project size and distance
 * Tier A: $0 base + $4/mile over 20 miles
 */
export function calculateTierATravelCost(distanceMiles: number): number {
  const { base, perMileOver, mileThreshold } = TRAVEL_TIERS.TIER_A;
  const additionalMiles = Math.max(0, distanceMiles - mileThreshold);
  return base + (additionalMiles * perMileOver);
}

/**
 * Calculate Tier A pricing using the specialized formula:
 * Client Price = (Scanning Cost + Modeling Cost) × Margin Multiplier
 */
export function calculateTierAPricing(
  config: TierAPricingConfig,
  distanceMiles: number = 0
): TierAPricingResult {
  // Get scanning cost
  let scanningCost = 0;
  const scanCostValue = config.scanningCost;
  if (scanCostValue === 'other' && config.scanningCostOther) {
    scanningCost = config.scanningCostOther;
  } else if (scanCostValue && scanCostValue !== 'other') {
    scanningCost = TIER_A_SCANNING_COSTS[scanCostValue as keyof typeof TIER_A_SCANNING_COSTS] || 0;
  }

  const modelingCost = config.modelingCost || 0;
  const subtotal = scanningCost + modelingCost;

  // Get margin multiplier
  let margin = 1;
  let marginLabel = 'No Margin Selected';
  const marginValue = config.margin;
  if (marginValue) {
    const marginConfig = TIER_A_MARGINS[marginValue as keyof typeof TIER_A_MARGINS];
    if (marginConfig) {
      margin = marginConfig.value;
      marginLabel = marginConfig.label;
    }
  }

  const clientPrice = Math.round(subtotal * margin * 100) / 100;

  // Calculate Tier A travel
  const travelCost = calculateTierATravelCost(distanceMiles);
  const totalWithTravel = clientPrice + travelCost;

  return {
    scanningCost,
    modelingCost,
    subtotal,
    margin,
    marginLabel,
    clientPrice,
    travelCost,
    totalWithTravel: Math.round(totalWithTravel * 100) / 100,
  };
}

/**
 * Get travel tier info based on project sqft
 */
export function getTravelTier(sqft: number): { tier: 'A' | 'B' | 'C'; baseFee: number; perMile: number; mileThreshold: number } {
  if (sqft >= TRAVEL_TIERS.TIER_A.minSqft) {
    return { tier: 'A', baseFee: TRAVEL_TIERS.TIER_A.base, perMile: TRAVEL_TIERS.TIER_A.perMileOver, mileThreshold: TRAVEL_TIERS.TIER_A.mileThreshold };
  }
  if (sqft >= TRAVEL_TIERS.TIER_B.minSqft) {
    return { tier: 'B', baseFee: TRAVEL_TIERS.TIER_B.base, perMile: 0, mileThreshold: 0 };
  }
  return { tier: 'C', baseFee: TRAVEL_TIERS.TIER_C.base, perMile: 0, mileThreshold: 0 };
}
