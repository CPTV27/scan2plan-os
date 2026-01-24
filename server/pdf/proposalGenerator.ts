/**
 * Proposal PDF Generator
 *
 * Generates professional 9-page proposal PDFs matching the Scan2Plan format
 */

import PDFDocument from "pdfkit";
import type { Lead, CpqQuote } from "@shared/schema";
import {
  COLORS,
  PAGE,
  formatCurrency,
  formatCurrencyWithCents,
  formatNumber,
  drawLine,
  drawRect,
  renderSectionHeading,
  renderParagraph,
  renderBulletList,
  renderTable,
  renderKeyValue,
  checkPageBreak,
  renderFooter,
  type TableColumn,
  type TableRow,
} from "./helpers";

// Line item interface
export interface LineItem {
  item: string;
  description: string;
  qty: number | string;
  rate: number;
  amount: number;
}

// Proposal data structure
export interface ProposalData {
  coverLine?: string;
  addressLines?: string[];

  // Cover page
  projectTitle: string;
  clientName: string;
  date: string;
  location: string;

  // Project details
  overview: {
    projectName: string;
    address: string;
    buildingType: string;
    sqft: number;
    description: string;
  };

  // Scope
  scope: {
    scopeSummary: string;
    disciplines: string;
    deliverables: string;
    lodLevels: string[];
    disciplineList?: string[];
    hasMatterport?: boolean;
    lodLabel?: string;
    servicesLine?: string;
    scopeItems?: string[];       // Custom scope items from WYSIWYG
    deliverableItems?: string[]; // Custom deliverables from WYSIWYG
    areaScopeLines?: string[];   // Per-area scope lines (e.g., "Area 1: LOD 300 + Architecture")
  };

  // Timeline
  timeline: {
    duration: string;
    milestones: string[];
  };

  // Estimate
  lineItems: LineItem[];
  subtotal: number;
  total: number;

  // Payment
  paymentTerms: {
    structure: string;
    upfrontAmount: number;
    totalAmount: number;
    methods: string[];
    terms: string;
  };
}

/**
 * Generate proposal PDF
 */
export async function generateProposalPDF(
  data: ProposalData,
  customSections?: any[]
): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: {
      top: PAGE.margin.top,
      bottom: PAGE.margin.bottom,
      left: (PAGE.margin.left as number),
      right: PAGE.margin.right,
    },
    info: {
      Title: `Scan2Plan Proposal - ${data.projectTitle}`,
      Author: "Scan2Plan",
      Subject: "Professional 3D Scanning & BIM Services Proposal",
    },
  });

  // Render pages
  // Helper to extract content by section name
  const getContent = (name: string): string | undefined => {
    if (!customSections) return undefined;
    const section = customSections.find(s => s.name === name && s.included);
    return section ? section.content : undefined;
  };

  // Render pages
  renderCoverPage(doc, data);
  renderAboutPage(
    doc,
    data,
    getContent("About Scan2Plan"),
    getContent("Why Scan2Plan?")
  );
  renderProjectPage(doc, data);
  renderEstimatePage(doc, data, getContent("Estimate Notes"));
  renderPaymentTermsPage(
    doc,
    data,
    getContent("Square Footage Audit"),
    getContent("Terms & Conditions")
  );
  renderCapabilitiesPage(doc, data, getContent("Scan2Plan Capabilities"));
  renderDifferencePage(doc, data, getContent("The Scan2Plan Difference"));
  renderBIMStandardsPage(doc, data, getContent("BIM Modeling Standards"));

  // NOTE: Caller is responsible for calling doc.pipe() and doc.end()
  // to allow for proper streaming to HTTP responses

  return doc;
}

function getAddressLines(data: ProposalData): string[] {
  if (data.addressLines && data.addressLines.length) return data.addressLines;

  const address = data.overview?.address || data.location || "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const line1 = parts.shift() || "";
    const line2 = parts.join(", ").replace(/\s+/g, " ").trim();
    return [line1, line2].filter(Boolean);
  }

  if (address) return [address];

  return data.projectTitle ? [data.projectTitle] : [];
}

function normalizeDisciplinesFromString(value: string): string[] {
  return value
    .split(/[,;+]/)
    .map((item) => item.replace(/lod\s*\d+/gi, "").trim())
    .filter(Boolean)
    .map((item) => {
      const lower = item.toLowerCase();
      if (lower.includes("mep")) return "MEPF";
      if (lower.includes("struct")) return "Structure";
      if (lower.includes("landscape")) return "Landscape";
      if (lower.includes("grade") || lower.includes("site") || lower.includes("civil")) return "Grade";
      if (lower.includes("arch")) return "Architecture";
      return item.charAt(0).toUpperCase() + item.slice(1);
    });
}

