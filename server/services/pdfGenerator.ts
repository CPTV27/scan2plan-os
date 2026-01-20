/**
 * PDF Generator Service
 * Generates proposal PDFs with signature anchors for PandaDoc
 */

import { jsPDF } from "jspdf";
import { log } from "../lib/logger";
import type { Lead, CpqQuote, CaseStudy } from "@shared/schema";
import { MARKETING_COPY, PAYMENT_TERMS, getScopeDescription } from "@shared/proposalContent";

interface ProposalData {
  lead: Lead;
  quote: CpqQuote | null;
  caseStudies: CaseStudy[];
}

// Payment terms display mapping
const PAYMENT_TERMS_DISPLAY: Record<string, string> = {
  partner: "Partner Terms (no hold)",
  owner: "Owner Terms (hold if delay)",
  "50/50": "50% Deposit / 50% on Completion",
  net15: "Net 15",
  net30: "Net 30",
  net45: "Net 45",
  net60: "Net 60",
  net90: "Net 90",
  standard: "Due on Receipt",
  dueOnReceipt: "Due on Receipt",
  prepaid: "Prepaid (5% Discount)",
};

// Discipline display names
const DISCIPLINE_NAMES: Record<string, string> = {
  architecture: "Architecture",
  arch: "Architecture",
  structural: "Structural",
  struct: "Structural",
  mep: "MEP",
  mepf: "MEP",
  site: "Site/Civil",
  civil: "Site/Civil",
};

function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPaymentTerms(paymentTerms: string | null | undefined): string {
  if (!paymentTerms) return PAYMENT_TERMS_DISPLAY.standard;
  return PAYMENT_TERMS_DISPLAY[paymentTerms] || paymentTerms;
}

interface LODInfo {
  display: string;  // Single line display
  perDiscipline: { discipline: string; lod: string }[];  // Detailed breakdown
  hasMultiple: boolean;  // Whether disciplines have different LODs
}

function deriveLODInfo(lead: Lead, quote: CpqQuote | null): LODInfo {
  const perDiscipline: { discipline: string; lod: string }[] = [];
  const disciplineLodMap = new Map<string, Set<string>>();
  
  // Helper to process areas and aggregate LODs
  const processAreas = (areas: any[]) => {
    for (const area of areas) {
      if (area.disciplineLods) {
        for (const [discipline, lodData] of Object.entries(area.disciplineLods)) {
          const lodValue = typeof lodData === 'object' && lodData !== null 
            ? (lodData as any).lod 
            : String(lodData);
          if (!disciplineLodMap.has(discipline)) {
            disciplineLodMap.set(discipline, new Set());
          }
          disciplineLodMap.get(discipline)!.add(lodValue);
        }
      }
    }
  };
  
  // Try cpqAreas first (primary schema field)
  if (quote) {
    const cpqAreas = (quote as any).cpqAreas as any[] | undefined;
    if (cpqAreas && cpqAreas.length > 0) {
      processAreas(cpqAreas);
    }
    // Also try areas field as fallback (some quotes use this)
    const areas = (quote as any).areas as any[] | undefined;
    if (areas && areas.length > 0 && disciplineLodMap.size === 0) {
      processAreas(areas);
    }
  }
  
  // Convert map to array with display names
  disciplineLodMap.forEach((lods, discipline) => {
    const lodArray = Array.from(lods);
    const highestLod = Math.max(...lodArray.map((l: string) => parseInt(l) || 300));
    const displayName = DISCIPLINE_NAMES[discipline.toLowerCase()] || discipline;
    perDiscipline.push({ discipline: displayName, lod: String(highestLod) });
  });
  
  // Fallback to lead disciplines
  if (perDiscipline.length === 0 && lead.disciplines && lead.disciplines.includes("LoD")) {
    const match = lead.disciplines.match(/LoD\s*(\d+)/i);
    if (match) {
      return {
        display: `LOD ${match[1]}`,
        perDiscipline: [],
        hasMultiple: false,
      };
    }
  }
  
  // Default fallback
  if (perDiscipline.length === 0) {
    return {
      display: "LOD 300",
      perDiscipline: [],
      hasMultiple: false,
    };
  }
  
  // Check if all LODs are the same
  const uniqueLods = new Set(perDiscipline.map(d => d.lod));
  const hasMultiple = uniqueLods.size > 1;
  
  if (hasMultiple) {
    // Format as "Arch: 350, MEP: 300, Structural: 300"
    const display = perDiscipline.map(d => `${d.discipline}: ${d.lod}`).join(", ");
    return { display, perDiscipline, hasMultiple };
  } else {
    // All same, just show highest
    const highestLod = Math.max(...perDiscipline.map(d => parseInt(d.lod) || 300));
    return {
      display: `LOD ${highestLod}`,
      perDiscipline,
      hasMultiple: false,
    };
  }
}

