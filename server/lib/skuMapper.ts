/**
 * SKU Mapper - Translates CPQ line items to official QuickBooks Product SKUs
 * 
 * Maps discipline + LoD + scope combinations to the official SKU catalog
 * imported from QuickBooks for accurate estimate line items.
 */

import { db } from "../db";
import { products } from "@shared/schema";
import { eq, like, and, or } from "drizzle-orm";

export interface SkuLookupResult {
  sku: string;
  name: string;
  description: string | null;
  category: string;
}

// Building type classification for SKU resolution
function getBuildingClass(buildingTypeId: string): "COM" | "RES" | "LNDSCP" {
  const residential = ["2", "3"]; // Residential - Standard, Residential - Luxury
  const landscape = ["14", "15"]; // Built Landscape, Natural Landscape
  
  if (residential.includes(buildingTypeId)) return "RES";
  if (landscape.includes(buildingTypeId)) return "LNDSCP";
  return "COM";
}

// Normalize LoD to valid QB values (200, 300, 350)
function normalizeLoD(lod: string): "200" | "300" | "350" {
  const numLod = parseInt(lod, 10);
  if (numLod <= 200) return "200";
  if (numLod <= 300) return "300";
  return "350";
}

// Map scope to SKU suffix
function getScopeSuffix(scope: string): "" | " INT" | " EXT" {
  const normalized = scope.toLowerCase();
  if (normalized === "interior") return " INT";
  if (normalized === "exterior" || normalized === "roof" || normalized === "facade") return " EXT";
  return ""; // "full" or "mixed" = full building
}

/**
 * Get the primary service SKU for a Scan2Plan project
 * This maps the main architecture discipline to the core S2P product
 */
export function getPrimaryServiceSku(
  buildingTypeId: string,
  lod: string,
  scope: string = "full"
): string {
  const buildingClass = getBuildingClass(buildingTypeId);
  const normalizedLod = normalizeLoD(lod);
  const scopeSuffix = getScopeSuffix(scope);
  
  // Landscape projects use different SKU pattern
  if (buildingClass === "LNDSCP") {
    return `S2P LNDSCP ${normalizedLod}`;
  }
  
  // Standard projects: S2P COM 200, S2P RES 300, S2P COM INT 350, etc.
  const baseSku = `S2P ${buildingClass}${scopeSuffix} ${normalizedLod}`.replace("  ", " ");
  return baseSku.trim();
}

/**
 * Get added discipline SKU (MEPF, Structure, Grade)
 */
export function getAddedDisciplineSku(discipline: string, lod: string): string {
  const normalizedLod = normalizeLoD(lod);
  
  const disciplineMap: Record<string, string> = {
    mepf: "AD MEPF",
    mep: "AD MEPF",
    structure: "AD STR MOD",
    structural: "AD STR MOD",
    site: "AD GRADE",
    grade: "AD GRADE",
  };
  
  const prefix = disciplineMap[discipline.toLowerCase()] || "AD MEPF";
  return `${prefix} ${normalizedLod}`;
}

/**
 * Get add-on service SKU
 */
export function getServiceSku(service: string): string {
  const serviceMap: Record<string, string> = {
    matterport: "AO MAT 3D TOUR",
    georeferencing: "AO GEOREF",
    ifc: "AO IFC DXF",
    dxf: "AO IFC DXF",
    rhino: "AO RHINO MDL",
    sketchup: "AO SKETCH MOD",
    vectorworks: "AO VCT MDL",
    scanning: "S2P LID SCN PNT CLD REG",
  };
  
  return serviceMap[service.toLowerCase()] || service;
}

/**
 * Get price modifier SKU
 */
export function getPriceModSku(modifier: string): string {
  const modifierMap: Record<string, string> = {
    "50_50": "PM 50% DUE",
    credit: "PM CRE",
    credit_card: "PM CRE CRD",
    discount: "PM DIS",
    expedited: "PM EXP SER",
    fire_flood: "PM FIR FLD",
    net_60: "PM NET 60",
    net_90: "PM NET 90",
    no_power: "PM NO POW",
    occupied: "PM OCC",
    hazardous: "PM FIR FLD", // Map to Fire/Flood as closest match
  };
  
  return modifierMap[modifier.toLowerCase()] || `PM ${modifier.toUpperCase()}`;
}

