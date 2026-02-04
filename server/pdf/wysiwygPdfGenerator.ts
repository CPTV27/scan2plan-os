/**
 * WYSIWYG PDF Generator
 *
 * Generates PDFs that directly match the WYSIWYG proposal editor.
 * Each function corresponds 1:1 to a WYSIWYG component.
 */

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

// Font paths - Using Roboto to match Google Docs style proposals
// Use process.cwd() for compatibility with both ESM and CJS bundled builds
const getFontPath = (filename: string): string => {
  const possiblePaths = [
    path.join(process.cwd(), "server", "fonts", filename),
    path.join(process.cwd(), "fonts", filename),
    // Production paths
    path.join("/app", "server", "fonts", filename),
    path.join("/app", "fonts", filename),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0]; // Return first path even if not found (will fail gracefully)
};

const FONTS = {
  regular: getFontPath("Roboto-Regular.ttf"),
  bold: getFontPath("Roboto-Bold.ttf"),
};
import type {
  ProposalCoverData,
  ProposalProjectData,
  ProposalPaymentData,
  ProposalLineItem,
} from "@shared/schema/types";

// Colors extracted from example PDF proposals
const COLORS = {
  primary: "#123ea8",     // rgb(18,62,168) - Primary blue for headers/links
  headerBg: "#e8f0fe",    // Light blue table header
  text: "#49494b",        // rgb(73,73,75) - Dark gray body text
  textLight: "#434343",   // rgb(67,67,67) - Secondary text
  textMuted: "#616161",   // rgb(97,97,97) - Muted gray for footer
  border: "#d1d5db",      // gray-300
  borderLight: "#e5e7eb", // gray-200
  white: "#ffffff",
};

// Page dimensions (Letter size)
const PAGE = {
  width: 612,
  height: 792,
  margin: 38, // Consistent with About page
  contentWidth: 536, // 612 - 38*2
};

// Typography settings matching About page design
const TYPOGRAPHY = {
  // Font sizes
  pageTitle: 23,        // "About Scan2Plan", "The Project", etc.
  sectionHeading: 16,   // "Overview", "Scope of Work", etc.
  subtitle: 20,         // "Laser Scanning & Building Documentation"
  bodyText: 12,         // Regular paragraph text
  bulletText: 12,       // Bullet list items
  smallText: 10,        // Contact info, footer
  tableHeader: 9,       // Table column headers

  // Line spacing
  bodyLineGap: 3,       // Space between lines in paragraphs
  bulletLineGap: 3,     // Space between lines within a bullet item

  // Vertical spacing
  afterPageTitle: 25,   // Space after main page title
  afterSectionHeading: 25, // Space after section headings
  betweenParagraphs: 16,   // Space between paragraphs
  betweenBullets: 2,       // Space between bullet items
  beforeSection: 20,       // Space before new section

  // Bullet styling
  bulletIndent: 20,        // Space from bullet to text
  bulletColor: "#666666",  // Gray bullet color
};

// Client signature data for signed PDFs
export interface SignatureData {
  signatureImage: string;
  signerName: string;
  signerEmail: string;
  signerTitle: string;
  signedAt: Date | string;
}

// Sender (Scan2Plan rep) signature data
export interface SenderSignatureData {
  signatureImage: string;
  signerName: string;
  signerEmail: string;
  signerTitle: string;
  signedAt: Date | string;
}

// Full audit trail for Certificate of Signature
export interface SignatureAuditTrail {
  certificateRefNumber: string;
  documentCompletedAt?: Date | string;
  // Sender audit trail
  senderName: string;
  senderEmail: string;
  senderSignatureImage?: string;
  senderSentAt?: Date | string;
  senderViewedAt?: Date | string;
  senderSignedAt?: Date | string;
  senderIpAddress?: string;
  // Client audit trail
  clientName: string;
  clientEmail: string;
  clientSignatureImage?: string;
  clientSentAt?: Date | string;
  clientViewedAt?: Date | string;
  clientSignedAt?: Date | string;
  clientIpAddress?: string;
  clientLocation?: string;
}

// Full proposal data structure (matches WYSIWYG ProposalData)
// Display settings for proposal rendering
export interface ProposalDisplaySettings {
  rollupByDiscipline?: boolean;  // When true, consolidate line items by discipline with avg rate
}