function buildServicesLine(data: ProposalData): string {
  if (data.coverLine) return data.coverLine;
  if (data.scope.servicesLine) return data.scope.servicesLine;

  const disciplines = data.scope.disciplineList?.length
    ? data.scope.disciplineList
    : data.scope.disciplines
      ? normalizeDisciplinesFromString(data.scope.disciplines)
      : [];

  const lodLabel =
    data.scope.lodLabel ||
    (data.scope.lodLevels?.length ? `LoD ${data.scope.lodLevels[0]}` : "");

  const parts: string[] = [];
  if (lodLabel) parts.push(lodLabel);
  if (disciplines.length) parts.push(disciplines.join(" + "));
  if (data.scope.hasMatterport) parts.push("Matterport");
  return parts.filter(Boolean).join(" + ");
}

/**
 * Page 1: Cover Page
 */
function renderCoverPage(doc: PDFKit.PDFDocument, data: ProposalData): void {
  // Logo - centered at top
  const logoY = 60;
  try {
    // Logo image
    doc.image("client/public/logo-cover.png", (PAGE.width as number) / 2 - 100, logoY, { width: 200 });
  } catch (error) {
    // Fallback text if logo not found
    doc
      .font("Helvetica-Bold")
      .fontSize(36)
      .fillColor(COLORS.primary)
      .text("Scan2Plan", (PAGE.margin.left as number), logoY, {
        width: PAGE.contentWidth,
        align: "center",
      });
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(COLORS.primary)
      .text("Focus on Design", (PAGE.margin.left as number), logoY + 40, {
        width: PAGE.contentWidth,
        align: "center",
      });
  }

  // Company contact info below logo
  let y = 200;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.textMuted)
    .text("188 1st St, Troy, NY 12180", (PAGE.margin.left as number), y, {
      width: PAGE.contentWidth,
      align: "center",
    });
  y += 14;
  doc
    .text("(518) 362-2403 / admin@scan2plan.io", (PAGE.margin.left as number), y, {
      width: PAGE.contentWidth,
      align: "center",
    });
  y += 14;
  doc
    .fillColor(COLORS.primary)
    .text("www.scan2plan.io", (PAGE.margin.left as number), y, {
      width: PAGE.contentWidth,
      align: "center",
    });

  // Title section
  y = 320;

  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor(COLORS.text)
    .text("- PROPOSAL -", (PAGE.margin.left as number), y, {
      width: PAGE.contentWidth,
      align: "center",
    });

  y += 50;

  doc
    .font("Helvetica")
    .fontSize(20)
    .fillColor(COLORS.text)
    .text("Laser Scanning & Building Documentation", (PAGE.margin.left as number), y, {
      width: PAGE.contentWidth,
      align: "center",
    });

  y += 40;

  // Address lines with scope note
  const addressLines = getAddressLines(data);

  // Check if partial scope - add note to first address line
  const isPartialScope = data.scope?.scopeSummary?.toLowerCase().includes("partial") ||
                         data.overview?.description?.toLowerCase().includes("partial");

  if (addressLines.length) {
    // First line: street address (with partial building note if applicable)
    let line1 = addressLines[0];
    if (isPartialScope && !line1.toLowerCase().includes("partial")) {
      line1 = `${line1} (partial building)`;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(COLORS.text)
      .text(line1, (PAGE.margin.left as number), y, {
        width: PAGE.contentWidth,
        align: "center",
      });
    y += 28;

    // Second line: city, state, zip
    if (addressLines.length > 1) {
      doc
        .font("Helvetica")
        .fontSize(16)
        .fillColor(COLORS.text)
        .text(addressLines[1], (PAGE.margin.left as number), y, {
          width: PAGE.contentWidth,
          align: "center",
        });
      y += 28;
    }
  }

  // LoD + disciplines line(s)
  // If we have multiple areas, show each area's scope
  if (data.scope.areaScopeLines && data.scope.areaScopeLines.length > 1) {
    data.scope.areaScopeLines.forEach((line: string) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(COLORS.text)
        .text(line, (PAGE.margin.left as number), y, {
          width: PAGE.contentWidth,
          align: "center",
        });
      y += 22;
    });
    y += 10;
  } else {
    // Single area or fallback to services line
    const servicesLine = buildServicesLine(data);
    if (servicesLine) {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(COLORS.text)
        .text(servicesLine, (PAGE.margin.left as number), y, {
          width: PAGE.contentWidth,
          align: "center",
        });
      y += 40;
    }
  }

  // Acceptance note - smaller and lower
  y = Math.max(y + 20, 560);
  const acceptance = `Scan2Plan, Inc. hereby proposes the following engagement to ${data.clientName || "our client"}. Use of the services offered by Scan2Plan constitutes acceptance of this proposal dated ${data.date}.`;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.textMuted)
    .text(acceptance, (PAGE.margin.left as number) + 40, y, {
      width: PAGE.contentWidth - 80,
      align: "center",
    });

  // New page for content
  doc.addPage();
}

