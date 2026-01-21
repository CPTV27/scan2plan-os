/**
 * Proposal Data Mapper
 *
 * Maps Lead and Quote data into ProposalData structure for PDF generation
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { Lead, CpqQuote } from "@shared/schema";
import type { ProposalData, LineItem } from "../pdf/proposalGenerator";
import { getAddedDisciplineSku, getPriceModSku, getServiceSku } from "./skuMapper";

/**
 * Calculate total square footage from quote areas
 */
export function calculateTotalSqft(areas: any[] | null | undefined): number {
  if (!areas || !Array.isArray(areas)) return 0;
  return areas.reduce((total, area) => total + (Number(area.sqft) || 0), 0);
}

/**
 * Extract scope summary from quote areas
 */
export function extractScope(areas: any[] | null | undefined): string {
  if (!areas || !Array.isArray(areas) || areas.length === 0) {
    return "Interior and Exterior";
  }

  const scopes = new Set(areas.map((a) => a.scope).filter(Boolean));
  const scopeArray: string[] = [];
  scopes.forEach((scope) => scopeArray.push(scope));
  return scopeArray.join(" + ") || "Full Building";
}

/**
 * Extract disciplines from quote areas
 */
export function extractDisciplines(areas: any[] | null | undefined): string {
  if (!areas || !Array.isArray(areas) || areas.length === 0) {
    return "Architecture";
  }

  const disciplines = areas
    .map((area) => {
      const discipline = area.discipline || "Architecture";
      const lodLevel = area.lodLevel || "300";
      return `${discipline} LOD ${lodLevel}`;
    })
    .filter(Boolean);

  const uniqueDisciplines = new Set(disciplines);
  const disciplineArray: string[] = [];
  uniqueDisciplines.forEach((d) => disciplineArray.push(d));
  return disciplineArray.join(", ") || "Architecture LOD 300";
}

/**
 * Extract LoD levels from quote areas
 */
export function extractLodLevels(areas: any[] | null | undefined): string[] {
  if (!areas || !Array.isArray(areas) || areas.length === 0) {
    return ["300"];
  }

  const levels = areas.map((a) => a.lodLevel || "300").filter(Boolean);
  const uniqueLevels = new Set(levels);
  const levelArray: string[] = [];
  uniqueLevels.forEach((level) => levelArray.push(level));
  return levelArray;
}

/**
 * Format services list
 */
export function formatServices(services: any): string {
  if (!services) return "None";

  const serviceList: string[] = [];

  if (services.matterport > 0) {
    serviceList.push(`Matterport 3D Tour (${services.matterport})`);
  }
  if (services.photography > 0) {
    serviceList.push(`Site Photography (${services.photography})`);
  }

  return serviceList.length > 0 ? serviceList.join(", ") : "None";
}