export interface WYSIWYGProposalData {
  id: number;
  leadId: number;
  coverData: ProposalCoverData;
  projectData: ProposalProjectData;
  lineItems: ProposalLineItem[];
  paymentData: ProposalPaymentData;
  displaySettings?: ProposalDisplaySettings;
  subtotal: number;
  total: number;
  signatureData?: SignatureData; // Optional: client signature for signed PDFs
  senderSignatureData?: SenderSignatureData; // Optional: sender signature for signed PDFs
  auditTrail?: SignatureAuditTrail; // Optional: full audit trail for Certificate page
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format number with commas
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * Roll up line items by discipline, calculating average rate per sqft
 */
function rollupLineItemsByDiscipline(lineItems: ProposalLineItem[]): ProposalLineItem[] {
  const disciplineKeywords: Record<string, string> = {
    architecture: "Architecture",
    arch: "Architecture",
    mep: "MEP/F",
    mepf: "MEP/F",
    "mep/f": "MEP/F",
    mechanical: "MEP/F",
    electrical: "MEP/F",
    plumbing: "MEP/F",
    structure: "Structure",
    structural: "Structure",
    site: "Site/Grade",
    grade: "Site/Grade",
    landscape: "Landscape",
    cad: "CAD Deliverable",
    matterport: "Matterport",
    travel: "Travel",
    risk: "Risk Premium",
  };

  const detectDiscipline = (itemName: string): string => {
    const nameLower = itemName.toLowerCase();
    for (const [keyword, discipline] of Object.entries(disciplineKeywords)) {
      if (nameLower.includes(keyword)) {
        return discipline;
      }
    }
    return "Other Services";
  };

  const groups: Record<string, { totalQty: number; totalAmount: number; items: ProposalLineItem[] }> = {};

  lineItems.forEach((item) => {
    const discipline = detectDiscipline(item.itemName);
    if (!groups[discipline]) {
      groups[discipline] = { totalQty: 0, totalAmount: 0, items: [] };
    }
    groups[discipline].totalQty += item.qty || 0;
    groups[discipline].totalAmount += item.amount || 0;
    groups[discipline].items.push(item);
  });

  const consolidated: ProposalLineItem[] = [];
  const disciplineOrder = ["Architecture", "MEP/F", "Structure", "Site/Grade", "Landscape", "CAD Deliverable", "Matterport", "Travel", "Risk Premium", "Other Services"];

  disciplineOrder.forEach((discipline) => {
    const group = groups[discipline];
    if (group && group.items.length > 0) {
      const avgRate = group.totalQty > 0 ? group.totalAmount / group.totalQty : 0;
      const areaNames = group.items.map((item) => {
        const match = item.itemName.match(/^(.+?)\s*-\s*/);
        return match ? match[1] : item.itemName;
      });
      const uniqueAreas = [...new Set(areaNames)];

      consolidated.push({
        id: `rollup-${discipline.toLowerCase().replace(/[^a-z]/g, "-")}`,
        itemName: `Scan2Plan ${discipline}`,
        description: `${discipline} modeling services for ${uniqueAreas.length > 1 ? `${uniqueAreas.length} areas` : uniqueAreas[0] || "project"}. Total ${group.totalQty.toLocaleString()} sqft at avg $${avgRate.toFixed(2)}/sqft.`,
        qty: group.totalQty,
        rate: Math.round(avgRate * 100) / 100,
        amount: Math.round(group.totalAmount * 100) / 100,
      });
    }
  });

  return consolidated;
}

/**
 * Draw horizontal line
 */
function drawLine(
  doc: PDFKit.PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string = COLORS.border
): void {
  doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(1).stroke();
}

/**
 * Render page footer (common to all pages)
 * Footer must stay within page bounds to avoid creating extra pages
 * Uses lineBreak: false to prevent PDFKit from auto-creating pages
 */
function renderFooter(doc: PDFKit.PDFDocument): void {
  // Position footer at fixed position near bottom
  const footerY = 768;

  const footerMainText = "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • ";
  const footerLinkText = "scan2plan.io";

  doc.font("Roboto").fontSize(9);

  // Calculate positions for centered footer with link
  const mainTextWidth = doc.widthOfString(footerMainText);
  const footerLinkWidth = doc.widthOfString(footerLinkText);
  const footerTotalWidth = mainTextWidth + footerLinkWidth;
  const footerStartX = (PAGE.width - footerTotalWidth) / 2;
  const footerLinkX = footerStartX + mainTextWidth;

  // Render main footer text (gray)
  doc.fillColor(COLORS.textMuted);
  doc.text(footerMainText, footerStartX, footerY, { lineBreak: false, continued: false });

  // Render link text (blue)
  doc.fillColor(COLORS.primary);
  doc.text(footerLinkText, footerLinkX, footerY, { lineBreak: false, continued: false });

  // Draw underline manually
  doc.moveTo(footerLinkX, footerY + 10).lineTo(footerLinkX + footerLinkWidth, footerY + 10).strokeColor(COLORS.primary).lineWidth(0.5).stroke();

  // Add clickable link annotation
  doc.link(footerLinkX, footerY - 2, footerLinkWidth, 14, "https://www.scan2plan.io");
}

/**
 * Page 1: Cover Page
 * Fixed positions for footer and legal; adaptive spacing for content above
 */
function renderCoverPage(doc: PDFKit.PDFDocument, data: ProposalCoverData): void {
  // =====================
  // COVER PAGE SPECIFIC LAYOUT
  // =====================
  const coverMargin = 45;
  const coverContentWidth = PAGE.width - (coverMargin * 2);

  // Fixed positions (from bottom up) - match standard footer position
  const footerY = 768;  // Same as renderFooter
  const legalY = footerY - 80;  // Legal text 80px above footer

  // Font sizes
  const serviceTitleFontSize = 26;
  const legalFontSize = 12;

  // Logo settings
  const logoWidth = 248;
  const logoHeight = logoWidth;
  const logoTopOffset = 38;

  // Calculate content heights for adaptive spacing
  doc.font("Roboto").fontSize(serviceTitleFontSize);
  const serviceTitle = data.serviceTitle || "Laser Scanning & Building Documentation";
  const lineSpacing = 4;  // Tighter spacing between project info lines

  const serviceTitleHeight = doc.heightOfString(serviceTitle, { width: coverContentWidth, lineGap: lineSpacing });
  const projectTitleHeight = doc.heightOfString(data.projectTitle || "", { width: coverContentWidth, lineGap: lineSpacing });
  const addressHeight = data.projectAddress ? doc.heightOfString(data.projectAddress, { width: coverContentWidth, lineGap: lineSpacing }) : 0;
  const servicesLineHeight = doc.heightOfString(data.servicesLine || "", { width: coverContentWidth, lineGap: lineSpacing });

  // Proposal title height
  const proposalHeight = 38;

  // Project block height with internal line spacing
  const projectBlockHeight = serviceTitleHeight + projectTitleHeight + addressHeight + servicesLineHeight + (lineSpacing * 3);

  // Content that needs to fit between logo and legal text
  const middleContentHeight = proposalHeight + projectBlockHeight;

  // Available space for middle content (between logo bottom and legal top)
  const logoBottom = coverMargin + logoTopOffset + logoHeight;
  const availableMiddleSpace = legalY - logoBottom;

  // Calculate gaps (3 gaps: after logo, after proposal, after project block)
  // Use half the available space to keep text tighter
  const evenGap = Math.max(10, (availableMiddleSpace - middleContentHeight) / 6);

  // =====================
  // RENDER LOGO
  // =====================
  let y = coverMargin + logoTopOffset;

  const logoPath = path.join(process.cwd(), "client", "public", "logo-cover-header.jpg");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, coverMargin, y, { width: logoWidth });
    y += logoHeight;
  } else {
    const fallbackLogoPath = path.join(process.cwd(), "client", "public", "logo-cover.png");
    if (fs.existsSync(fallbackLogoPath)) {
      doc.image(fallbackLogoPath, coverMargin, y, { width: 120 });
      y += 120;
    }
  }

  y += evenGap;

  // =====================
  // RENDER PROPOSAL TITLE
  // =====================
  doc.font("Roboto-Bold").fontSize(31).fillColor(COLORS.text);
  doc.text("- PROPOSAL -", coverMargin, y, {
    width: coverContentWidth,
    align: "center",
    characterSpacing: 0.5,
  });
  y += proposalHeight + evenGap;

  // =====================
  // RENDER PROJECT INFO BLOCK
  // =====================
  doc.font("Roboto").fontSize(serviceTitleFontSize).fillColor(COLORS.text);
  doc.text(serviceTitle, coverMargin, y, {
    width: coverContentWidth,
    align: "center",
    lineGap: lineSpacing,
  });
  y += serviceTitleHeight + lineSpacing;

  doc.text(data.projectTitle || "", coverMargin, y, {
    width: coverContentWidth,
    align: "center",
    lineGap: lineSpacing,
  });
  y += projectTitleHeight + lineSpacing;

  if (data.projectAddress) {
    doc.text(data.projectAddress, coverMargin, y, {
      width: coverContentWidth,
      align: "center",
      lineGap: lineSpacing,
    });
    y += addressHeight + lineSpacing;
  }

  const areaScopeLines = (data as any).areaScopeLines as string[] | undefined;
  if (areaScopeLines && areaScopeLines.length > 1) {
    areaScopeLines.forEach((line) => {
      doc.text(line, coverMargin, y, { width: coverContentWidth, align: "center", lineGap: lineSpacing });
      y += doc.heightOfString(line, { width: coverContentWidth, lineGap: lineSpacing }) + lineSpacing;
    });
  } else {
    doc.text(data.servicesLine || "", coverMargin, y, {
      width: coverContentWidth,
      align: "center",
      lineGap: lineSpacing,
    });
  }

  // =====================
  // RENDER LEGAL TEXT (fixed position above footer)
  // =====================
  const clientName = data.clientName || "[Client Name]";
  const proposalDate = data.date || new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }).replace(/\//g, "/");

  // Render legal text as simple lines to prevent overflow
  doc.font("Roboto").fontSize(legalFontSize).fillColor(COLORS.text);

  const legalLine1 = `Scan2Plan, Inc., a Delaware corporation ("S2P") hereby proposes the following engagement to`;
  doc.text(legalLine1, coverMargin, legalY, { width: coverContentWidth, lineBreak: false });

  doc.font("Roboto-Bold");
  doc.text(`${clientName.toUpperCase()}.`, coverMargin, legalY + 16, { continued: true, lineBreak: false });
  doc.font("Roboto");
  doc.text(` Use of the services offered by S2P ("the services") constitutes`, { lineBreak: false });

  doc.text(`acceptance of this proposal dated `, coverMargin, legalY + 32, { continued: true, lineBreak: false });
  doc.font("Roboto-Bold").text(proposalDate, { lineBreak: false });

  // =====================
  // RENDER FOOTER (fixed position at bottom)
  // =====================
  const footerMainText = "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • ";
  const footerLinkText = "scan2plan.io";

  doc.font("Roboto").fontSize(9);

  // Calculate positions for centered footer with link
  const mainTextWidth = doc.widthOfString(footerMainText);
  const footerLinkWidth = doc.widthOfString(footerLinkText);
  const footerTotalWidth = mainTextWidth + footerLinkWidth;
  const footerStartX = (PAGE.width - footerTotalWidth) / 2;
  const footerLinkX = footerStartX + mainTextWidth;

  // Render main footer text (gray)
  doc.fillColor(COLORS.textMuted);
  doc.text(footerMainText, footerStartX, footerY, { lineBreak: false, continued: false });

  // Render link text (blue, underlined) - draw underline manually
  doc.fillColor(COLORS.primary);
  doc.text(footerLinkText, footerLinkX, footerY, { lineBreak: false, continued: false });

  // Draw underline manually
  doc.moveTo(footerLinkX, footerY + 10).lineTo(footerLinkX + footerLinkWidth, footerY + 10).strokeColor(COLORS.primary).lineWidth(0.5).stroke();

  // Add clickable link annotation
  doc.link(footerLinkX, footerY - 2, footerLinkWidth, 14, "https://www.scan2plan.io");
}

