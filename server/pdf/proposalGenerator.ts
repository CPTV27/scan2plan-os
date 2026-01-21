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
  const logoY = 90;
  try {
    // Logo image
    doc.image("client/public/logo-cover.png", (PAGE.width as number) / 2 - 160, logoY, { width: 320 });
  } catch (error) {
    // Fallback text if logo not found
    doc
      .font("Helvetica-Bold")
      .fontSize(48)
      .fillColor(COLORS.primary)
      .text("SCAN2PLAN", (PAGE.margin.left as number), logoY, {
        width: PAGE.contentWidth,
        align: "center",
      });
  }

  // Title section
  let y = 360;

  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor(COLORS.text)
    .text("- PROPOSAL -", (PAGE.margin.left as number), y, {
      width: PAGE.contentWidth,
      align: "center",
    });

  y += 44;

  doc
    .font("Helvetica")
    .fontSize(20)
    .fillColor(COLORS.text)
    .text("Laser Scanning & Building Documentation", (PAGE.margin.left as number), y, {
      width: PAGE.contentWidth,
      align: "center",
    });

  y += 38;

  const addressLines = getAddressLines(data);
  if (addressLines.length) {
    addressLines.forEach((line) => {
      doc
        .font("Helvetica")
        .fontSize(16)
        .fillColor(COLORS.text)
        .text(line, (PAGE.margin.left as number), y, {
          width: PAGE.contentWidth,
          align: "center",
        });
      y += 26;
    });
  } else {
    y += 20;
  }

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
    y += 30;
  }

  // Acceptance note
  const acceptance = `Scan2Plan, Inc. hereby proposes the following engagement to ${data.clientName || "our client"}. Use of the services offered by Scan2Plan constitutes acceptance of this proposal dated ${data.date}.`;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.textMuted)
    .text(acceptance, (PAGE.margin.left as number), y + 20, {
      width: PAGE.contentWidth,
      align: "center",
    });

  // Footer
  const coverFooterY = PAGE.height - PAGE.margin.bottom - 24;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.textMuted)
    .text("Scan2Plan", (PAGE.margin.left as number), coverFooterY, {
      width: PAGE.contentWidth,
      align: "center",
    });

  doc
    .fillColor(COLORS.primary)
    .text("www.scan2plan.com", (PAGE.margin.left as number), coverFooterY + 12, {
      width: PAGE.contentWidth,
      align: "center",
    });

  // New page for content
  doc.addPage();
}