/**
 * Page 2: About Scan2Plan + Why Scan2Plan
 * Matches ProposalAboutPage.tsx exactly
 */
function renderAboutPage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customAbout?: string,
  customWhy?: string
): void {
  let y: number = PAGE.margin.top;

  // Helper to strip markdown headers (e.g. ## Title)
  const cleanText = (text: string) => text.replace(/^#+\s+.*$/gm, "").trim();

  // About Scan2Plan - larger heading to match WYSIWYG
  y = renderSectionHeading(doc, "About Scan2Plan®", y, { fontSize: 20, marginBottom: 15, color: COLORS.primary });

  if (customAbout) {
    y = renderParagraph(doc, cleanText(customAbout), y, { lineGap: 6 });
  } else {
    // Paragraph 1
    y = renderParagraph(
      doc,
      "We began in 2018 with a simple goal of helping firms focus on design.",
      y,
      { fontSize: 11, lineGap: 6 }
    );

    // Paragraph 2
    y = renderParagraph(
      doc,
      "We're an on-demand LiDAR to BIM/CAD team that can model any building in weeks. This can be done within any scope, budget or schedule. We've scanned over 1,000 buildings (~10M sqft).",
      y,
      { fontSize: 11, lineGap: 6 }
    );

    // Paragraph 3
    y = renderParagraph(
      doc,
      "We use LiDAR scanners for 3D mapping with extreme accuracy. We deliver professionally drafted 3D BIM and 2D CAD for comprehensive existing conditions documentation. Our Point Cloud datasets serve as a verifiable single-source-of-truth for coordination and risk-mitigation across projects.",
      y,
      { fontSize: 11, lineGap: 6 }
    );
  }

  // Point cloud image placeholder
  y += 10;
  try {
    doc.image("client/public/point-cloud-building.jpg", PAGE.margin.left + 50, y, {
      width: PAGE.contentWidth - 100,
      height: 150,
      fit: [PAGE.contentWidth - 100, 150],
      align: "center",
    });
    y += 160;
  } catch (error) {
    // If image not found, add some space
    y += 20;
  }

  // Why Scan2Plan? - larger heading to match WYSIWYG
  y = renderSectionHeading(doc, "Why Scan2Plan?", y, { fontSize: 20, marginBottom: 15, color: COLORS.primary });

  if (customWhy) {
    y = renderParagraph(doc, cleanText(customWhy), y, { lineGap: 6 });
  } else {
    // Two-column bullet list matching WYSIWYG
    const whyItemsLeft = [
      "Experienced, dedicated team of field techs, drafters (AutoCAD and Revit) and licensed engineers.",
      "We take the time to scope each project to suit your priorities.",
      "We use the finest precision tools to capture a point cloud with extreme accuracy.",
      "Drafted to Scan2Plan's rigorous design standards - your design phase begins upon delivery.",
    ];

    const whyItemsRight = [
      "We take a process driven approach with extensive quality control and team review.",
      "Exceptional support from real professionals.",
      "Scan2Plan has national and international coverage.",
      "We work on a wide range of projects from single family homes to large-scale commercial, industrial and infrastructure.",
    ];

    // Render left column
    const leftX = PAGE.margin.left;
    const rightX = PAGE.margin.left + PAGE.contentWidth / 2 + 10;
    const colWidth = PAGE.contentWidth / 2 - 15;
    let leftY = y;
    let rightY = y;

    doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);

    whyItemsLeft.forEach((item) => {
      doc.text("•", leftX + 10, leftY);
      doc.text(item, leftX + 25, leftY, { width: colWidth - 25 });
      const itemHeight = doc.heightOfString(item, { width: colWidth - 25 });
      leftY += itemHeight + 8;
    });

    whyItemsRight.forEach((item) => {
      doc.text("•", rightX + 10, rightY);
      doc.text(item, rightX + 25, rightY, { width: colWidth - 25 });
      const itemHeight = doc.heightOfString(item, { width: colWidth - 25 });
      rightY += itemHeight + 8;
    });

    y = Math.max(leftY, rightY) + 10;
  }

  // Footer
  renderFooter(doc, "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io", 2);

  doc.addPage();
}

/**
 * Page 3: The Project
 */