/**
 * Page 2: About Page
 * Matches reference layout
 */
function renderAboutPage(doc: PDFKit.PDFDocument): void {
  // Page-specific margins
  const aboutMargin = 38;
  const aboutContentWidth = PAGE.width - (aboutMargin * 2);
  const topPadding = 56;  // Top padding

  let y = topPadding;

  // Layout settings matching reference
  const headerFontSize = 23;
  const bodyFontSize = 12;
  const consistentSpacing = 25;  // Spacing between headers and text

  // Title: "About Scan2Plan®"
  doc.font("Roboto-Bold").fontSize(headerFontSize).fillColor(COLORS.primary);
  doc.text("About Scan2Plan", aboutMargin, y, { continued: true });
  doc.font("Roboto").fontSize(10).text("®", { continued: false });
  y += headerFontSize + consistentSpacing;

  // Paragraph 1: "We began in 2018..."
  doc.font("Roboto").fontSize(bodyFontSize).fillColor("#000000");  // Black text
  doc.text("We began in 2018 with a simple goal of helping firms ", aboutMargin, y, {
    width: aboutContentWidth,
    lineGap: 3,
    continued: true
  });
  doc.font("Roboto-Bold").fillColor(COLORS.primary).text("focus on design", {
    continued: true
  });
  doc.font("Roboto").fillColor("#000000").text(".", { continued: false, underline: false });
  y += 16 + consistentSpacing;

  // Paragraph 2
  const para2 = "We're an on-demand LiDAR to BIM/CAD team that can model any building in weeks. This can be done within any scope, budget or schedule. We've scanned over 1,000 buildings (~10M sqft).";
  doc.font("Roboto").fontSize(bodyFontSize).text(para2, aboutMargin, y, { width: aboutContentWidth, lineGap: 3 });
  y += doc.heightOfString(para2, { width: aboutContentWidth, lineGap: 3 }) + consistentSpacing;

  // Paragraph 3
  const para3 = "We use LiDAR scanners for 3D mapping with extreme accuracy. We deliver professionally drafted 3D BIM and 2D CAD for comprehensive existing conditions documentation. Our Point Cloud datasets serve as a verifiable single-source-of-truth for coordination and risk-mitigation across projects.";
  doc.text(para3, aboutMargin, y, { width: aboutContentWidth, lineGap: 3 });
  y += doc.heightOfString(para3, { width: aboutContentWidth, lineGap: 3 }) + consistentSpacing;

  // Point Cloud Image - centered
  const imagePath = path.join(process.cwd(), "client", "public", "point-cloud-building.jpg");
  if (fs.existsSync(imagePath)) {
    const imageWidth = 420;
    const imageX = (PAGE.width - imageWidth) / 2;
    doc.image(imagePath, imageX, y, { width: imageWidth });
    y += 168;
  } else {
    y += 20;
  }

  // "Why Scan2Plan?" header
  doc.font("Roboto-Bold").fontSize(headerFontSize).fillColor(COLORS.primary);
  doc.text("Why Scan2Plan?", aboutMargin, y);
  y += headerFontSize + consistentSpacing;

  // Two column bullet list
  const leftItems = [
    "Experienced, dedicated team of field techs, drafters (AutoCAD and Revit) and licensed engineers.",
    "We take the time to scope each project to suit your priorities.",
    "We use the finest precision tools to capture a point cloud with extreme accuracy.",
    "Drafted to Scan2Plan's rigorous design standards - your design phase begins upon delivery.",
  ];

  const rightItems = [
    "We take a process driven approach with extensive quality control and team review.",
    "Exceptional support from real professionals.",
    "Scan2Plan has national and international coverage.",
    "We work on a wide range of projects from single family homes to large-scale commercial, industrial and infrastructure.",
  ];

  const colGap = 30;
  const colWidth = (aboutContentWidth - colGap) / 2;
  const leftX = aboutMargin;
  const rightX = aboutMargin + colWidth + colGap;
  const bulletSpacing = 2;  // Space between bullet items
  const bulletIndent = 20;  // Space from bullet to text

  doc.font("Roboto").fontSize(bodyFontSize).fillColor("#000000");  // Black text

  // Helper to render bullet with proper indentation
  const renderBulletItem = (item: string, x: number, yPos: number): number => {
    // Draw small bullet (using middle dot for lighter appearance)
    doc.fillColor("#666666");  // Gray bullet
    doc.text("•", x, yPos + 1, { lineBreak: false });

    // Draw text with indent so it wraps under itself
    doc.fillColor("#000000");
    const textX = x + bulletIndent;
    const textWidth = colWidth - bulletIndent;
    doc.text(item, textX, yPos, { width: textWidth, lineGap: 3 });

    return doc.heightOfString(item, { width: textWidth, lineGap: 3 }) + bulletSpacing;
  };

  // Render left column
  let leftY = y;
  leftItems.forEach((item) => {
    leftY += renderBulletItem(item, leftX, leftY);
  });

  // Render right column
  let rightY = y;
  rightItems.forEach((item) => {
    rightY += renderBulletItem(item, rightX, rightY);
  });

  renderFooter(doc);
}

/**
 * Page 3: Project Page
 * Matches ProposalProjectPage.tsx
 */