/**
 * Page 2: About Scan2Plan + Why Scan2Plan
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

  // About Scan2Plan
  y = renderSectionHeading(doc, "About Scan2Plan", y, { fontSize: 16, marginBottom: 15 });

  const aboutText = customAbout
    ? cleanText(customAbout)
    : "Scan2Plan is a leading provider of professional 3D laser scanning and BIM documentation services. " +
    "We specialize in capturing existing conditions with millimeter accuracy and delivering high-quality " +
    "Building Information Models that architects, engineers, and construction professionals rely on for " +
    "design, renovation, and facility management projects.\n\n" +
    "Our focus is on design. We understand that your BIM model is the foundation for critical design decisions, " +
    "coordination workflows, and construction documentation. That's why we deliver models that are not just accurate, " +
    "but also intelligently structured, properly detailed, and ready to integrate seamlessly into your project workflow.";

  y = renderParagraph(doc, aboutText, y, { lineGap: 6 });
  y += 20;

  // Why Scan2Plan?
  y = renderSectionHeading(doc, "Why Scan2Plan?", y, { fontSize: 16, marginBottom: 15 });

  if (customWhy) {
    // If custom content provided, render as paragraph (bullets handled by cleanText mostly as * item)
    // Note: This is a simplification. Ideally we'd parse markdown list.
    // For now, we'll just render it as text which handles newlines.
    y = renderParagraph(doc, cleanText(customWhy), y, { lineGap: 6 });
  } else {
    // Default bullet points
    const whyItems = [
      "Unmatched Accuracy: Millimeter-precise scanning with the latest Leica and FARO technology",
      "Expert Modeling: BIM specialists trained in architecture, MEP, and structural disciplines",
      "Fast Turnaround: Efficient workflows deliver projects on time without compromising quality",
      "Design-Ready Models: Intelligently structured for coordination, clash detection, and fabrication",
      "Seamless Integration: Models work with your existing Revit, AutoCAD, and Navisworks workflows",
      "Dedicated Support: Direct access to your project team throughout the engagement",
    ];

    y = renderBulletList(doc, whyItems, y, { fontSize: 10 });
  }

  // Footer
  renderFooter(doc, "Scan2Plan - Professional 3D Scanning & BIM Services", 2);

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

  const scopeItems = [
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

  y = renderBulletList(doc, scopeItems, y, { fontSize: 10, lineGap: 4 });

  y += 15;

  // Deliverables section
  y = renderSectionHeading(doc, "Deliverables", y, { fontSize: 14, marginBottom: 12 });

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

  const deliverableItems = [
    "Total Square Footage Audit",
    `${modelLabel} Model - ${lodLabel}${disciplineLine ? ` + ${disciplineLine}` : ""}`,
  ];

  if (data.scope.hasMatterport) {
    deliverableItems.push("Matterport 3D Tour");
  }

  deliverableItems.push(
    "Colorized Point Cloud including 360 images viewable in Autodesk Recap or Trimble ScanExplorer"
  );

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
  renderFooter(doc, "Scan2Plan - Professional 3D Scanning & BIM Services", 3);

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

  // Render table
  y = renderTable(doc, columns, rows, y, {
    headerBg: COLORS.primary,
    rowAltBg: COLORS.backgroundAlt,
    fontSize: 9,
    headerFontSize: 10,
    rowHeight: 20,
    headerHeight: 24,
  });

  // Make header text white
  doc.fillColor(COLORS.white);

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
  renderFooter(doc, "Scan2Plan - Professional 3D Scanning & BIM Services", 4);

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

  // Contact
  y = renderParagraph(
    doc,
    "Questions about payment or terms? Contact us at admin@scan2plan.io or (518) 362-2403.",
    y,
    { fontSize: 9, color: COLORS.textMuted }
  );

  // Footer
  renderFooter(doc, "Scan2Plan - Professional 3D Scanning & BIM Services", 5);

  doc.addPage();
}

/**
 * Page 7: Scan2Plan Capabilities
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

  // Title
  y = renderSectionHeading(doc, "Scan2Plan Capabilities", y, {
    fontSize: 18,
    marginBottom: 20,
  });

  if (customContent) {
    // Render custom content as simple text for now
    // TODO: formatting for lists
    y = renderParagraph(doc, cleanText(customContent), y, { fontSize: 10, lineGap: 6 });
  } else {
    // Services
    y = renderSectionHeading(doc, "Core Services", y, { fontSize: 14, marginBottom: 12 });

    const services = [
      "3D Laser Scanning - High-definition reality capture of existing conditions",
      "BIM Modeling - Revit, AutoCAD, and other BIM platforms (LOD 100-400)",
      "As-Built Documentation - Accurate floor plans, elevations, and sections",
      "MEP Coordination - Multi-discipline models for clash detection",
      "Structural Analysis - Precise models for engineering and assessment",
      "Facility Management - As-built models for ongoing operations",
    ];

    y = renderBulletList(doc, services, y, { fontSize: 10 });

    y += 15;

    // Technology
    y = renderSectionHeading(doc, "Technology & Equipment", y, { fontSize: 14, marginBottom: 12 });

    const technology = [
      "Leica RTC360 & BLK360 laser scanners",
      "FARO Focus premium scanners",
      "Trimble and Topcon total stations",
      "Matterport Pro2 & Pro3 cameras",
      "Autodesk Revit, Recap Pro, and Navisworks",
    ];

    y = renderBulletList(doc, technology, y, { fontSize: 10 });

    y += 15;

    // Industries
    y = renderSectionHeading(doc, "Industries Served", y, { fontSize: 14, marginBottom: 12 });

    const industries = [
      "Commercial Real Estate - Office buildings, retail centers, mixed-use developments",
      "Healthcare - Hospitals, medical centers, research facilities",
      "Education - Schools, universities, libraries",
      "Industrial - Manufacturing plants, warehouses, distribution centers",
      "Government & Infrastructure - Public buildings, transportation facilities",
      "Historic Preservation - Museums, landmarks, heritage sites",
    ];

    y = renderBulletList(doc, industries, y, { fontSize: 10 });
  }

  // Footer
  renderFooter(doc, "Scan2Plan - Professional 3D Scanning & BIM Services", 6);

  doc.addPage();
}

/**
 * Page 8: The Scan2Plan Difference
 */