// Legacy function for backward compatibility
function deriveLOD(lead: Lead, quote: CpqQuote | null): string {
  return deriveLODInfo(lead, quote).display;
}

interface ServiceInfo {
  matterport: boolean;
  actScan: boolean;
  additionalElevations: number;
}

function deriveServices(quote: CpqQuote | null): ServiceInfo {
  const defaultServices: ServiceInfo = {
    matterport: false,
    actScan: false,
    additionalElevations: 0,
  };
  
  if (!quote?.services) return defaultServices;
  
  const services = quote.services as any;
  return {
    matterport: Boolean(services.matterport),
    actScan: Boolean(services.actScan),
    additionalElevations: Number(services.additionalElevations) || 0,
  };
}

function deriveScope(lead: Lead): string {
  return lead.scope || "Full Building";
}

interface AreaWithBoundary {
  name: string;
  acres: number;
  boundaryImageUrl?: string;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;
    
    // Parse the internal API URL and construct direct Google URL
    const urlObj = new URL(url, "http://localhost");
    const center = urlObj.searchParams.get("center");
    const zoom = urlObj.searchParams.get("zoom");
    const size = urlObj.searchParams.get("size");
    const maptype = urlObj.searchParams.get("maptype");
    const path = urlObj.searchParams.get("path");
    
    if (!center || !zoom || !size) return null;
    