function renderProjectPage(doc: PDFKit.PDFDocument, data: ProposalProjectData): void {
  const topPadding = 56;
  let y = topPadding;

  // Page-specific spacing
  const afterMainTitle = 22;       // Space after "The Project"
  const beforeSubHeader = 22;      // Space ABOVE each sub-header
  const afterSubHeader = 22;       // Space BELOW each sub-header (before content)
  const bulletIndentFromMargin = 17;  // Indent bullets from margin

  // Helper to render bullet with proper indentation
  const renderBullet = (item: string, yPos: number): number => {
    doc.font("Roboto").fontSize(TYPOGRAPHY.bulletText).fillColor(TYPOGRAPHY.bulletColor);
    doc.text("•", PAGE.margin + bulletIndentFromMargin, yPos + 1, { lineBreak: false });

    doc.fillColor("#000000");
    const textX = PAGE.margin + bulletIndentFromMargin + TYPOGRAPHY.bulletIndent;
    const textWidth = PAGE.contentWidth - bulletIndentFromMargin - TYPOGRAPHY.bulletIndent;
    doc.text(item, textX, yPos, { width: textWidth, lineGap: TYPOGRAPHY.bulletLineGap });

    return doc.heightOfString(item, { width: textWidth, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
  };

  // Helper to render sub-header and return new Y position
  const renderSubHeader = (text: string, yPos: number): number => {
    doc.font("Roboto-Bold").fontSize(TYPOGRAPHY.sectionHeading).fillColor(COLORS.primary);
    doc.text(text, PAGE.margin, yPos);
    const headerHeight = doc.heightOfString(text, { width: PAGE.contentWidth });
    return yPos + headerHeight + afterSubHeader;
  };

  // Title
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("The Project", PAGE.margin, y);
  y += doc.heightOfString("The Project", { width: PAGE.contentWidth }) + afterMainTitle;

  // Overview
  y = renderSubHeader("Overview", y);

  // Use overviewLine if set, otherwise fall back to legacy format
  const overviewText = data.overviewLine || `Service for ${data.overview || ""}`;

  // Check if text starts with "Commercial Service" to make it bold
  if (overviewText.startsWith("Commercial Service")) {
    doc.font("Roboto-Bold").fontSize(TYPOGRAPHY.bodyText).fillColor("#000000");
    doc.text("Commercial Service", PAGE.margin, y, { continued: true });
    doc.font("Roboto");
    doc.text(overviewText.substring("Commercial Service".length), { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
  } else {
    doc
      .font("Roboto")
      .fontSize(TYPOGRAPHY.bodyText)
      .fillColor("#000000")
      .text(overviewText, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
  }
  y += doc.heightOfString(overviewText, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + beforeSubHeader;

  // Scope of Work
  if (data.scopeItems && data.scopeItems.length > 0) {
    y = renderSubHeader("Scope of Work", y);

    data.scopeItems.forEach((item) => {
      y += renderBullet(item, y);
    });
    y += beforeSubHeader - TYPOGRAPHY.betweenBullets;
  }

  // Deliverables
  if (data.deliverables && data.deliverables.length > 0) {
    y = renderSubHeader("Deliverables", y);

    data.deliverables.forEach((item) => {
      y += renderBullet(item, y);
    });
    y += beforeSubHeader - TYPOGRAPHY.betweenBullets;
  }

  // Timeline
  if (data.timelineIntro || (data.milestones && data.milestones.length > 0)) {
    y = renderSubHeader("Timeline", y);

    if (data.timelineIntro) {
      doc
        .font("Roboto")
        .fontSize(TYPOGRAPHY.bodyText)
        .fillColor("#000000")
        .text(data.timelineIntro, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
      y += doc.heightOfString(data.timelineIntro, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + 22;
    }

    if (data.milestones && data.milestones.length > 0) {
      data.milestones.forEach((item) => {
        y += renderBullet(item, y);
      });
    }
  }

  renderFooter(doc);
}

/**
 * Page 4: Estimate Table
 * Matches ProposalEstimateTable.tsx exactly
 */
function renderEstimatePage(
  doc: PDFKit.PDFDocument,
  lineItems: ProposalLineItem[],
  coverData: ProposalCoverData,
  leadId: number,
  total: number
): void {
  let y = PAGE.margin;

  // Header with company info (left) and logo (right)
  doc
    .font("Roboto-Bold")
    .fontSize(14)
    .fillColor(COLORS.text)
    .text("SCAN2PLAN", PAGE.margin, y);
  y += 16;

  doc
    .font("Roboto")
    .fontSize(9)
    .fillColor(COLORS.textLight)
    .text("188 1st St", PAGE.margin, y);
  y += 12;
  doc.text("Troy, NY 12180 US", PAGE.margin, y);
  y += 12;
  doc.text("admin@scan2plan.io", PAGE.margin, y);

  // Logo on right
  const logoPath = path.join(process.cwd(), "client", "public", "logo-cover.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, PAGE.width - PAGE.margin - 80, PAGE.margin, { height: 40 });
  }

  y += 20;
  drawLine(doc, PAGE.margin, y, PAGE.width - PAGE.margin, y, COLORS.borderLight);
  y += 20;

  // Title
  doc
    .font("Roboto-Bold")
    .fontSize(22)
    .fillColor(COLORS.primary)
    .text("Estimate", PAGE.margin, y);
  y += 32;

  // Address and Estimate info row
  doc
    .font("Roboto")
    .fontSize(8)
    .fillColor(COLORS.textMuted)
    .text("ADDRESS", PAGE.margin, y);

  const metaX = PAGE.width - PAGE.margin - 180;
  doc.text("ESTIMATE", metaX, y);
  doc.text("DATE", metaX + 90, y);
  y += 12;

  // Address value - use projectTitle which contains the street address
  const addressValue = coverData.projectTitle || coverData.projectAddress || "";
  doc
    .font("Roboto-Bold")
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(addressValue, PAGE.margin, y, { width: 280 });

  doc
    .font("Roboto")
    .fontSize(10)
    .text(`EST-${leadId}`, metaX, y);
  doc.text(coverData.date || "", metaX + 90, y);
  y += 32;

  // Table layout matching WYSIWYG ProposalEstimateTable.tsx exactly
  // WYSIWYG uses: ITEM (flex), QTY (w-16=64px), RATE (w-20=80px), AMOUNT (w-24=96px)
  const tableX = PAGE.margin;
  const fixedColWidths = {
    qty: 64,     // w-16 = 64px
    rate: 80,    // w-20 = 80px
    amount: 96,  // w-24 = 96px
  };
  const colWidths = {
    item: PAGE.contentWidth - fixedColWidths.qty - fixedColWidths.rate - fixedColWidths.amount, // Remaining space
    qty: fixedColWidths.qty,
    rate: fixedColWidths.rate,
    amount: fixedColWidths.amount,
  };
  const tableWidth = PAGE.contentWidth;
  const headerHeight = 32;  // p-3 = 12px padding top + bottom + text
  const cellPadding = 12;   // p-3 = 12px

  // Table header (solid blue background)
  doc.rect(tableX, y, tableWidth, headerHeight).fill(COLORS.primary);

  doc.font("Roboto-Bold").fontSize(10).fillColor(COLORS.white);
  doc.text("ITEM", tableX + cellPadding, y + 9);
  doc.text("QTY", tableX + colWidths.item, y + 9, { width: colWidths.qty - 8, align: "right" });
  doc.text("RATE", tableX + colWidths.item + colWidths.qty, y + 9, { width: colWidths.rate - 8, align: "right" });
  doc.text("AMOUNT", tableX + colWidths.item + colWidths.qty + colWidths.rate, y + 9, { width: colWidths.amount - 8, align: "right" });

  y += headerHeight;

  // Text width for item column content (with padding)
  const itemTextWidth = colWidths.item - cellPadding * 2;

  // Table rows
  lineItems.forEach((item, index) => {
    const itemName = item.itemName || "";
    const description = item.description || "";

    // Calculate row height based on content
    doc.font("Roboto-Bold").fontSize(10);
    const nameHeight = doc.heightOfString(itemName, { width: itemTextWidth });

    // Calculate description height
    let descHeight = 0;
    if (description) {
      doc.font("Roboto").fontSize(9);
      descHeight = doc.heightOfString(description, { width: itemTextWidth, lineGap: 2 }) + 8;
    }

    const rowHeight = Math.max(40, nameHeight + descHeight + 20);

    // Check if we need a new page
    if (y + rowHeight > PAGE.height - 140) {
      doc.addPage();
      y = PAGE.margin;
    }

    // Row background (alternate light gray)
    if (index % 2 === 1) {
      doc.rect(tableX, y, tableWidth, rowHeight).fill("#f9fafb");
    }

    // Row border
    drawLine(doc, tableX, y + rowHeight, tableX + tableWidth, y + rowHeight, COLORS.borderLight);

    // ITEM column: name (bold) + description (smaller, gray)
    let textY = y + 10;
    doc.font("Roboto-Bold").fontSize(10).fillColor(COLORS.text);
    doc.text(itemName, tableX + cellPadding, textY, { width: itemTextWidth });
    textY += nameHeight + 4;

    if (description) {
      doc.font("Roboto").fontSize(9).fillColor(COLORS.textLight);
      doc.text(description, tableX + cellPadding, textY, { width: itemTextWidth, lineGap: 2 });
    }

    // QTY column (aligned to top of row)
    doc.font("Roboto").fontSize(10).fillColor(COLORS.text);
    doc.text(formatNumber(item.qty || 0), tableX + colWidths.item, y + 10, {
      width: colWidths.qty - 8,
      align: "right",
    });

    // RATE column
    doc.text(formatCurrency(item.rate || 0), tableX + colWidths.item + colWidths.qty, y + 10, {
      width: colWidths.rate - 8,
      align: "right",
    });

    // AMOUNT column
    doc.font("Roboto-Bold").fontSize(10);
    doc.text(formatCurrency(item.amount || 0), tableX + colWidths.item + colWidths.qty + colWidths.rate, y + 10, {
      width: colWidths.amount - 8,
      align: "right",
    });

    y += rowHeight;
  });

  y += 8;

  // Total row with background
  const totalRowHeight = 36;
  doc.rect(tableX, y, tableWidth, totalRowHeight).fill("#f3f4f6");

  doc.font("Roboto-Bold").fontSize(11).fillColor(COLORS.textLight);
  doc.text("TOTAL", tableX + colWidths.item + colWidths.qty, y + 11, {
    width: colWidths.rate - 8,
    align: "right",
  });

  doc.font("Roboto-Bold").fontSize(14).fillColor(COLORS.primary);
  doc.text(formatCurrency(total), tableX + colWidths.item + colWidths.qty + colWidths.rate, y + 10, {
    width: colWidths.amount - 8,
    align: "right",
  });

  y += totalRowHeight + 20;

  // Signature section
  doc.font("Roboto").fontSize(9).fillColor(COLORS.textMuted);
  doc.text("Accepted By", PAGE.margin, y);
  drawLine(doc, PAGE.margin, y + 20, PAGE.margin + 200, y + 20, COLORS.border);

  y += 36;
  doc.text("Accepted Date", PAGE.margin, y);
  drawLine(doc, PAGE.margin, y + 20, PAGE.margin + 200, y + 20, COLORS.border);

  y += 40;

  // Notes
  doc.font("Roboto").fontSize(8).fillColor(COLORS.textMuted);
  doc.text(
    "All pricing is valid for 30 days from the date of this proposal. Final square footage will be verified during scanning and pricing may be adjusted if actual conditions differ significantly from estimates.",
    PAGE.margin,
    y,
    { width: PAGE.contentWidth }
  );

  renderFooter(doc);
}

/**
 * Page 5: Payment Page
 * Matches ProposalPaymentPage.tsx - Now with dual signature layout
 */
function renderPaymentPage(
  doc: PDFKit.PDFDocument,
  data: ProposalPaymentData,
  signatureData?: SignatureData,
  senderSignatureData?: SenderSignatureData
): void {
  const topPadding = 53;  // 5% reduced from 56
  let y = topPadding;

  // Helper to render bullet with proper indentation
  const bulletIndentFromMargin = 17;  // Indent bullets from margin
  const bodyTextSize = TYPOGRAPHY.bodyText - 1;  // 1px smaller body text for this page
  const renderBullet = (item: string, yPos: number): number => {
    doc.font("Roboto").fontSize(bodyTextSize).fillColor(TYPOGRAPHY.bulletColor);
    doc.text("•", PAGE.margin + bulletIndentFromMargin, yPos + 1, { lineBreak: false });

    doc.fillColor("#000000");
    const textX = PAGE.margin + bulletIndentFromMargin + TYPOGRAPHY.bulletIndent;
    const textWidth = PAGE.contentWidth - bulletIndentFromMargin - TYPOGRAPHY.bulletIndent;
    doc.text(item, textX, yPos, { width: textWidth, lineGap: TYPOGRAPHY.bulletLineGap });

    return doc.heightOfString(item, { width: textWidth, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
  };

  // Title - "Payment Terms" (3px smaller than page title)
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle - 3)
    .fillColor(COLORS.primary)
    .text("Payment Terms", PAGE.margin, y);
  y += doc.heightOfString("Payment Terms") + 24;  // 24px spacing to bullets

  // Payment Terms bullets
  if (data.terms && data.terms.length > 0) {
    data.terms.forEach((term) => {
      y += renderBullet(term, y);
    });
  }
  y += 22 - TYPOGRAPHY.betweenBullets;  // 22px spacing above Accepted Forms

  // Accepted Forms of Payment (3px smaller than section heading - up 1px from before)
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.sectionHeading - 3)
    .fillColor(COLORS.primary)
    .text("Accepted Forms of Payment:", PAGE.margin, y);
  y += doc.heightOfString("Accepted Forms of Payment:") + 7;  // ~1/3 of 22px spacing to items

  // Numbered items with half line spacing
  if (data.paymentMethods && data.paymentMethods.length > 0) {
    data.paymentMethods.forEach((method, index) => {
      doc.font("Roboto").fontSize(bodyTextSize).fillColor(TYPOGRAPHY.bulletColor);
      doc.text(`${index + 1}.`, PAGE.margin + bulletIndentFromMargin, y, { lineBreak: false });

      doc.fillColor("#000000");
      const textX = PAGE.margin + bulletIndentFromMargin + TYPOGRAPHY.bulletIndent;
      const textWidth = PAGE.contentWidth - bulletIndentFromMargin - TYPOGRAPHY.bulletIndent;
      doc.text(method, textX, y, { width: textWidth, lineGap: TYPOGRAPHY.bulletLineGap });

      y += doc.heightOfString(method, { width: textWidth, lineGap: TYPOGRAPHY.bulletLineGap }) + 1;  // Half spacing (1px)
    });
  }
  y += 24 - 1;  // 24px spacing to Acknowledgement

  // Acknowledgement section (2px smaller than section heading)
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.sectionHeading - 2)
    .fillColor(COLORS.primary)
    .text("Acknowledgement:", PAGE.margin, y);
  y += doc.heightOfString("Acknowledgement:") + 7;  // ~1/3 of top spacing

  // Acknowledgement text with T&C link reference
  const ackDate = signatureData?.signedAt
    ? new Date(signatureData.signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : data.acknowledgementDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  doc
    .font("Roboto")
    .fontSize(bodyTextSize)
    .fillColor("#000000")
    .text("Client acknowledges receipt of and agrees to be bound by S2P's ", PAGE.margin, y, {
      width: PAGE.contentWidth,
      continued: true,
      lineGap: TYPOGRAPHY.bodyLineGap,
    });
  doc
    .fillColor(COLORS.primary)
    .text("General Terms and Conditions", {
      continued: true,
      underline: true,
      link: "https://www.scan2plan.io/scan2plan-terms-conditions",
    });
  doc
    .fillColor("#000000")
    .text(` dated `, { continued: true, underline: false });
  doc
    .font("Roboto-Bold")
    .text(ackDate, { continued: true });
  doc
    .font("Roboto")
    .text(" which are incorporated herein by reference.", { continued: false });

  // Calculate height of the acknowledgement text block and add 24px spacing
  const ackText = "Client acknowledges receipt of and agrees to be bound by S2P's General Terms and Conditions dated " + ackDate + " which are incorporated herein by reference.";
  y += doc.heightOfString(ackText, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + 24;

  doc
    .font("Roboto")
    .fontSize(bodyTextSize)
    .fillColor("#000000")
    .text(
      "In witness whereof the parties hereto have caused this agreement to be executed as of the date(s) written below.",
      PAGE.margin,
      y,
      { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }
    );
  y += 60;

  // ===== NAME/COMPANY FIELDS =====
  // Two columns: Client fields on LEFT, Scan2Plan info on RIGHT
  const colWidth = 220;
  const colGap = 80;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colWidth + colGap;
  const fieldSpacing = 28;

  // ----- NAME ROW -----
  // Left: "Name" label for client (empty field)
  doc.font("Roboto").fontSize(bodyTextSize).fillColor("#000000").text("Name", leftX, y);
  // Right: "Vishwanath Bush" for Scan2Plan
  doc.font("Roboto").fontSize(bodyTextSize).fillColor("#000000").text("Vishwanath Bush", rightX, y);

  y += fieldSpacing;

  // ----- COMPANY ROW -----
  // Left: "Company" label for client (empty field)
  doc.font("Roboto").fontSize(bodyTextSize).fillColor("#000000").text("Company", leftX, y);
  // Right: "Scan2Plan, Inc." for Scan2Plan
  doc.font("Roboto").fontSize(bodyTextSize).fillColor("#000000").text("Scan2Plan, Inc.", rightX, y);

  renderFooter(doc);
}

/**
 * Page 6: Capabilities Page
 * Matches ProposalCapabilitiesPage.tsx exactly
 */
function renderCapabilitiesPage(doc: PDFKit.PDFDocument): void {
  const topPadding = 56;
  let y = topPadding;

  // Spacing constants (tightened by half)
  const SPACING = {
    sectionGap: 10,      // space between sections (halved from 20)
    bulletGap: 1,        // space between bullets (halved from 2)
    nestedBulletGap: 1,  // space between nested bullets (halved from 2)
    afterHeader: 4,      // space after section header (halved from 8)
    bulletIndent: 20,    // space from bullet to text (matching About page)
    nestedIndent: 40,    // nested bullet indent from margin
  };

  // Two column layout
  const colGap = 30;
  const colWidth = (PAGE.contentWidth - colGap) / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colWidth + colGap;

  // Title (3pts smaller than standard page title)
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle - 3)
    .fillColor(COLORS.primary)
    .text("Scan2Plan Capabilities", PAGE.margin, y);
  y += TYPOGRAPHY.afterPageTitle + 15;  // More spacing after main title

  // Target Audience paragraph - "Scan2Plan is for:" in black, professions in bold blue
  const introFontSize = TYPOGRAPHY.bodyText;
  doc
    .font("Roboto")
    .fontSize(introFontSize)
    .fillColor("#000000")
    .text("Scan2Plan is for: ", PAGE.margin, y, { continued: true });
  doc
    .font("Roboto-Bold")
    .fillColor(COLORS.primary)
    .text("Architects, Structural Engineers, MEP Engineers, Interior Designers, Property Managers, Owner/Operators, Landscape Architects, Civil Engineers.", { continued: false });
  y += 85;  // 15% reduced from 100

  let leftY = y;
  let rightY = y;

  // Helper to render bullet with proper indentation
  const bulletFontSize = TYPOGRAPHY.bulletText - 1;  // 1px smaller than standard (11px)
  const renderBullet = (text: string, x: number, yPos: number, isNested: boolean = false): number => {
    const bulletX = isNested ? x + 20 : x;  // Nested bullets indented 20px from parent
    const indent = SPACING.bulletIndent;
    const gap = isNested ? SPACING.nestedBulletGap : SPACING.bulletGap;

    doc.font("Roboto").fontSize(bulletFontSize).fillColor(TYPOGRAPHY.bulletColor);
    doc.text("•", bulletX, yPos + 1, { lineBreak: false });

    doc.fillColor("#000000");
    const textX = bulletX + indent;
    const textWidth = colWidth - (isNested ? 20 : 0) - indent;
    doc.text(text, textX, yPos, { width: textWidth, lineGap: 2 });
    return yPos + doc.heightOfString(text, { width: textWidth, lineGap: 2 }) + gap;
  };

  // Helper to render linked bullet (for LoD items)
  const renderLinkedBullet = (linkText: string, descText: string, url: string, x: number, yPos: number): number => {
    const bulletX = x + 20;  // Nested indent
    const indent = SPACING.bulletIndent;

    doc.font("Roboto").fontSize(bulletFontSize).fillColor(TYPOGRAPHY.bulletColor);
    doc.text("•", bulletX, yPos + 1, { lineBreak: false });

    const textX = bulletX + indent;
    const textWidth = colWidth - 20 - indent;

    // Blue underlined link text
    doc.fillColor(COLORS.primary);
    doc.text(linkText, textX, yPos, { continued: true, link: url, underline: true });
    // Black description text
    doc.fillColor("#000000");
    doc.text(descText, { continued: false, underline: false, width: textWidth, lineGap: 2 });

    return yPos + doc.heightOfString(linkText + descText, { width: textWidth, lineGap: 2 }) + SPACING.nestedBulletGap;
  };

  // Helper to render section header (bold blue, no underline, 3pts smaller)
  const sectionHeaderSize = TYPOGRAPHY.sectionHeading - 3;
  const renderSectionHeader = (text: string, x: number, yPos: number): number => {
    doc.font("Roboto-Bold").fontSize(sectionHeaderSize).fillColor(COLORS.primary);
    doc.text(text, x, yPos, { width: colWidth });
    return yPos + doc.heightOfString(text, { width: colWidth }) + SPACING.afterHeader;
  };

  // LEFT COLUMN - Scan-to-BIM
  leftY = renderSectionHeader("Scan-to-BIM", leftX, leftY);
  leftY = renderBullet("Architectural & Structural Existing Conditions Documentation.", leftX, leftY);
  leftY = renderBullet("Deliverables:", leftX, leftY);
  leftY = renderBullet("Revit Model", leftX, leftY, true);
  leftY = renderBullet("Colorized Point Cloud", leftX, leftY, true);
  leftY = renderBullet("360 Photo documentation", leftX, leftY, true);
  leftY = renderBullet("Standard Options:", leftX, leftY);
  leftY = renderLinkedBullet("LoD 200", " (Approximate Geometry)", "https://www.scan2plan.io/lod-200", leftX, leftY);
  leftY = renderLinkedBullet("LoD 300", " (Accurate Geometry)", "https://www.scan2plan.io/lod-300", leftX, leftY);
  leftY = renderLinkedBullet("LoD 350", " (Precise Geometry)", "https://www.scan2plan.io/lod-350", leftX, leftY);
  leftY = renderBullet("Level of Accuracy:", leftX, leftY);
  leftY = renderBullet('Point Cloud - 0" to 1/8"', leftX, leftY, true);
  leftY = renderBullet('Model - 0" to 1/2"', leftX, leftY, true);
  leftY = renderBullet("Turnaround: 2-5 weeks (depending on scope)", leftX, leftY);
  leftY = renderBullet("Pricing: is based on", leftX, leftY);
  leftY = renderBullet("A) Type of Building/Structure", leftX, leftY, true);
  leftY = renderBullet("B) LoD Standard", leftX, leftY, true);
  leftY = renderBullet("C) Square Footage", leftX, leftY, true);
  leftY += SPACING.sectionGap;

  // BIM to CAD Conversion
  leftY = renderSectionHeader("BIM to CAD Conversion", leftX, leftY);
  leftY = renderBullet("Pristine CAD drawings converted from Revit Model.", leftX, leftY);

  // RIGHT COLUMN - MEPF Modeling
  rightY = renderSectionHeader("MEPF Modeling", rightX, rightY);
  rightY = renderBullet("Any exposed Mechanical, Electrical, Plumbing and Fire Safety elements documented in BIM or CAD.", rightX, rightY);
  rightY += SPACING.sectionGap;

  // Landscape
  rightY = renderSectionHeader("Landscape", rightX, rightY);
  rightY = renderBullet("Landscape, grounds, and urban spaces documented in BIM or CAD.", rightX, rightY);
  rightY = renderBullet("Georeferencing and forestry optional.", rightX, rightY);
  rightY += SPACING.sectionGap;

  // Matterport 3D Tour
  rightY = renderSectionHeader("Matterport 3D Tour", rightX, rightY);
  rightY = renderBullet("High resolution 360 photo documentation and virtual tour walkthrough. An excellent remote collaboration tool, easily shared and viewed on any mobile or desktop device.", rightX, rightY);
  rightY += SPACING.sectionGap;

  // Paper to BIM or CAD
  rightY = renderSectionHeader("Paper to BIM or CAD", rightX, rightY);
  rightY = renderBullet("Legacy 2D paper drawings converted to functional BIM or CAD documentation.", rightX, rightY);
  rightY += SPACING.sectionGap;

  // Model Only / Point Cloud Only
  rightY = renderSectionHeader("Model Only / Point Cloud Only", rightX, rightY);
  rightY = renderBullet("You work with our point cloud or we'll model from yours.", rightX, rightY);

  // Software Support at bottom (same size as intro line)
  const softwareY = Math.max(leftY, rightY) + 24;
  doc.font("Roboto").fontSize(introFontSize).fillColor("#000000").text("We support: ", PAGE.margin, softwareY, { continued: true });
  doc.font("Roboto-Bold").fillColor(COLORS.primary).text("Revit, AutoCAD, Sketchup, Rhino, Vectorworks, Solidworks, Chief Architect, ArchiCAD, Civil 3D", { continued: true });
  doc.font("Roboto").fillColor("#000000").text(", and others....", { continued: false });

  renderFooter(doc);
}

/**
 * Page 7: Difference Page
 * Matches ProposalDifferencePage.tsx exactly
 */
function renderDifferencePage(doc: PDFKit.PDFDocument): void {
  const topPadding = 56;
  let y = topPadding;
  const standardSpacing = 21;  // 21px spacing for first three elements (reduced by 3px)
  const columnSpacing = 34;    // 34px spacing before columns (increased by 10px)

  // Title
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("The Scan2Plan Difference", PAGE.margin, y);
  y += doc.heightOfString("The Scan2Plan Difference") + standardSpacing;

  // Subtitle (1px smaller)
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.sectionHeading - 1)
    .fillColor(COLORS.primary)
    .text("What to look for in a Scan-to-BIM partner.", PAGE.margin, y);
  y += doc.heightOfString("What to look for in a Scan-to-BIM partner.") + standardSpacing;

  // Intro paragraph (2px smaller)
  const intro = "In the evolving landscape of scanning and modeling, it's important to consider your options to find a service that aligns with your specific needs. Scan2Plan is committed to delivering quality and precision in this field. Here's a closer look at what sets us apart:";
  doc.font("Roboto").fontSize(TYPOGRAPHY.bodyText - 2).fillColor("#000000").text(intro, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
  y += doc.heightOfString(intro, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + columnSpacing;

  // Full descriptions matching WYSIWYG exactly
  const differencePoints = [
    {
      title: "High-Quality Data for Superior Results",
      description: "The accuracy of your models and drawings hinges on the quality of the underlying data. We capture all our point cloud data sets in full color, with significant overlap and redundancy. This meticulous approach maximizes point cloud density, leading to more accurate and detailed models.",
    },
    {
      title: "Precision with Terrestrial LiDAR",
      description: 'Different technologies like Drones, SLAM scanners, Solid State LiDAR, or Photogrammetry offer varied results. We have chosen high-end terrestrial LiDAR for its unparalleled accuracy. Using the Trimble X7 scanner for every project, we guarantee consistent millimeter accuracy. Our process includes thorough validation of the Point Cloud, ensuring precision from 0" to 1/8".',
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

  // Two column layout - 4 left, 5 right (Rigorous Quality Control moves to right)
  const colGap = 30;
  const colWidth = (PAGE.contentWidth - colGap) / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colWidth + colGap;

  const leftItems = differencePoints.slice(0, 4);
  const rightItems = differencePoints.slice(4);

  // Render function for a single point
  const renderPoint = (point: { title: string; description: string }, x: number, currentY: number): number => {
    const bulletIndent = 12;  // Space after bullet for inline title
    const titleWidth = colWidth - bulletIndent;

    // Bullet and Title inline (bullet + space + bold blue title)
    doc.font("Roboto").fontSize(10).fillColor(TYPOGRAPHY.bulletColor);
    doc.text("• ", x, currentY, { continued: true });
    doc.font("Roboto-Bold").fontSize(10).fillColor(COLORS.primary);
    doc.text(point.title, { width: titleWidth, continued: false });
    const titleHeight = doc.heightOfString("• " + point.title, { width: colWidth }) + 2;

    // Description (regular, black) - no indent, starts at x
    doc.font("Roboto").fontSize(9).fillColor("#000000");
    doc.text(point.description, x, currentY + titleHeight, { width: colWidth, lineGap: 2 });
    const descHeight = doc.heightOfString(point.description, { width: colWidth, lineGap: 2 });

    return titleHeight + descHeight + 8; // spacing between items
  };

  // Render left column
  let leftY = y;
  leftItems.forEach((point) => {
    const height = renderPoint(point, leftX, leftY);
    leftY += height;
  });

  // Render right column
  let rightY = y;
  rightItems.forEach((point) => {
    const height = renderPoint(point, rightX, rightY);
    rightY += height;
  });

  renderFooter(doc);
}

/**
 * Pages 8-10: BIM Standards
 * Matches ProposalBIMStandards.tsx
 */
function renderBIMStandardsPages(doc: PDFKit.PDFDocument): void {
  const images = [
    "2024-modelling-standards-1.jpg",
    "2024-modelling-standards-2.jpg",
    "2024-modelling-standards-3.jpg",
  ];

  images.forEach((imageName, index) => {
    // Add a new page for each BIM standards image
    doc.addPage();

    const imagePath = path.join(process.cwd(), "client", "public", imageName);

    if (fs.existsSync(imagePath)) {
      doc.image(imagePath, 0, 0, {
        fit: [PAGE.width, PAGE.height],
        align: "center",
        valign: "center",
      });
    } else {
      doc
        .font("Roboto")
        .fontSize(12)
        .fillColor(COLORS.textMuted)
        .text(`BIM Standards Page ${index + 1}`, PAGE.margin, PAGE.height / 2, {
          width: PAGE.contentWidth,
          align: "center",
        });
    }
  });
}

/**
 * Certificate of Signature Page
 * Professional audit trail page showing both signatures with timestamps
 * DocuSeal-inspired design with improved formatting
 */
function renderCertificateOfSignature(
  doc: PDFKit.PDFDocument,
  auditTrail: SignatureAuditTrail
): void {
  // Professional color scheme
  const CERT_COLORS = {
    border: "#10b981", // Emerald green (DocuSeal brand color)
    borderLight: "#d1fae5", // Light emerald
    title: "#064e3b", // Dark emerald for title
    sectionHeader: "#059669", // Medium emerald for headers
    label: "#6b7280", // Gray for labels
    value: "#111827", // Near black for values
    background: "#f0fdf4", // Very light green background
  };

  // Draw professional border with double line effect
  doc.rect(15, 15, PAGE.width - 30, PAGE.height - 30).lineWidth(2).stroke(CERT_COLORS.border);
  doc.rect(25, 25, PAGE.width - 50, PAGE.height - 50).lineWidth(0.5).stroke(CERT_COLORS.borderLight);

  let y = 55;

  // Title - rendered as single centered text to avoid formatting issues
  doc.font("Roboto-Bold").fontSize(24).fillColor(CERT_COLORS.title);
  doc.text("CERTIFICATE OF SIGNATURE", PAGE.margin, y, { align: "center", width: PAGE.contentWidth });

  y += 35;

  // Subtitle/branding line
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.sectionHeader);
  doc.text("Electronic Signature Verification Document", PAGE.margin, y, { align: "center", width: PAGE.contentWidth });

  y += 30;

  // Reference info bar
  const col1X = PAGE.margin + 15;
  const col2X = PAGE.margin + 170;
  const col3X = PAGE.margin + 340;

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("REFERENCE NUMBER", col1X, y);
  doc.text("DOCUMENT COMPLETED", PAGE.width - PAGE.margin - 140, y, { width: 130, align: "right" });
  y += 12;

  doc.font("Roboto-Bold").fontSize(10).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.certificateRefNumber || "N/A", col1X, y);

  if (auditTrail.documentCompletedAt) {
    const completedDate = new Date(auditTrail.documentCompletedAt);
    const dateStr = completedDate.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
    const timeStr = completedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    doc.text(`${dateStr} ${timeStr} UTC`, PAGE.width - PAGE.margin - 140, y, { width: 130, align: "right" });
  }

  y += 25;

  // Column headers with section divider
  drawLine(doc, col1X, y, PAGE.width - PAGE.margin - 15, y, CERT_COLORS.border);
  y += 15;

  doc.font("Roboto-Bold").fontSize(9).fillColor(CERT_COLORS.sectionHeader);
  doc.text("SIGNER", col1X, y);
  doc.text("ACTIVITY", col2X, y);
  doc.text("SIGNATURE", col3X, y);

  y += 18;
  drawLine(doc, col1X, y, PAGE.width - PAGE.margin - 15, y, CERT_COLORS.borderLight);
  y += 15;

  // Helper function to format timestamp
  const formatTimestamp = (date?: Date | string): string => {
    if (!date) return "—";
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    return `${dateStr} ${timeStr}`;
  };

  // ===== SENDER (Scan2Plan) SECTION =====
  const senderStartY = y;

  doc.font("Roboto-Bold").fontSize(10).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.senderName?.toUpperCase() || "SCAN2PLAN REPRESENTATIVE", col1X, y);
  y += 14;

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("EMAIL", col1X, y);
  y += 10;
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.senderEmail || "—", col1X, y);

  // Activity column for sender (timestamps)
  let activityY = senderStartY;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SENT", col2X, activityY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.senderSentAt), col2X, activityY + 10);

  activityY += 26;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("VIEWED", col2X, activityY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.senderViewedAt), col2X, activityY + 10);

  activityY += 26;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SIGNED", col2X, activityY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.senderSignedAt), col2X, activityY + 10);

  // Sender signature image
  if (auditTrail.senderSignatureImage) {
    try {
      const base64Data = auditTrail.senderSignatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      // Draw clean border around signature
      doc.rect(col3X, senderStartY, 130, 45).lineWidth(0.5).stroke(CERT_COLORS.borderLight);
      doc.image(signatureBuffer, col3X + 5, senderStartY + 3, { width: 120, height: 39 });
    } catch (error) {
      console.warn("[Certificate PDF] Could not embed sender signature:", error);
    }
  }

  // IP Address for sender
  if (auditTrail.senderIpAddress) {
    doc.font("Roboto").fontSize(7).fillColor(CERT_COLORS.label);
    doc.text(`IP: ${auditTrail.senderIpAddress}`, col3X, senderStartY + 52);
  }

  y = senderStartY + 85;

  // Section divider
  drawLine(doc, col1X, y, PAGE.width - PAGE.margin - 15, y, CERT_COLORS.border);
  y += 15;

  // ===== RECIPIENT VERIFICATION SECTION =====
  doc.font("Roboto-Bold").fontSize(9).fillColor(CERT_COLORS.sectionHeader);
  doc.text("RECIPIENT VERIFICATION", col1X, y);
  y += 18;

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("The recipient accessed this document via a unique secure link sent to their email,", col1X, y);
  y += 12;
  doc.text("providing verification of their identity.", col1X, y);
  y += 20;

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("EMAIL VERIFIED", col2X, y);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientViewedAt), col2X, y + 10);

  y += 35;
  drawLine(doc, col1X, y, PAGE.width - PAGE.margin - 15, y, CERT_COLORS.border);
  y += 15;

  // ===== CLIENT SECTION =====
  const clientStartY = y;

  doc.font("Roboto-Bold").fontSize(10).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.clientName?.toUpperCase() || "CLIENT", col1X, y);
  y += 14;

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("EMAIL", col1X, y);
  y += 10;
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.clientEmail || "—", col1X, y);
  y += 14;

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SHARED VIA", col1X, y);
  y += 10;
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.sectionHeader);
  doc.text("SECURE LINK", col1X, y);

  // Activity column for client (timestamps)
  activityY = clientStartY;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SENT", col2X, activityY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientSentAt), col2X, activityY + 10);

  activityY += 26;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("VIEWED", col2X, activityY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientViewedAt), col2X, activityY + 10);

  activityY += 26;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SIGNED", col2X, activityY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientSignedAt), col2X, activityY + 10);

  // Client signature image
  if (auditTrail.clientSignatureImage) {
    try {
      const base64Data = auditTrail.clientSignatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      doc.rect(col3X, clientStartY, 130, 45).lineWidth(0.5).stroke(CERT_COLORS.borderLight);
      doc.image(signatureBuffer, col3X + 5, clientStartY + 3, { width: 120, height: 39 });
    } catch (error) {
      console.warn("[Certificate PDF] Could not embed client signature:", error);
    }
  }

  // Client IP Address
  if (auditTrail.clientIpAddress) {
    doc.font("Roboto").fontSize(7).fillColor(CERT_COLORS.label);
    doc.text(`IP: ${auditTrail.clientIpAddress}`, col3X, clientStartY + 52);
  }

  // Client location
  if (auditTrail.clientLocation) {
    doc.font("Roboto").fontSize(7).fillColor(CERT_COLORS.label);
    doc.text(`Location: ${auditTrail.clientLocation}`, col3X, clientStartY + 62);
  }

  // Footer with branding
  const footerY = PAGE.height - 55;

  // Branding line
  drawLine(doc, col1X, footerY - 10, PAGE.width - PAGE.margin - 15, footerY - 10, CERT_COLORS.borderLight);

  // DocuSeal-style footer branding
  doc.font("Roboto-Bold").fontSize(8).fillColor(CERT_COLORS.sectionHeader);
  doc.text("Powered by Scan2Plan eSignature", col1X, footerY);

  doc.font("Roboto").fontSize(7).fillColor(CERT_COLORS.label);
  doc.text("This document was electronically signed using a secure digital signature process.", col1X, footerY + 12);
  doc.text("The signature is legally binding under the ESIGN Act and UETA.", col1X, footerY + 22);

  // Page indicator
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("CERTIFICATE PAGE", PAGE.width - PAGE.margin - 100, footerY, { width: 90, align: "right" });
}