/**
 * Look up product details from database by SKU
 */
export async function lookupProductBySku(sku: string): Promise<SkuLookupResult | null> {
  const product = await db.query.products.findFirst({
    where: eq(products.sku, sku),
  });
  
  if (!product) return null;
  
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
  };
}

/**
 * Look up product by pattern (for fuzzy matching)
 */
export async function searchProducts(searchTerm: string): Promise<SkuLookupResult[]> {
  const results = await db.query.products.findMany({
    where: or(
      like(products.sku, `%${searchTerm}%`),
      like(products.name, `%${searchTerm}%`)
    ),
  });
  
  return results.map(p => ({
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
  }));
}

/**
 * Generate complete SKU list for a CPQ quote
 * Returns array of SKUs with their line item details
 */
export interface QuoteLineItemSku {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  category: "primary" | "discipline" | "service" | "modifier" | "travel";
  description?: string | null;
}

export async function generateQuoteSkus(
  areas: Array<{
    buildingType: string;
    disciplines: string[];
    disciplineLods?: Record<string, { lod: string; scope?: string }>;
    squareFeet: string;
    lod?: string;
    scope?: string;
  }>,
  services: Record<string, number>,
  risks: string[],
  paymentTerms?: string
): Promise<QuoteLineItemSku[]> {
  const lineItems: QuoteLineItemSku[] = [];
  
  for (const area of areas) {
    const primaryLod = area.disciplineLods?.architecture?.lod || area.lod || "300";
    const primaryScope = area.disciplineLods?.architecture?.scope || area.scope || "full";
    
    // Primary service (Architecture/core Scan2Plan service)
    if (area.disciplines.includes("architecture") || area.disciplines.includes("arch")) {
      const sku = getPrimaryServiceSku(area.buildingType, primaryLod, primaryScope);
      const product = await lookupProductBySku(sku);
      
      lineItems.push({
        sku,
        name: product?.name || `Scan2Plan Service - LoD ${primaryLod}`,
        quantity: 1,
        unitPrice: 0, // Calculated by CPQ engine
        category: "primary",
        description: product?.description,
      });
    }
    
    // Added disciplines
    for (const discipline of area.disciplines) {
      if (discipline === "architecture" || discipline === "arch") continue;
      
      const discLod = area.disciplineLods?.[discipline]?.lod || primaryLod;
      const sku = getAddedDisciplineSku(discipline, discLod);
      const product = await lookupProductBySku(sku);
      
      lineItems.push({
        sku,
        name: product?.name || `${discipline} - LoD ${discLod}`,
        quantity: 1,
        unitPrice: 0,
        category: "discipline",
        description: product?.description,
      });
    }
  }
  
  // Services (Matterport, etc.)
  for (const [service, qty] of Object.entries(services)) {
    if (qty <= 0) continue;
    
    const sku = getServiceSku(service);
    const product = await lookupProductBySku(sku);
    
    lineItems.push({
      sku,
      name: product?.name || service,
      quantity: qty,
      unitPrice: 0,
      category: "service",
      description: product?.description,
    });
  }
  
  // Risk modifiers
  for (const risk of risks) {
    const sku = getPriceModSku(risk);
    const product = await lookupProductBySku(sku);
    
    lineItems.push({
      sku,
      name: product?.name || `Risk: ${risk}`,
      quantity: 1,
      unitPrice: 0,
      category: "modifier",
      description: product?.description,
    });
  }
  
  return lineItems;
}

export default {
  getPrimaryServiceSku,
  getAddedDisciplineSku,
  getServiceSku,
  getPriceModSku,
  lookupProductBySku,
  searchProducts,
  generateQuoteSkus,
};