function renderProjectPage(doc: PDFKit.PDFDocument, data: ProposalData): void {
  let y: number = PAGE.margin.top;

  // Title
  y = renderSectionHeading(doc, "The Project", y, { fontSize: 18, marginBottom: 20 });

  // Overview
  y = renderSectionHeading(doc, "Overview", y, { fontSize: 14, marginBottom: 12 });

  const overviewText =
    `${data.clientName} has engaged Scan2Plan to provide professional 3D laser scanning and BIM modeling services ` +
    `for ${data.overview.projectName}, located at ${data.overview.address}. ` +
    `The project encompasses ${formatNumber(data.overview.sqft)} square feet of ${data.overview.buildingType} space.`;

  y = renderParagraph(doc, overviewText, y, { lineGap: 6 });

  if (data.overview.description) {
    y = renderParagraph(doc, data.overview.description, y, { lineGap: 6 });
  }

  y += 15;

  // Scope of Work
  y = renderSectionHeading(doc, "Scope of Work", y, { fontSize: 14, marginBottom: 12 });

  // Use custom scope items from WYSIWYG if provided, otherwise use defaults
  let scopeItems: string[];
  if (data.scope.scopeItems && data.scope.scopeItems.length > 0) {
    scopeItems = data.scope.scopeItems;
  } else {
    scopeItems = [
      "End-to-end project management and customer service",
      "LiDAR Scan - A scanning technician will capture the building areas.",
      "Registration - Point cloud data captured on-site will be registered, cleaned, and reviewed for quality assurance.",
      "BIM Modeling - Revit model authored to the specified level of detail.",
      "QA/QC - The entire project is redundantly reviewed and checked by our QC team and senior engineering staff.",
    ];

    if (data.scope.hasMatterport) {
      scopeItems.splice(
        2,
        0,
        "Matterport Scan - A scanning technician will capture the interior of the residence."
      );
    }
  }

  y = renderBulletList(doc, scopeItems, y, { fontSize: 10, lineGap: 4 });

  y += 15;

  // Deliverables section
  y = renderSectionHeading(doc, "Deliverables", y, { fontSize: 14, marginBottom: 12 });

  // Use custom deliverables from WYSIWYG if provided, otherwise build defaults
  let deliverableItems: string[];
  if (data.scope.deliverableItems && data.scope.deliverableItems.length > 0) {
    deliverableItems = data.scope.deliverableItems;
  } else {
    const disciplineLine =
      (data.scope.disciplineList && data.scope.disciplineList.length)
        ? data.scope.disciplineList.join(" + ")
        : data.scope.disciplines
          ? normalizeDisciplinesFromString(data.scope.disciplines).join(" + ")
          : "";
    const lodLabel =
      data.scope.lodLabel ||
      (data.scope.lodLevels.length ? `LoD ${data.scope.lodLevels[0]}` : "LoD 300");
    const modelLabel = data.scope.deliverables || "Revit";

    deliverableItems = [
      "Total Square Footage Audit",
      `${modelLabel} Model - ${lodLabel}${disciplineLine ? ` + ${disciplineLine}` : ""}`,
    ];

    if (data.scope.hasMatterport) {
      deliverableItems.push("Matterport 3D Tour");
    }

    deliverableItems.push(
      "Colorized Point Cloud including 360 images viewable in Autodesk Recap or Trimble ScanExplorer"
    );
  }

  y = renderBulletList(doc, deliverableItems, y);

  y += 10;

  // Timeline
  y = renderSectionHeading(doc, "Timeline", y, { fontSize: 14, marginBottom: 12 });

  y = renderParagraph(
    doc,
    `Estimated project duration: ${data.timeline.duration}`,
    y,
    { fontSize: 10 }
  );

  if (data.timeline.milestones.length > 0) {
    y += 5;
    y = renderBulletList(doc, data.timeline.milestones, y, { fontSize: 10 });
  } else {
    // Default milestones
    const defaultMilestones = [
      "Site scanning: 1-2 days",
      "Point cloud processing: 2-3 days",
      "BIM modeling: 2-3 weeks",
      "Quality review & delivery: 2-3 days",
    ];
    y += 5;
    y = renderBulletList(doc, defaultMilestones, y, { fontSize: 10 });
  }

  // Footer
  renderFooter(doc, "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io", 3);

  doc.addPage();
}

/**
 * Pages 4-5: Estimate
 */