/**
 * Main PDF generation function
 * Takes WYSIWYG proposal data and generates matching PDF
 */
export async function generateWYSIWYGPdf(
  data: WYSIWYGProposalData
): Promise<PDFKit.PDFDocument> {
  // Debug logging
  console.log("[WYSIWYG PDF] Generating PDF with data:", {
    id: data.id,
    leadId: data.leadId,
    lineItemsCount: data.lineItems?.length || 0,
    lineItems: data.lineItems?.map(i => ({ name: i.itemName, qty: i.qty, amount: i.amount })),
    coverData: data.coverData,
    total: data.total,
  });

  const doc = new PDFDocument({
    size: "letter",
    margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
    bufferPages: true,
  });

  // Register Roboto fonts (matching Google Docs style)
  // If fonts fail to load, fall back to Helvetica (built-in)
  let useRoboto = false;
  try {
    if (fs.existsSync(FONTS.regular) && fs.existsSync(FONTS.bold)) {
      console.log("[WYSIWYG PDF] Font paths found:", FONTS.regular, FONTS.bold);
      doc.registerFont("Roboto", FONTS.regular);
      doc.registerFont("Roboto-Bold", FONTS.bold);
      // Test that fonts actually work by using them
      doc.font("Roboto").fontSize(10);
      doc.font("Roboto-Bold").fontSize(10);
      useRoboto = true;
      console.log("[WYSIWYG PDF] Roboto fonts registered and validated successfully");
    } else {
      console.warn("[WYSIWYG PDF] Roboto font files not found at:", FONTS.regular, FONTS.bold);
    }
  } catch (error) {
    console.warn("[WYSIWYG PDF] Failed to use Roboto fonts, switching to Helvetica:", error);
    useRoboto = false;
  }

  // If Roboto failed, use built-in Helvetica by registering aliases
  if (!useRoboto) {
    console.log("[WYSIWYG PDF] Using Helvetica fallback fonts");
    try {
      // Create font aliases pointing to built-in Helvetica
      doc.registerFont("Roboto", "Helvetica");
      doc.registerFont("Roboto-Bold", "Helvetica-Bold");
      // Test the aliases work
      doc.font("Roboto").fontSize(10);
      doc.font("Roboto-Bold").fontSize(10);
      console.log("[WYSIWYG PDF] Helvetica aliases registered successfully");
    } catch (aliasError) {
      console.error("[WYSIWYG PDF] Failed to register Helvetica aliases:", aliasError);
      // Last resort - just use Helvetica directly (will cause errors if Roboto is referenced)
      doc.font("Helvetica");
    }
  }

  // Page 1: Cover
  renderCoverPage(doc, data.coverData);

  // Page 2: About
  doc.addPage();
  renderAboutPage(doc);

  // Page 3: Project
  doc.addPage();
  renderProjectPage(doc, data.projectData);

  // Page 4: Estimate
  // Use rolled-up line items if displaySettings.rollupByDiscipline is enabled
  const estimateLineItems = data.displaySettings?.rollupByDiscipline
    ? rollupLineItemsByDiscipline(data.lineItems)
    : data.lineItems;
  doc.addPage();
  renderEstimatePage(doc, estimateLineItems, data.coverData, data.leadId, data.total);

  // Page 5: Payment (with dual signatures if provided)
  doc.addPage();
  renderPaymentPage(doc, data.paymentData, data.signatureData, data.senderSignatureData);

  // Page 6: Capabilities
  doc.addPage();
  renderCapabilitiesPage(doc);

  // Page 7: Difference
  doc.addPage();
  renderDifferencePage(doc);

  // Pages 8-10: BIM Standards (function adds its own pages)
  renderBIMStandardsPages(doc);

  // Certificate of Signature page (only if both parties have signed and audit trail is provided)
  if (data.auditTrail && data.signatureData?.signedAt && data.senderSignatureData?.signedAt) {
    doc.addPage();
    renderCertificateOfSignature(doc, data.auditTrail);
  }

  return doc;
}