    let googleUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(center)}&zoom=${zoom}&size=${encodeURIComponent(size)}&maptype=${maptype || "satellite"}&key=${apiKey}`;
    if (path) {
      googleUrl += `&path=${encodeURIComponent(path)}`;
    }
    
    const response = await fetch(googleUrl);
    if (!response.ok) return null;
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    log(`ERROR: Failed to fetch boundary image - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const { lead, quote, caseStudies } = data;
  const doc = new jsPDF();
  
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  const lodInfo = deriveLODInfo(lead, quote);
  const scope = deriveScope(lead);
  const services = deriveServices(quote);
  const paymentTermsDisplay = formatPaymentTerms(quote?.paymentTerms as string | undefined);
  
  const addNewPageIfNeeded = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  const addSection = (title: string, spacing: number = 10) => {
    addNewPageIfNeeded(40);
    yPos += spacing;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, yPos);
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const addParagraph = (text: string, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      addNewPageIfNeeded();
      doc.text(line, margin, yPos);
      yPos += 5;
    }
    yPos += 3;
  };

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(MARKETING_COPY.companyName, pageWidth / 2, yPos, { align: "center" });
  yPos += 8;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(MARKETING_COPY.tagline, pageWidth / 2, yPos, { align: "center" });
  yPos += 20;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Proposal for: ${lead.clientName}`, margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const details = [
    ["Project Address:", lead.projectAddress || "Not specified"],
    ["Building Type:", lead.buildingType || "Not specified"],
    ["Scope:", scope],
  ];
  
  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 40, yPos);
    yPos += 6;
  }
  
  // Display LOD - show per-discipline if they differ
  doc.setFont("helvetica", "bold");
  doc.text("LOD:", margin, yPos);
  doc.setFont("helvetica", "normal");
  if (lodInfo.hasMultiple && lodInfo.perDiscipline.length > 0) {
    // Multi-line LOD display for different disciplines
    yPos += 6;
    for (const disc of lodInfo.perDiscipline) {
      doc.text(`  ${disc.discipline}: LOD ${disc.lod}`, margin + 5, yPos);
      yPos += 5;
    }
  } else {
    doc.text(lodInfo.display, margin + 40, yPos);
    yPos += 6;
  }
  yPos += 10;

  addSection("About Scan2Plan");
  addParagraph(MARKETING_COPY.aboutUs);
  yPos += 5;

  for (const item of MARKETING_COPY.theDifference) {
    addNewPageIfNeeded(20);
    doc.setFont("helvetica", "bold");
    doc.text(`- ${item.title}`, margin, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    const bodyLines = doc.splitTextToSize(item.body, contentWidth - 10);
    for (const line of bodyLines) {
      doc.text(line, margin + 5, yPos);
      yPos += 5;
    }
    yPos += 3;
  }

  addSection("Scope of Work", 15);
  const scopeText = getScopeDescription(scope, lodInfo.display);
  addParagraph(scopeText);

  // Add "What's Included" section for services
  const includedItems: string[] = [
    "Laser scanning with Trimble X7 (millimeter accuracy)",
    "Registered point cloud deliverable (E57 + RCP formats)",
  ];
  
  if (services.matterport) {
    includedItems.push("Matterport 3D virtual tour capture");
  }
  if (services.actScan) {
    includedItems.push("Above Ceiling Tile (ACT) scanning");
  }
  if (services.additionalElevations > 0) {
    includedItems.push(`${services.additionalElevations} additional CAD interior elevations`);
  }
  
  // Always add standard items
  includedItems.push("QA/QC review by dedicated team");
  includedItems.push("Project coordination & handoff");
  
  addSection("What's Included", 15);
  for (const item of includedItems) {
    addNewPageIfNeeded();
    doc.text(`• ${item}`, margin, yPos);
    yPos += 6;
  }
  yPos += 5;

  // Add Site Boundary Maps section if quote has landscape areas with boundaries
  if (quote) {
    const quoteAreas = ((quote as any).cpqAreas || (quote as any).areas) as any[] | undefined;
    const landscapeAreas: AreaWithBoundary[] = (quoteAreas || [])
      .filter((a: any) => a.kind === "landscape" && a.boundaryImageUrl && a.boundary?.length >= 3)
      .map((a: any) => ({
        name: a.name || "Landscape Area",
        acres: parseFloat(a.squareFeet) || 0,
        boundaryImageUrl: a.boundaryImageUrl,
      }));

    if (landscapeAreas.length > 0) {
      addSection("Site Boundary Maps", 15);
      addParagraph("The following satellite imagery shows the defined scan boundaries for landscape areas:");
      
      for (const area of landscapeAreas) {
        addNewPageIfNeeded(100);
        
        doc.setFont("helvetica", "bold");
        doc.text(`${area.name} (${area.acres.toFixed(2)} acres)`, margin, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
        
        if (area.boundaryImageUrl) {
          try {
            const imageData = await fetchImageAsBase64(area.boundaryImageUrl);
            if (imageData) {
              const imgWidth = 80;
              const imgHeight = 80;
              doc.addImage(imageData, "PNG", margin, yPos, imgWidth, imgHeight);
              yPos += imgHeight + 10;
            }
          } catch (error) {
            log(`ERROR: Failed to add boundary image - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }
  }

  if (quote) {
    addSection("Pricing", 15);
    
    // Extract pricing breakdown from JSONB field
    const pricingBreakdown = quote.pricingBreakdown as { scanningTotal?: number; bimTotal?: number; travelTotal?: number; addOnsTotal?: number } | null;
    const scanningTotal = Number(pricingBreakdown?.scanningTotal) || 0;
    const bimTotal = Number(pricingBreakdown?.bimTotal) || 0;
    const travelTotal = Number(pricingBreakdown?.travelTotal) || 0;
    const addOnsTotal = Number(pricingBreakdown?.addOnsTotal) || 0;
    const totalPrice = Number(quote.totalPrice) || (scanningTotal + bimTotal + travelTotal + addOnsTotal);
    
    const pricingItems: [string, string][] = [];
    
    if (scanningTotal > 0) {
      pricingItems.push(["Laser Scanning Services", formatCurrency(scanningTotal)]);
    }
    if (bimTotal > 0) {
      pricingItems.push(["BIM Modeling Services", formatCurrency(bimTotal)]);
    }
    if (travelTotal > 0) {
      pricingItems.push(["Travel & Logistics", formatCurrency(travelTotal)]);
    }
    if (addOnsTotal > 0) {
      pricingItems.push(["Additional Services", formatCurrency(addOnsTotal)]);
    }
    
    if (pricingItems.length === 0 && totalPrice > 0) {
      pricingItems.push(["Professional Services", formatCurrency(totalPrice)]);
    }
    
    pricingItems.push(["TOTAL", formatCurrency(totalPrice)]);

    const colWidth = contentWidth / 2;
    
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 4, contentWidth, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Service", margin + 2, yPos);
    doc.text("Amount", margin + colWidth + 2, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    for (let i = 0; i < pricingItems.length; i++) {
      const [service, amount] = pricingItems[i];
      addNewPageIfNeeded();
      
      if (i === pricingItems.length - 1) {
        doc.setFillColor(230, 245, 255);
        doc.rect(margin, yPos - 4, contentWidth, 8, "F");
        doc.setFont("helvetica", "bold");
      }
      
      doc.text(service, margin + 2, yPos);
      doc.text(amount, pageWidth - margin - 2, yPos, { align: "right" });
      yPos += 8;
    }
    doc.setFont("helvetica", "normal");
    yPos += 5;
  }

  if (caseStudies.length > 0) {
    addSection("Similar Projects", 15);
    
    for (const study of caseStudies) {
      addNewPageIfNeeded(30);
      doc.setFont("helvetica", "bold");
      doc.text(study.title, margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");
      
      const blurbLines = doc.splitTextToSize(study.blurb, contentWidth);
      for (const line of blurbLines) {
        addNewPageIfNeeded();
        doc.text(line, margin, yPos);
        yPos += 5;
      }
      
      if (study.stats) {
        const statsObj = study.stats as Record<string, unknown>;
        const statsText = Object.entries(statsObj).map(([k, v]) => `${k}: ${String(v)}`).join(" | ");
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(statsText, margin, yPos);
        doc.setTextColor(0);
        doc.setFontSize(10);
        yPos += 8;
      }
      yPos += 5;
    }
  }

  addSection("Terms & Conditions", 15);
  addParagraph(`Payment Terms: ${paymentTermsDisplay}`);
  addParagraph(`Deposit: ${PAYMENT_TERMS.deposit}`);
  addParagraph(`Final Payment: ${PAYMENT_TERMS.final}`);
  addParagraph(`Payment Methods: ${PAYMENT_TERMS.methods.join(", ")}`);
  addParagraph(PAYMENT_TERMS.validity);
  addParagraph(PAYMENT_TERMS.warranty);
  
  addNewPageIfNeeded(60);
  yPos += 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("[sig|req|signer1]", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;
  doc.text("Client Signature", pageWidth / 2, yPos, { align: "center" });

  const pdfOutput = doc.output("arraybuffer");
  return Buffer.from(pdfOutput);
}

export function generateProposalFilename(lead: Lead): string {
  const clientSlug = (lead.clientName || "Client")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 30);
  const date = new Date().toISOString().split("T")[0];
  return `Scan2Plan_Proposal_${clientSlug}_${date}.pdf`;
}