function renderEstimatePage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customNotes?: string
): void {
  let y: number = PAGE.margin.top;

  // Title
  y = renderSectionHeading(doc, "Estimate", y, { fontSize: 18, marginBottom: 20 });

  // Table columns
  const columns: TableColumn[] = [
    { header: "ITEM", key: "item", width: 140, align: "left" },
    { header: "DESCRIPTION", key: "description", width: 160, align: "left" },
    { header: "QTY", key: "qty", width: 60, align: "right" },
    { header: "RATE", key: "rate", width: 80, align: "right" },
    { header: "AMOUNT", key: "amount", width: 80, align: "right" },
  ];

  // Format rows
  const rows: TableRow[] = data.lineItems.map((item) => ({
    item: item.item,
    description: item.description,
    qty: typeof item.qty === "number" ? formatNumber(item.qty) : item.qty,
    rate: formatCurrencyWithCents(item.rate),
    amount: formatCurrency(item.amount),
  }));

  // Render table with light blue header (matches WYSIWYG)
  y = renderTable(doc, columns, rows, y, {
    headerBg: COLORS.primaryLight,
    headerTextColor: COLORS.primary,
    rowAltBg: COLORS.backgroundAlt,
    fontSize: 9,
    headerFontSize: 10,
    rowHeight: 20,
    headerHeight: 24,
  });

  y += 10;

  // Subtotal and Total
  const totalX = (PAGE.margin.left as number) + 360;

  if (data.subtotal && data.subtotal !== data.total) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(COLORS.text)
      .text("Subtotal:", totalX, y);

    doc
      .font("Helvetica-Bold")
      .text(formatCurrency(data.subtotal), totalX + 100, y, { align: "right", width: 80 });

    y += 20;
  }

  // Total
  drawLine(doc, totalX, y - 5, totalX + 180, y - 5, { lineWidth: 1 });

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(COLORS.text)
    .text("TOTAL:", totalX, y + 5);

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(COLORS.primary)
    .text(formatCurrency(data.total), totalX + 100, y + 5, { align: "right", width: 80 });

  y += 40;

  // Notes
  const notesText = customNotes
    ? cleanText(customNotes)
    : "All pricing is valid for 30 days from the date of this proposal. " +
    "Final square footage will be verified during scanning and pricing may be adjusted if actual conditions differ significantly from estimates.";

  y = renderParagraph(
    doc,
    notesText,
    y,
    { fontSize: 9, color: COLORS.textMuted, lineGap: 4 }
  );

  // Footer
  renderFooter(doc, "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io", 4);

  doc.addPage();
}

/**
 * Page 6: Payment Terms
 */
function renderPaymentTermsPage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customSqftAudit?: string,
  customTerms?: string
): void {
  let y: number = PAGE.margin.top;

  // Title
  y = renderSectionHeading(doc, "Payment Terms", y, { fontSize: 18, marginBottom: 20 });

  // Payment structure
  y = renderSectionHeading(doc, "Payment Structure", y, { fontSize: 14, marginBottom: 12 });

  y = renderParagraph(doc, data.paymentTerms.structure, y, { fontSize: 10, lineGap: 6 });

  const paymentDetails = [
    `Upfront payment: ${formatCurrency(data.paymentTerms.upfrontAmount)} (due upon contract signing)`,
    `Final payment: ${formatCurrency(data.paymentTerms.totalAmount - data.paymentTerms.upfrontAmount)} (due upon delivery)`,
  ];

  y = renderBulletList(doc, paymentDetails, y, { fontSize: 10 });

  y += 10;

  // Payment methods
  y = renderSectionHeading(doc, "Accepted Payment Methods", y, { fontSize: 14, marginBottom: 12 });

  y = renderBulletList(doc, data.paymentTerms.methods, y, { fontSize: 10 });

  y += 10;

  // Square footage audit
  y = renderSectionHeading(doc, "Square Footage Audit", y, { fontSize: 14, marginBottom: 12 });

  const sqftText = customSqftAudit
    ? cleanText(customSqftAudit)
    : "Our estimate is based on provided square footage information. During the scanning process, " +
    "we will verify the actual square footage of the project. If the verified square footage differs " +
    "by more than 10% from the estimated amount, pricing will be adjusted accordingly at the agreed-upon rate.";

  y = renderParagraph(doc, sqftText, y, { fontSize: 10, lineGap: 6 });

  y += 15;

  // Terms
  y = renderSectionHeading(doc, "Terms & Conditions", y, { fontSize: 14, marginBottom: 12 });

  if (customTerms) {
    y = renderParagraph(doc, cleanText(customTerms), y, { fontSize: 10, lineGap: 6 });
  } else {
    const termsItems = [
      `Payment terms: ${data.paymentTerms.terms}`,
      "Late payments subject to 1.5% monthly interest charge",
      "Client responsible for site access and safety compliance",
      "Additional site visits or scope changes billed at hourly rates",
      "Models delivered in agreed-upon format with technical support included",
    ];

    y = renderBulletList(doc, termsItems, y, { fontSize: 10 });
  }

  y += 20;

  // Acknowledgement section (matches WYSIWYG)
  y = renderSectionHeading(doc, "Acknowledgement", y, { fontSize: 14, marginBottom: 12 });

  const acknowledgementText = "By signing below, the client acknowledges receipt of this proposal " +
    "and agrees to the terms and conditions set forth herein, including the payment schedule and scope of work. " +
    "This proposal is valid for 30 days from the date issued.";

  y = renderParagraph(doc, acknowledgementText, y, { fontSize: 10, lineGap: 6 });

  y += 15;

  // Signature lines - two rows of two columns
  const sigX = PAGE.margin.left as number;
  const sigWidth = 200;
  const col2X = sigX + sigWidth + 50;

  // Row 1: Client Signature, Date
  drawLine(doc, sigX, y + 12, sigX + sigWidth, y + 12, { color: COLORS.border });
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textMuted).text("Client Signature", sigX, y + 16);

  drawLine(doc, col2X, y + 12, col2X + sigWidth, y + 12, { color: COLORS.border });
  doc.text("Date", col2X, y + 16);

  y += 40;

  // Row 2: Print Name, Title
  drawLine(doc, sigX, y + 12, sigX + sigWidth, y + 12, { color: COLORS.border });
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textMuted).text("Print Name", sigX, y + 16);

  drawLine(doc, col2X, y + 12, col2X + sigWidth, y + 12, { color: COLORS.border });
  doc.text("Title", col2X, y + 16);

  // Footer
  renderFooter(doc, "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io", 5);

  doc.addPage();
}