function renderDifferencePage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customContent?: string
): void {
  let y: number = PAGE.margin.top;

  // Title
  y = renderSectionHeading(doc, "The Scan2Plan Difference", y, {
    fontSize: 18,
    marginBottom: 20,
  });

  if (customContent) {
    y = renderParagraph(doc, cleanText(customContent), y, { fontSize: 10, lineGap: 6 });
  } else {
    // Quality
    y = renderSectionHeading(doc, "Uncompromising Quality", y, { fontSize: 14, marginBottom: 12 });

    const qualityText =
      "Every project undergoes rigorous quality control. Our multi-stage review process ensures accuracy, " +
      "completeness, and adherence to industry standards. We don't deliver a model until it meets our " +
      "exacting standards - and yours.";

    y = renderParagraph(doc, qualityText, y, { fontSize: 10, lineGap: 6 });

    y += 15;

    // Expertise
    y = renderSectionHeading(doc, "Deep Expertise", y, { fontSize: 14, marginBottom: 12 });

    const expertiseText =
      "Our team includes licensed architects, professional engineers, and BIM specialists with decades " +
      "of combined experience. We understand building systems, construction processes, and design intent - " +
      "not just how to push buttons on scanning equipment.";

    y = renderParagraph(doc, expertiseText, y, { fontSize: 10, lineGap: 6 });

    y += 15;

    // Partnership
    y = renderSectionHeading(doc, "True Partnership", y, { fontSize: 14, marginBottom: 12 });

    const partnershipText =
      "We're not just a vendor - we're your partner in project success. From initial planning through " +
      "final delivery and beyond, you'll work directly with experienced professionals who understand your " +
      "goals and are invested in achieving them.";

    y = renderParagraph(doc, partnershipText, y, { fontSize: 10, lineGap: 6 });

    y += 15;

    // Innovation
    y = renderSectionHeading(doc, "Continuous Innovation", y, { fontSize: 14, marginBottom: 12 });

    const innovationText =
      "We invest heavily in the latest scanning technology, modeling software, and process improvements. " +
      "Our workflows leverage cutting-edge tools like automated point cloud registration, AI-assisted modeling, " +
      "and cloud-based collaboration platforms to deliver faster, more accurate results.";

    y = renderParagraph(doc, innovationText, y, { fontSize: 10, lineGap: 6 });

    y += 20;

    // Guarantees
    y = renderSectionHeading(doc, "Our Commitments to You", y, { fontSize: 14, marginBottom: 12 });

    const commitments = [
      "Accuracy Guarantee - Models meet or exceed specified tolerance requirements",
      "On-Time Delivery - We hit deadlines or communicate proactively if challenges arise",
      "Responsive Support - Direct access to your project team, not a support ticket system",
      "Model Integrity - Properly structured, intelligently detailed, coordination-ready",
      "Value Protection - Fair pricing with no hidden fees or surprise charges",
    ];

    y = renderBulletList(doc, commitments, y, { fontSize: 10 });
  }

  // Footer
  renderFooter(doc, "Scan2Plan - Professional 3D Scanning & BIM Services", 7);

  doc.addPage();
}

/**
 * Pages 9-10: BIM Modeling Standards
 */
/**
 * Pages 9-10: BIM Modeling Standards
 */
function renderBIMStandardsPage(
  doc: PDFKit.PDFDocument,
  data: ProposalData,
  customContent?: string
): void {
  let y: number = PAGE.margin.top;

  // Title
  y = renderSectionHeading(doc, "BIM Modeling Standards", y, {
    fontSize: 18,
    marginBottom: 20,
  });

  const introText = customContent
    ? cleanText(customContent)
    : "Our BIM models are developed according to industry-standard Level of Development (LoD) specifications. " +
    "Below are the LoD levels commonly used in our projects. Your project deliverables are highlighted.";

  y = renderParagraph(doc, introText, y, { fontSize: 10, lineGap: 6 });

  y += 15;

  // LoD Table
  const lodColumns: TableColumn[] = [
    { header: "LoD", key: "level", width: 60, align: "left" },
    { header: "Description", key: "description", width: 120, align: "left" },
    { header: "Elements Included", key: "elements", width: 170, align: "left" },
    { header: "Use Cases", key: "useCases", width: 170, align: "left" },
  ];

  const projectLods = new Set(data.scope.lodLevels.map((lod) => lod.replace("LOD ", "")));

  const lodRows: TableRow[] = [
    {
      level: "LOD 200",
      description: "Approximate geometry",
      elements: "Walls, floors, roofs, major systems",
      useCases: "Early design, feasibility",
    },
    {
      level: "LOD 300",
      description: "Precise geometry",
      elements: "Detailed arch. and MEP elements",
      useCases: "Construction docs, coordination",
    },
    {
      level: "LOD 350",
      description: "Coordination model",
      elements: "All systems with connections",
      useCases: "Clash detection, fab prep",
    },
    {
      level: "LOD 350+",
      description: "Enhanced detail",
      elements: "Shop drawing level detail",
      useCases: "Fabrication, as-built docs",
    },
  ];

  y = renderTable(doc, lodColumns, lodRows, y, {
    headerBg: COLORS.primary,
    rowAltBg: COLORS.backgroundAlt,
    fontSize: 9,
    headerFontSize: 10,
    rowHeight: 22,
    headerHeight: 24,
  });

  y += 10;

  // Project-specific note
  if (projectLods.size > 0) {
    const lodList = Array.from(projectLods)
      .map((lod) => `LOD ${lod}`)
      .join(", ");

    const noteText =
      `Your project will be delivered at ${lodList}, providing the appropriate level of detail ` +
      `for your intended use case. All models include comprehensive metadata, accurate dimensions, ` +
      `and proper family/type assignments for downstream workflows.`;

    y = renderParagraph(doc, noteText, y, {
      fontSize: 9,
      color: COLORS.textMuted,
      lineGap: 4,
    });
  }

  // Footer
  renderFooter(doc, "Scan2Plan - Professional 3D Scanning & BIM Services", 8);

  // End of proposal
  doc.font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(COLORS.primary)
    .text("Thank you for considering Scan2Plan", (PAGE.margin.left as number), PAGE.height - 100, {
      width: PAGE.contentWidth,
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.textMuted)
    .text(
      "We look forward to partnering with you on this project",
      (PAGE.margin.left as number),
      PAGE.height - 80,
      {
        width: PAGE.contentWidth,
        align: "center",
      }
    );
}
