/**
 * Proposal Data Mapper
 *
 * Maps Lead and Quote data into ProposalData structure for PDF generation
 */

import type { Lead, CpqQuote } from "@shared/schema";
import type { ProposalData, LineItem } from "../pdf/proposalGenerator";

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

/**
 * Generate line items from quote
 * Phase 6 Implementation: Extract detailed line items from pricingBreakdown or areas
 */
export function generateLineItems(quote: CpqQuote | null, lead: Lead): LineItem[] {
  const items: LineItem[] = [];

  if (!quote) {
    // Fallback: create simple line item from lead data
    if (lead.sqft && lead.value) {
      items.push({
        item: "3D Scanning & BIM Modeling",
        description: `${lead.buildingType || "Building"} - ${lead.sqft.toLocaleString()} sqft`,
        qty: lead.sqft,
        rate: Number(lead.value) / lead.sqft,
        amount: Number(lead.value),
      });
    }
    return items;
  }

  // Phase 6: Extract from pricingBreakdown.items if available (most accurate)
  const pricingBreakdown = quote.pricingBreakdown as {
    items?: Array<{ label: string; value: number; upteamCost?: number }>;
    subtotal?: number;
    totalClientPrice?: number;
    areaBreakdown?: any[];
    areas?: any[];
  } | null;

  if (pricingBreakdown?.items && Array.isArray(pricingBreakdown.items) && pricingBreakdown.items.length > 0) {
    // Use the detailed line items from the CPQ calculator
    pricingBreakdown.items.forEach((item) => {
      // Parse the label to extract meaningful info
      const label = item.label || "Service";
      const amount = Number(item.value) || 0;

      // Skip zero-value items
      if (amount <= 0) return;

      // Try to extract quantity from label (e.g., "Architecture (10,000 sqft)")
      const sqftMatch = label.match(/\(([\d,]+)\s*sqft\)/i);
      const qty = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, "")) : 1;

      // Calculate rate
      const rate = qty > 1 ? amount / qty : amount;

      // Determine description based on label content
      let description = "";
      if (label.toLowerCase().includes("scanning")) {
        description = "Laser scanning services";
      } else if (label.toLowerCase().includes("architecture")) {
        description = "BIM modeling - Architecture discipline";
      } else if (label.toLowerCase().includes("mep") || label.toLowerCase().includes("mechanical")) {
        description = "BIM modeling - MEP discipline";
      } else if (label.toLowerCase().includes("structure") || label.toLowerCase().includes("structural")) {
        description = "BIM modeling - Structural discipline";
      } else if (label.toLowerCase().includes("travel")) {
        description = quote.dispatchLocation
          ? `From ${quote.dispatchLocation}${quote.distance ? `, ${quote.distance} miles` : ""}`
          : "Round-trip travel";
      } else if (label.toLowerCase().includes("matterport")) {
        description = "Virtual 3D walkthrough capture";
      } else if (label.toLowerCase().includes("photo")) {
        description = "Professional site photography";
      } else if (label.toLowerCase().includes("risk") || label.toLowerCase().includes("premium")) {
        description = "Project complexity adjustment";
      } else if (label.toLowerCase().includes("adjustment")) {
        description = "Price adjustment";
      } else {
        description = "Additional services";
      }

      items.push({
        item: label,
        description,
        qty: typeof qty === "number" ? qty : 1,
        rate,
        amount,
      });
    });

    return items;
  }

  // Fallback: Extract from areas if pricingBreakdown.items not available
  if (quote.areas && Array.isArray(quote.areas)) {
    quote.areas.forEach((area: any, idx: number) => {
      const areaName = area.name || area.buildingType || `Area ${idx + 1}`;
      const sqft = Number(area.sqft || area.squareFeet) || 0;
      const scope = area.scope || "Full Building";

      // Scanning line item
      const scanningCost = Number(area.scanningCost) || 0;
      if (scanningCost > 0 || sqft > 0) {
        const scanRate = sqft > 0 ? scanningCost / sqft : scanningCost;
        items.push({
          item: `${areaName} - Laser Scanning`,
          description: `${sqft.toLocaleString()} sqft, ${scope}`,
          qty: sqft || 1,
          rate: scanRate || 0,
          amount: scanningCost,
        });
      }

      // Modeling line items (per discipline)
      const disciplines = area.disciplines || [area.discipline || "architecture"];
      const modelingCost = Number(area.modelingCost) || 0;
      const lodLevel = area.lodLevel || area.lod || "300";

      if (modelingCost > 0) {
        // If we have specific discipline costs, use them
        if (Array.isArray(disciplines) && disciplines.length > 0) {
          const costPerDiscipline = modelingCost / disciplines.length;
          disciplines.forEach((discipline: string) => {
            const disciplineName = discipline.charAt(0).toUpperCase() + discipline.slice(1);
            items.push({
              item: `${areaName} - ${disciplineName} Modeling`,
              description: `LOD ${lodLevel}`,
              qty: sqft || 1,
              rate: sqft > 0 ? costPerDiscipline / sqft : costPerDiscipline,
              amount: costPerDiscipline,
            });
          });
        } else {
          // Single discipline or unknown
          items.push({
            item: `${areaName} - BIM Modeling`,
            description: `LOD ${lodLevel}`,
            qty: sqft || 1,
            rate: sqft > 0 ? modelingCost / sqft : modelingCost,
            amount: modelingCost,
          });
        }
      }
    });
  }

  // Travel
  if (quote.distance || quote.customTravelCost) {
    const travelAmount = Number(quote.customTravelCost) || (Number(quote.distance) || 0) * 0.75;
    if (travelAmount > 0) {
      items.push({
        item: "Travel",
        description: `${quote.distance || 0} miles from ${quote.dispatchLocation || "Troy, NY"}`,
        qty: Number(quote.distance) || 1,
        rate: quote.distance ? travelAmount / Number(quote.distance) : travelAmount,
        amount: travelAmount,
      });
    }
  }

  // Additional Services
  if (quote.services) {
    const services = quote.services as { matterport?: number; photography?: number;[key: string]: any };

    if (services.matterport && services.matterport > 0) {
      const matterportRate = 500;
      items.push({
        item: "Matterport 3D Tour",
        description: "Virtual walkthrough capture",
        qty: services.matterport,
        rate: matterportRate,
        amount: services.matterport * matterportRate,
      });
    }

    if (services.photography && services.photography > 0) {
      const photoRate = 300;
      items.push({
        item: "Site Photography",
        description: "Professional site documentation",
        qty: services.photography,
        rate: photoRate,
        amount: services.photography * photoRate,
      });
    }

    // Handle other services dynamically
    const knownServices = ["matterport", "photography"];
    Object.entries(services).forEach(([serviceId, quantity]) => {
      if (!knownServices.includes(serviceId) && typeof quantity === "number" && quantity > 0) {
        // Dynamic service handling
        const serviceName = serviceId.replace(/([A-Z])/g, " $1").trim();
        const displayName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
        items.push({
          item: displayName,
          description: "Additional service",
          qty: quantity,
          rate: 0, // Unknown rate for dynamic services
          amount: 0, // Will need to be calculated if we have pricing data
        });
      }
    });
  }

  return items;
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

  const scope = {
    scopeSummary,
    disciplines,
    deliverables,
    lodLevels,
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