/**
 * Page 7: Scan2Plan Capabilities
 * Matches ProposalCapabilitiesPage.tsx exactly
 */
// Helper to strip markdown headers (e.g. ## Title)
const cleanText = (text: string) => text.replace(/^#+\s+.*$/gm, "").trim();

/**
 * Page 7: Scan2Plan Capabilities
 */
function renderCapabilitiesPage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customContent?: string
): void {
  let y: number = PAGE.margin.top;

  // Title - larger to match WYSIWYG
  y = renderSectionHeading(doc, "Scan2Plan Capabilities", y, {
    fontSize: 20,
    marginBottom: 10,
    color: COLORS.primary,
  });

  // Target Audience
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.primary)
    .text(
      "Scan2Plan is for: Architects, Structural Engineers, MEP Engineers, Interior Designers, Property Managers, Owner/Operators, Landscape Architects, Civil Engineers.",
      PAGE.margin.left,
      y,
      { width: PAGE.contentWidth }
    );
  y += 30;

  if (customContent) {
    y = renderParagraph(doc, cleanText(customContent), y, { fontSize: 10, lineGap: 6 });
  } else {
    // Two-column layout
    const leftX = PAGE.margin.left;
    const rightX = PAGE.margin.left + PAGE.contentWidth / 2 + 15;
    const colWidth = PAGE.contentWidth / 2 - 20;
    let leftY = y;
    let rightY = y;

    // LEFT COLUMN
    // Scan-to-BIM
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Scan-to-BIM", leftX, leftY);
    leftY += 18;

    const scanToBimItems = [
      "Architectural & Structural Existing Conditions Documentation.",
      "Deliverables:",
      "  • Revit Model",
      "  • Colorized Point Cloud",
      "  • 360 Photo documentation",
      "Standard Options:",
      "  • LoD 200 (Approximate Geometry)",
      "  • LoD 300 (Accurate Geometry)",
      "  • LoD 350 (Precise Geometry)",
      "Level of Accuracy:",
      "  • Point Cloud - 0\" to 1/8\"",
      "  • Model - 0\" to 1/2\"",
      "Turnaround: 2-5 weeks (depending on scope)",
      "Pricing is based on:",
      "  • A) Type of Building/Structure",
      "  • B) LoD Standard",
      "  • C) Square Footage",
    ];

    doc.font("Helvetica").fontSize(9).fillColor(COLORS.text);
    scanToBimItems.forEach((item) => {
      const indent = item.startsWith("  ") ? 15 : 0;
      const text = item.replace(/^  /, "");
      if (!item.startsWith("  ")) {
        doc.text("•", leftX + indent, leftY);
      }
      doc.text(text, leftX + indent + 10, leftY, { width: colWidth - indent - 10 });
      leftY += 12;
    });

    leftY += 10;

    // BIM to CAD Conversion
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("BIM to CAD Conversion", leftX, leftY);
    leftY += 18;
    doc.font("Helvetica").fontSize(9);
    doc.text("•", leftX, leftY);
    doc.text("Pristine CAD drawings converted from Revit Model.", leftX + 10, leftY, { width: colWidth - 10 });
    leftY += 20;

    // RIGHT COLUMN
    // MEPF Modeling
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("MEPF Modeling", rightX, rightY);
    rightY += 18;
    doc.font("Helvetica").fontSize(9);
    doc.text("•", rightX, rightY);
    doc.text("Any exposed Mechanical, Electrical, Plumbing and Fire Safety elements documented in BIM or CAD.", rightX + 10, rightY, { width: colWidth - 10 });
    rightY += 30;

    // Landscape
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Landscape", rightX, rightY);
    rightY += 18;
    doc.font("Helvetica").fontSize(9);
    doc.text("•", rightX, rightY);
    doc.text("Landscape, grounds, and urban spaces documented in BIM or CAD.", rightX + 10, rightY, { width: colWidth - 10 });
    rightY += 15;
    doc.text("•", rightX, rightY);
    doc.text("Georeferencing and forestry optional.", rightX + 10, rightY, { width: colWidth - 10 });
    rightY += 25;

    // Matterport 3D Tour
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Matterport 3D Tour", rightX, rightY);
    rightY += 18;
    doc.font("Helvetica").fontSize(9);
    doc.text("•", rightX, rightY);
    doc.text("High resolution 360 photo documentation and virtual tour walkthrough. An excellent remote collaboration tool, easily shared and viewed on any mobile or desktop device.", rightX + 10, rightY, { width: colWidth - 10 });
    rightY += 40;

    // Paper to BIM or CAD
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Paper to BIM or CAD", rightX, rightY);
    rightY += 18;
    doc.font("Helvetica").fontSize(9);
    doc.text("•", rightX, rightY);
    doc.text("Legacy 2D paper drawings converted to functional BIM or CAD documentation.", rightX + 10, rightY, { width: colWidth - 10 });
    rightY += 25;

    // Model Only / Point Cloud Only
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Model Only / Point Cloud Only", rightX, rightY);
    rightY += 18;
    doc.font("Helvetica").fontSize(9);
    doc.text("•", rightX, rightY);
    doc.text("You work with our point cloud or we'll model from yours.", rightX + 10, rightY, { width: colWidth - 10 });
    rightY += 25;

    y = Math.max(leftY, rightY) + 10;
  }

  // Software Support
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text("We support: ", PAGE.margin.left, y, { continued: true })
    .font("Helvetica-Bold")
    .fillColor(COLORS.primary)
    .text("Revit, AutoCAD, Sketchup, Rhino, Vectorworks, Solidworks, Chief Architect, ArchiCAD, Civil 3D", { continued: true })
    .font("Helvetica")
    .fillColor(COLORS.text)
    .text(", and others....");

  // Footer
  renderFooter(doc, "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io", 6);

  doc.addPage();
}