function normalizeDisciplineLabel(value: string | null | undefined): string | null {
  const lower = String(value || "").trim().toLowerCase();
  if (!lower) return null;
  if (lower.includes("mep")) return "MEPF";
  if (lower.includes("struct")) return "Structure";
  if (lower.includes("landscape")) return "Landscape";
  if (lower.includes("grade") || lower.includes("site") || lower.includes("civil")) return "Grade";
  if (lower.includes("arch")) return "Architecture";
  if (lower.includes("matterport")) return "Matterport";

  return lower
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDisciplineList(quote: CpqQuote | null, lead: Lead): string[] {
  const disciplineSet = new Set<string>();
  const addDiscipline = (value: string | null | undefined) => {
    const normalized = normalizeDisciplineLabel(value);
    if (normalized && normalized !== "Matterport") {
      disciplineSet.add(normalized);
    }
  };

  if (quote?.areas && Array.isArray(quote.areas)) {
    (quote.areas as any[]).forEach((area) => {
      const areaDisciplines = Array.isArray(area.disciplines)
        ? area.disciplines
        : area.discipline
          ? [area.discipline]
          : [];
      areaDisciplines.forEach((d: string) => addDiscipline(d));
    });
  }

  const scopingData = quote?.scopingData as any;
  if (Array.isArray(scopingData?.disciplines)) {
    scopingData.disciplines.forEach((d: string) => addDiscipline(d));
  }

  if (!disciplineSet.size && lead.disciplines) {
    lead.disciplines
      .split(/[,;+]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((d) => addDiscipline(d));
  }

  const normalized = Array.from(disciplineSet);
  if (normalized.length > 1 && normalized.includes("Architecture")) {
    return normalized.filter((item) => item !== "Architecture");
  }

  return normalized;
}

function detectMatterport(quote: CpqQuote | null, lead: Lead): boolean {
  const scopingData = (quote?.scopingData as any) || {};
  const services = (quote as any)?.services || {};
  const cpqServices = (quote as any)?.cpqServices || {};
  const areas = (quote?.areas as any[]) || [];

  const hasAreaDiscipline =
    Array.isArray(quote?.areas) &&
    areas.some(
      (area) =>
        Array.isArray(area.disciplines) &&
        area.disciplines.some((d: string) => String(d || "").toLowerCase().includes("matterport"))
    );

  return Boolean(
    scopingData?.matterport > 0 ||
    services?.matterport > 0 ||
    cpqServices?.matterport > 0 ||
    hasAreaDiscipline ||
    (lead as any).matterportRequired
  );
}

function buildLodLabel(lodLevels: string[]): string | undefined {
  const lodNumbers = lodLevels
    .map((lod) => parseInt(lod, 10))
    .filter((lod) => !Number.isNaN(lod));

  if (lodNumbers.length === 0) {
    return lodLevels[0] ? `LoD ${lodLevels[0]}` : undefined;
  }

  const maxLod = Math.max(...lodNumbers);
  return `LoD ${maxLod}`;
}

function buildCoverLine(lodLabel: string | undefined, disciplines: string[], hasMatterport: boolean): string {
  const parts: string[] = [];
  if (lodLabel) parts.push(lodLabel);
  if (disciplines.length) parts.push(disciplines.join(" + "));
  if (hasMatterport) parts.push("Matterport");
  return parts.join(" + ");
}

function splitAddressLines(address: string | null | undefined): string[] {
  const trimmed = String(address || "").trim();
  if (!trimmed) return [];

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const line1 = parts.shift() || "";
    const line2 = parts.join(", ").replace(/\s+/g, " ").trim();
    return [line1, line2].filter(Boolean);
  }

  return [trimmed];
}

type ProductCatalogEntry = {
  sku: string;
  name: string;
  description: string;
  category: string;
};

let productCatalogCache: Map<string, ProductCatalogEntry> | null = null;

function loadProductCatalog(): Map<string, ProductCatalogEntry> {
  if (productCatalogCache) return productCatalogCache;

  const catalog = new Map<string, ProductCatalogEntry>();
  productCatalogCache = catalog;

  const csvPath = path.join(
    process.cwd(),
    "resources",
    "documentation",
    "products and descriptions.csv"
  );

  if (!fs.existsSync(csvPath)) return catalog;

  try {
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const records: Record<string, string>[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    records.forEach((record) => {
      const sku = String(record["SKU"] || "").trim();
      if (!sku) return;

      const name = String(record["Product/Service Name"] || "").trim();
      const description = String(record["Sales Description"] || "").trim();
      const category = String(record["Category"] || "").trim();

      catalog.set(sku, {
        sku,
        name,
        description,
        category,
      });
    });
  } catch {
    return catalog;
  }

  return catalog;
}

function getProductBySku(sku: string): ProductCatalogEntry | null {
  const catalog = loadProductCatalog();
  return catalog.get(sku) || null;
}

function cleanDescription(value: string, maxLength: number = 48): string {
  const compact = value
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (compact.length <= maxLength) return compact;
  return compact.slice(0, Math.max(0, maxLength - 3)).trimEnd() + "...";
}

function normalizeLod(lod: string): string {
  const lodNum = parseInt(lod, 10);
  if (Number.isNaN(lodNum)) return "300";
  if (lodNum <= 200) return "200";
  if (lodNum <= 300) return "300";
  return "350";
}

function getScopeSuffix(scope?: string): string {
  const normalized = String(scope || "").toLowerCase();
  if (normalized === "interior") return " INT";
  if (normalized === "exterior" || normalized === "roof" || normalized === "facade") return " EXT";
  return "";
}

function getPrimaryServiceSku(buildingType: string | number | null | undefined, lod: string, scope?: string): string {
  const normalizedLod = normalizeLod(lod);
  const id = Number(buildingType);
  const isLandscape = id === 14 || id === 15;
  if (isLandscape) return `S2P LNDSCP ${normalizedLod}`;

  let buildingClass = "COM";
  if (!Number.isNaN(id) && id >= 1 && id <= 6) {
    buildingClass = "RES";
  } else if (Number.isNaN(id) && typeof buildingType === "string") {
    const lower = buildingType.toLowerCase();
    if (lower.includes("residential")) buildingClass = "RES";
  }

  const scopeSuffix = getScopeSuffix(scope);
  return `S2P ${buildingClass}${scopeSuffix} ${normalizedLod}`.replace("  ", " ").trim();
}

function getAreaNameFromLabel(label: string): string | null {
  const parts = label.split(" - ");
  if (parts.length < 2) return null;
  return parts[0].trim() || null;
}

function findAreaByName(areas: any[] | null | undefined, name: string | null): any | null {
  if (!areas || !name) return null;
  return areas.find((area) => String(area.name || "").trim() === name) || null;
}

function detectDiscipline(label: string): string | null {
  const lower = label.toLowerCase();
  if (lower.includes("risk premium") || lower.includes("discount") || lower.includes("adjustment")) {
    return null;
  }
  if (lower.includes("mep")) return "mepf";
  if (lower.includes("struct")) return "structure";
  if (lower.includes("grade") || lower.includes("site") || lower.includes("landscape")) return "site";
  if (lower.includes("architecture") || lower.includes("bim")) return "architecture";
  return null;
}

function extractLod(label: string, area: any | null, discipline: string | null): string {
  const lodMatch = label.match(/lod\s*(\d{2,3})/i);
  if (lodMatch?.[1]) return lodMatch[1];
  if (area && discipline && area.disciplineLods?.[discipline]?.lod) {
    return String(area.disciplineLods[discipline].lod);
  }
  if (area?.lod) return String(area.lod);
  return "300";
}

function extractQuantity(label: string, area: any | null): { qty: number; unit: string | null } {
  const elevationMatch = label.match(/Additional Elevations\s*\((\d+)\)/i);
  if (elevationMatch?.[1]) {
    return { qty: parseInt(elevationMatch[1], 10), unit: "ea" };
  }

  const acresMatch = label.match(/\(([\d.]+)\s*acres?/i);
  if (acresMatch?.[1]) {
    const qty = parseFloat(acresMatch[1]);
    return { qty, unit: "acres" };
  }

  const sqftMatch = label.match(/\(([\d,.]+)\s*sqft/i);
  if (sqftMatch?.[1]) {
    const qty = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
    return { qty, unit: "sqft" };
  }

  const timesMatch = label.match(/\bx\s*([\d,.]+)\b/i);
  if (timesMatch?.[1]) {
    const qty = parseFloat(timesMatch[1].replace(/,/g, ""));
    return { qty, unit: null };
  }

  const areaSqft = Number(area?.sqft || area?.squareFeet);
  if (!Number.isNaN(areaSqft) && areaSqft > 0) {
    const isLandscape =
      String(area?.buildingType || "") === "14" ||
      String(area?.buildingType || "") === "15" ||
      area?.kind === "landscape";
    return { qty: areaSqft, unit: isLandscape ? "acres" : "sqft" };
  }

  return { qty: 1, unit: null };
}

function buildAreaDescription(areaName: string | null, qty: number, unit: string | null): string {
  if (!qty || !unit) return areaName || "";

  const formattedQty = unit === "sqft" ? qty.toLocaleString("en-US") : qty.toString();
  if (areaName) {
    return `${areaName} - ${formattedQty} ${unit}`;
  }

  return `${formattedQty} ${unit}`;
}

function resolveCadSku(area: any | null): string {
  const disciplines = Array.isArray(area?.disciplines) ? area.disciplines : [];
  const hasMep = disciplines.some((d: string) => d.toLowerCase().includes("mep"));
  const hasStructure = disciplines.some((d: string) => d.toLowerCase().includes("struct"));

  if (hasStructure && hasMep) return "CAD STC MEPF PKG";
  if (hasStructure) return "CAD STC STD PKG";
  if (hasMep) return "CAD MEPF STD PKG";
  return "CAD STD PKG";
}

function resolvePriceModifierSku(labelLower: string): string | null {
  if (labelLower.includes("occupied")) return getPriceModSku("occupied");
  if (labelLower.includes("no power")) return getPriceModSku("no_power");
  if (labelLower.includes("hazardous")) return getPriceModSku("hazardous");
  if (labelLower.includes("fire") || labelLower.includes("flood")) return getPriceModSku("fire_flood");
  if (labelLower.includes("expedited")) return getPriceModSku("expedited");
  if (labelLower.includes("discount")) return getPriceModSku("discount");
  if (labelLower.includes("credit card")) return getPriceModSku("credit_card");
  if (labelLower.includes("credit")) return getPriceModSku("credit");
  if (labelLower.includes("net 60")) return getPriceModSku("net_60");
  if (labelLower.includes("net 90")) return getPriceModSku("net_90");
  return null;
}

function resolveServiceSku(labelLower: string): string | null {
  if (labelLower.includes("matterport")) return getServiceSku("matterport");
  if (labelLower.includes("georeferenc")) return getServiceSku("georeferencing");
  if (labelLower.includes("ifc") || labelLower.includes("dxf")) return getServiceSku("ifc");
  if (labelLower.includes("rhino")) return getServiceSku("rhino");
  if (labelLower.includes("sketchup")) return getServiceSku("sketchup");
  if (labelLower.includes("vectorworks")) return getServiceSku("vectorworks");
  if (labelLower.includes("exposed ceiling")) return "AO EXP CEIL";
  if (labelLower.includes("scanning") || labelLower.includes("point cloud") || labelLower.includes("registration")) {
    return getServiceSku("scanning");
  }
  return null;
}

function buildProductInfo(params: {
  label: string;
  area: any | null;
  discipline: string | null;
  lod: string;
  scope: string | null;
  lead: Lead;
}): { name: string; description: string } {
  const labelLower = params.label.toLowerCase();

  let sku: string | null = resolvePriceModifierSku(labelLower);
  let areaProductName: string | null = null;

  if (params.discipline === "architecture" && params.area?.productSku) {
    sku = params.area.productSku;
    areaProductName = params.area.productName || null;
  }

  if (!sku && params.discipline && Array.isArray(params.area?.disciplineProducts)) {
    const match = params.area.disciplineProducts.find(
      (entry: any) => entry.discipline === params.discipline
    );
    if (match?.sku) {
      sku = match.sku;
      areaProductName = match.productName || null;
    }
  }

  if (!sku) sku = resolveServiceSku(labelLower);

  if (!sku && labelLower.includes("additional elevations")) {
    sku = "CAD INT ELEV";
  }

  if (!sku && labelLower.includes("cad")) {
    sku = resolveCadSku(params.area);
  }

  if (!sku && params.discipline === "architecture") {
    sku = getPrimaryServiceSku(params.area?.buildingType || params.lead.buildingType, params.lod, params.scope || "full");
  }

  if (!sku && params.discipline && params.discipline !== "architecture") {
    sku = getAddedDisciplineSku(params.discipline, params.lod);
  }

  if (!sku && labelLower.includes("landscape")) {
    sku = getPrimaryServiceSku(14, params.lod, params.scope || "full");
  }

  if (sku) {
    const product = getProductBySku(sku);
    const name = product?.name || areaProductName || params.label;
    const description = product?.description ? cleanDescription(product.description) : "";
    return { name, description };
  }

  return {
    name: params.label,
    description: "",
  };
}

/**
 * Generate line items from quote
 * Phase 6 Implementation: Extract detailed line items from pricingBreakdown or areas
 */
export function generateLineItems(quote: CpqQuote | null, lead: Lead): LineItem[] {
  if (!quote) {
    if (lead.sqft && lead.value) {
      return [
        {
          item: "3D Scanning & BIM Modeling",
          description: `${lead.buildingType || "Building"} - ${lead.sqft.toLocaleString()} sqft`,
          qty: lead.sqft,
          rate: Number(lead.value) / lead.sqft,
          amount: Number(lead.value),
        },
      ];
    }
    return [];
  }

  type LineItemDraft = {
    item: string;
    description: string;
    qty: number;
    amount: number;
    isArchitecture: boolean;
  };

  const drafts: LineItemDraft[] = [];
  const quoteAreas = (quote.areas as any[]) || [];

  const pricingBreakdown = quote.pricingBreakdown as {
    items?: Array<{ label?: string; value?: number; isTotal?: boolean }>;
  } | Array<Record<string, any>> | null;

  let travelAmount = 0;

  const shouldSkipLabel = (labelLower: string, isTotal?: boolean): boolean => {
    if (isTotal) return true;
    if (labelLower.includes("base subtotal")) return true;
    if (labelLower.includes("effective price")) return true;
    if (labelLower.includes("subtotal")) return true;
    if (labelLower === "total") return true;
    return false;
  };

  const addDraft = (params: {
    label: string;
    amount: number;
    area: any | null;
    discipline: string | null;
    qty: number;
    unit: string | null;
    lod: string;
    scope: string | null;
  }) => {
    const productInfo = buildProductInfo({
      label: params.label,
      area: params.area,
      discipline: params.discipline,
      lod: params.lod,
      scope: params.scope,
      lead,
    });

    const areaName = getAreaNameFromLabel(params.label);
    const areaDescription = buildAreaDescription(areaName, params.qty, params.unit);
    const description = areaDescription || productInfo.description || params.label;

    drafts.push({
      item: productInfo.name,
      description,
      qty: params.qty || 1,
      amount: params.amount,
      isArchitecture: params.discipline === "architecture",
    });
  };

  if (pricingBreakdown && !Array.isArray(pricingBreakdown) && Array.isArray(pricingBreakdown.items)) {
    pricingBreakdown.items.forEach((item) => {
      const label = String(item.label || "").trim();
      const amount = Number(item.value) || 0;
      if (!label || Math.abs(amount) < 0.001) return;

      const labelLower = label.toLowerCase();
      if (shouldSkipLabel(labelLower, item.isTotal)) return;

      if (labelLower.includes("travel")) {
        travelAmount += amount;
        return;
      }

      const areaName = getAreaNameFromLabel(label);
      const area = findAreaByName(quoteAreas, areaName);
      const discipline = detectDiscipline(label);
      const lod = extractLod(label, area, discipline);
      const scope = area?.disciplineLods?.[discipline || ""]?.scope || area?.scope || "full";
      const { qty, unit } = extractQuantity(label, area);

      addDraft({
        label,
        amount,
        area,
        discipline,
        qty,
        unit,
        lod,
        scope,
      });
    });
  } else if (Array.isArray(pricingBreakdown)) {
    pricingBreakdown.forEach((item) => {
      const label = String(item.label || item.name || "Service").trim();
      const amount = Number(item.value ?? item.totalPrice ?? item.amount ?? 0);
      if (!label || Math.abs(amount) < 0.001) return;

      const labelLower = label.toLowerCase();
      if (shouldSkipLabel(labelLower, item.isTotal)) return;
      if (labelLower.includes("travel")) {
        travelAmount += amount;
        return;
      }

      const areaName = getAreaNameFromLabel(label);
      const area = findAreaByName(quoteAreas, areaName);
      const discipline = detectDiscipline(label);
      const lod = extractLod(label, area, discipline);
      const scope = area?.disciplineLods?.[discipline || ""]?.scope || area?.scope || "full";
      const { qty, unit } = extractQuantity(label, area);

      addDraft({
        label,
        amount,
        area,
        discipline,
        qty,
        unit,
        lod,
        scope,
      });
    });
  } else if (quoteAreas.length > 0) {
    quoteAreas.forEach((area: any, idx: number) => {
      const areaName = area.name || area.buildingType || `Area ${idx + 1}`;
      const sqft = Number(area.sqft || area.squareFeet) || 0;
      const scope = area.scope || "full";

      const scanningCost = Number(area.scanningCost) || 0;
      if (scanningCost > 0) {
        addDraft({
          label: `${areaName} - Laser Scanning`,
          amount: scanningCost,
          area,
          discipline: null,
          qty: sqft || 1,
          unit: sqft ? "sqft" : null,
          lod: extractLod(`${areaName} - Laser Scanning`, area, null),
          scope,
        });
      }

      const disciplines = area.disciplines || [area.discipline || "architecture"];
      const modelingCost = Number(area.modelingCost) || 0;
      const lodLevel = area.lodLevel || area.lod || "300";

      if (modelingCost > 0) {
        if (Array.isArray(disciplines) && disciplines.length > 0) {
          const costPerDiscipline = modelingCost / disciplines.length;
          disciplines.forEach((discipline: string) => {
            const normalizedDiscipline = String(discipline).toLowerCase();
            const disciplineName = discipline.charAt(0).toUpperCase() + discipline.slice(1);
            addDraft({
              label: `${areaName} - ${disciplineName} Modeling`,
              amount: costPerDiscipline,
              area,
              discipline: normalizedDiscipline,
              qty: sqft || 1,
              unit: sqft ? "sqft" : null,
              lod: String(area.disciplineLods?.[normalizedDiscipline]?.lod || lodLevel),
              scope,
            });
          });
        } else {
          addDraft({
            label: `${areaName} - BIM Modeling`,
            amount: modelingCost,
            area,
            discipline: "architecture",
            qty: sqft || 1,
            unit: sqft ? "sqft" : null,
            lod: String(lodLevel),
            scope,
          });
        }
      }
    });
  }

  if (travelAmount <= 0 && (quote.distance || quote.customTravelCost)) {
    travelAmount =
      Number(quote.customTravelCost) || (Number(quote.distance) || 0) * 0.75;
  }

  if (travelAmount > 0) {
    const architectureItems = drafts.filter((item) => item.isArchitecture && item.amount > 0);
    if (architectureItems.length === 0) {
      const description = quote.dispatchLocation
        ? `${quote.distance || 0} miles from ${quote.dispatchLocation}`
        : "Travel";
      drafts.push({
        item: "Travel",
        description,
        qty: Number(quote.distance) || 1,
        amount: travelAmount,
        isArchitecture: false,
      });
    } else {
      const totalArchitecture = architectureItems.reduce((sum, item) => sum + item.amount, 0);
      let remaining = travelAmount;

      architectureItems.forEach((item, index) => {
        const share =
          totalArchitecture > 0
            ? travelAmount * (item.amount / totalArchitecture)
            : travelAmount / architectureItems.length;
        const rounded = index === architectureItems.length - 1 ? remaining : Math.round(share * 100) / 100;
        item.amount += rounded;
        remaining -= rounded;
      });
    }
  }

  return drafts
    .filter((item) => Math.abs(item.amount) > 0.001)
    .map((item) => ({
      item: item.item,
      description: item.description,
      qty: item.qty || 1,
      rate: item.qty ? item.amount / item.qty : item.amount,
      amount: item.amount,
    }));
}

/**
 * Map Lead and Quote data to ProposalData structure
 */
export function mapProposalData(lead: Lead, quote: CpqQuote | null): ProposalData {
  // Project title
  const projectTitle = quote?.projectName || lead.projectName || lead.clientName;

  // Client name
  const clientName = quote?.clientName || lead.clientName;

  // Location
  const location = quote?.projectAddress || lead.projectAddress || "New York";

  // Date
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Overview
  const totalSqft = quote ? calculateTotalSqft(quote.areas as any) : lead.sqft || 0;
  const buildingType = quote?.typeOfBuilding || lead.buildingType || "Commercial Building";

  const overview = {
    projectName: projectTitle,
    address: location,
    buildingType,
    sqft: totalSqft,
    description: lead.notes || "",
  };

  // Scope
  const scopeSummary = quote ? extractScope(quote.areas as any) : lead.scope || "Full Building";
  const disciplines = quote
    ? extractDisciplines(quote.areas as any)
    : lead.disciplines || "Architecture";
  const deliverables =
    (quote?.scopingData as any)?.bimDeliverable || lead.bimDeliverable || "Revit";
  const lodLevels = quote ? extractLodLevels(quote.areas as any) : ["300"];

  const disciplineList = buildDisciplineList(quote, lead);
  const hasMatterport = detectMatterport(quote, lead);
  const lodLabel = buildLodLabel(lodLevels);
  const coverLine = buildCoverLine(lodLabel, disciplineList, hasMatterport) || scopeSummary;

  const scope = {
    scopeSummary,
    disciplines,
    deliverables,
    lodLevels,
    disciplineList,
    hasMatterport,
    lodLabel,
    servicesLine: coverLine,
  };

  // Timeline
  const duration = lead.timeline || "4-6 weeks";
  const milestones: string[] = [];

  const timeline = {
    duration,
    milestones,
  };

  // Line items
  const lineItems = generateLineItems(quote, lead);

  // Totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = quote?.totalPrice ? Number(quote.totalPrice) : subtotal;

  // Payment terms
  const upfrontAmount = total * 0.5;
  const totalAmount = total;

  const paymentTerms = {
    structure: "50% upfront upon contract signing, 50% upon delivery",
    upfrontAmount,
    totalAmount,
    methods: ["Check", "Wire Transfer", "Credit Card (3% processing fee)"],
    terms: lead.paymentTerms || quote?.paymentTerms || "Net 30",
  };

  return {
    addressLines: splitAddressLines(location),
    coverLine,
    projectTitle,
    clientName,
    date,
    location,
    overview,
    scope,
    timeline,
    lineItems,
    subtotal,
    total,
    paymentTerms,
  };
}