/**
 * Page 8: The Scan2Plan Difference
 * Matches ProposalDifferencePage.tsx exactly
 */
function renderDifferencePage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customContent?: string
): void {
  let y: number = PAGE.margin.top;

  // Title - larger to match WYSIWYG
  y = renderSectionHeading(doc, "The Scan2Plan Difference", y, {
    fontSize: 20,
    marginBottom: 8,
    color: COLORS.primary,
  });

  // Subtitle
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(COLORS.primary)
    .text("What to look for in a Scan-to-BIM partner.", PAGE.margin.left, y);
  y += 25;

  // Intro paragraph
  const introText = "In the evolving landscape of scanning and modeling, it's important to consider your options to find a service that aligns with your specific needs. Scan2Plan is committed to delivering quality and precision in this field. Here's a closer look at what sets us apart:";
  y = renderParagraph(doc, introText, y, { fontSize: 9, lineGap: 4 });
  y += 5;

  if (customContent) {
    y = renderParagraph(doc, cleanText(customContent), y, { fontSize: 10, lineGap: 6 });
  } else {
    // Two-column layout with 9 difference points (5 left, 4 right)
    const differencePoints = [
      {
        title: "High-Quality Data for Superior Results",
        description: "The accuracy of your models and drawings hinges on the quality of the underlying data. We capture all our point cloud data sets in full color, with significant overlap and redundancy. This meticulous approach maximizes point cloud density, leading to more accurate and detailed models.",
      },
      {
        title: "Precision with Terrestrial LiDAR",
        description: "Different technologies like Drones, SLAM scanners, Solid State LiDAR, or Photogrammetry offer varied results. We have chosen high-end terrestrial LiDAR for its unparalleled accuracy. Using the Trimble X7 scanner for every project, we guarantee consistent millimeter accuracy. Our process includes thorough validation of the Point Cloud, ensuring precision from 0\" to 1/8\".",
      },
      {
        title: "Setting High Standards in BIM & CAD",
        description: "Transparency in BIM & CAD standards is vital. Providers may offer different levels of detail (LoD) standards. We offer the highest standard of Levels of Development (LoD) 200, 300, and 350, for schematic and construction-ready documentation. Our Mechanical, Electrical, Plumbing, and Fire (MEPF) documentation consistently meets the highest standards.",
      },
      {
        title: "The Human Touch in Modeling and Drafting",
        description: "In an era where AI is prevalent, we take pride in our 100% manual approach to modeling and drafting. Our expert team meticulously translates data into detailed models and drawings, ensuring that every element is captured accurately.",
      },
      {
        title: "Rigorous Quality Control for Trusted Accuracy",
        description: "Earning your trust means delivering impeccably accurate documents. Our dedicated Quality Control team conducts multiple checks on every deliverable, ensuring they meet our high standards. This thorough process is our commitment to saving you time and resources in the long run.",
      },
      {
        title: "Customized to Your Standards",
        description: "We adapt to your specific needs from the start. Whether it's integrating your Revit Templates or CAD Standards, we ensure a seamless transition from our delivery to your design phase.",
      },
      {
        title: "Dedicated Support & Revisions",
        description: "Our commitment to your satisfaction extends beyond delivery. We offer comprehensive support, including demonstrations on using Point Cloud in Revit or AutoCAD, and we're always ready to make revisions until you're completely satisfied.",
      },
      {
        title: "A Small, Specialized Team",
        description: "Our small, dedicated team ensures consistent quality and personalized service. We focus on building strong client relationships, ensuring familiarity and consistency across projects.",
      },
      {
        title: "Ready When You Are",
        description: "The best ability is availability. Our scanning techs are typically available to be on-site within a week of a signed contract, offering flexible and responsive service across the Northeast and the Nation.",
      },
    ];

    const leftColumn = differencePoints.slice(0, 5);
    const rightColumn = differencePoints.slice(5);

    const leftX = PAGE.margin.left;
    const rightX = PAGE.margin.left + PAGE.contentWidth / 2 + 15;
    const colWidth = PAGE.contentWidth / 2 - 20;
    let leftY = y;
    let rightY = y;

    // Render left column
    leftColumn.forEach((point) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(`• ${point.title}`, leftX, leftY, { width: colWidth });
      const titleHeight = doc.heightOfString(`• ${point.title}`, { width: colWidth });
      leftY += titleHeight + 2;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.textLight)
        .text(point.description, leftX + 10, leftY, { width: colWidth - 10 });
      const descHeight = doc.heightOfString(point.description, { width: colWidth - 10 });
      leftY += descHeight + 10;
    });

    // Render right column
    rightColumn.forEach((point) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(`• ${point.title}`, rightX, rightY, { width: colWidth });
      const titleHeight = doc.heightOfString(`• ${point.title}`, { width: colWidth });
      rightY += titleHeight + 2;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.textLight)
        .text(point.description, rightX + 10, rightY, { width: colWidth - 10 });
      const descHeight = doc.heightOfString(point.description, { width: colWidth - 10 });
      rightY += descHeight + 10;
    });

    y = Math.max(leftY, rightY);
  }

  // Footer
  renderFooter(doc, "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io", 7);

  doc.addPage();
}

/**
 * Pages 9-11: BIM Modeling Standards
 * Renders 3 full-page images matching ProposalBIMStandards.tsx
 */
function renderBIMStandardsPage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customContent?: string
): void {
  const MODELLING_STANDARDS_IMAGES = [
    "client/public/2024-modelling-standards-1.jpg",
    "client/public/2024-modelling-standards-2.jpg",
    "client/public/2024-modelling-standards-3.jpg",
  ];

  // Render each image as a full page
  MODELLING_STANDARDS_IMAGES.forEach((imagePath, index) => {
    try {
      // Full page image with minimal margins
      doc.image(imagePath, 0, 0, {
        width: PAGE.width,
        height: PAGE.height,
        fit: [PAGE.width, PAGE.height],
        align: "center",
        valign: "center",
      });
    } catch (error) {
      // Fallback if image not found - show placeholder text
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(COLORS.primary)
        .text(`BIM Modeling Standards - Page ${index + 1}`, PAGE.margin.left, PAGE.height / 2, {
          width: PAGE.contentWidth,
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.textMuted)
        .text(
          `Image not found: ${imagePath}`,
          PAGE.margin.left,
          PAGE.height / 2 + 30,
          {
            width: PAGE.contentWidth,
            align: "center",
          }
        );
    }

    // Add new page for next image (except for the last one)
    if (index < MODELLING_STANDARDS_IMAGES.length - 1) {
      doc.addPage();
    }
  });

}
