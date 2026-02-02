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
const FONTS = {
  regular: path.join(process.cwd(), "server", "fonts", "Roboto-Regular.ttf"),
  bold: path.join(process.cwd(), "server", "fonts", "Roboto-Bold.ttf"),
};
import type {
  ProposalCoverData,
  ProposalProjectData,
  ProposalPaymentData,
  ProposalLineItem,
} from "@shared/schema/types";

// Colors matching WYSIWYG exactly
const COLORS = {
  primary: "#123da7",
  headerBg: "#e8f0fe",  // Light blue table header
  text: "#1f2937",       // gray-800
  textLight: "#4b5563",  // gray-600
  textMuted: "#6b7280",  // gray-500
  border: "#d1d5db",     // gray-300
  borderLight: "#e5e7eb", // gray-200
  white: "#ffffff",
};

// Page dimensions (Letter size)
const PAGE = {
  width: 612,
  height: 792,
  margin: 64, // p-16 = 64px
  contentWidth: 484, // 612 - 64*2
};

// Typography settings matching example proposals
const TYPOGRAPHY = {
  // Font sizes
  pageTitle: 28,        // "About Scan2Plan", "The Project", etc.
  sectionHeading: 18,   // "Overview", "Scope of Work", etc.
  subtitle: 20,         // "Laser Scanning & Building Documentation"
  bodyText: 11,         // Regular paragraph text
  bulletText: 11,       // Bullet list items
  smallText: 10,        // Contact info, footer
  tableHeader: 9,       // Table column headers

  // Line spacing
  bodyLineGap: 5,       // Space between lines in paragraphs
  bulletLineGap: 4,     // Space between lines within a bullet item

  // Vertical spacing
  afterPageTitle: 40,   // Space after main page title
  afterSectionHeading: 24, // Space after section headings
  betweenParagraphs: 18,   // Space between paragraphs
  betweenBullets: 10,      // Space between bullet items
  beforeSection: 24,       // Space before new section
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
export interface WYSIWYGProposalData {
  id: number;
  leadId: number;
  coverData: ProposalCoverData;
  projectData: ProposalProjectData;
  lineItems: ProposalLineItem[];
  paymentData: ProposalPaymentData;
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
  // Position footer well within page bounds - PAGE.height is 792, margin is 64
  // Safe zone ends at 728 (792 - 64), so we place footer at 700 to be safe
  const footerY = 700;
  drawLine(doc, PAGE.margin, footerY - 12, PAGE.width - PAGE.margin, footerY - 12, COLORS.borderLight);

  doc
    .font("Roboto")
    .fontSize(8)
    .fillColor(COLORS.textMuted)
    .text(
      "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io",
      PAGE.margin,
      footerY,
      { width: PAGE.contentWidth, align: "center", lineBreak: false }
    );
}

/**
 * Page 1: Cover Page
 * Matches ProposalCoverPage.tsx exactly
 */
function renderCoverPage(doc: PDFKit.PDFDocument, data: ProposalCoverData): void {
  const centerX = PAGE.width / 2;
  let y = PAGE.margin;

  // Logo (includes Scan2Plan text and tagline)
  const logoPath = path.join(process.cwd(), "client", "public", "logo-cover.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, centerX - 96, y, { width: 192 });
    y += 160; // Logo is tall - includes text and tagline
  } else {
    y += 60;
  }

  // Company contact info (below the logo)
  doc
    .font("Roboto")
    .fontSize(10)
    .fillColor(COLORS.textLight)
    .text("188 1st St, Troy, NY 12180", PAGE.margin, y, { width: PAGE.contentWidth, align: "center" });
  y += 14;
  doc.text("(518) 362-2403 / admin@scan2plan.io", PAGE.margin, y, { width: PAGE.contentWidth, align: "center" });
  y += 14;
  doc.text("www.scan2plan.io", PAGE.margin, y, { width: PAGE.contentWidth, align: "center" });

  // Middle section: "- PROPOSAL -" title
  y = PAGE.height / 2 - 80;
  doc
    .font("Roboto-Bold")
    .fontSize(36)
    .fillColor(COLORS.text)
    .text("- PROPOSAL -", PAGE.margin, y, {
      width: PAGE.contentWidth,
      align: "center",
      characterSpacing: 2,
    });

  // Subtitle: "Laser Scanning & Building Documentation"
  y += 55;
  doc
    .font("Roboto")
    .fontSize(TYPOGRAPHY.subtitle)
    .fillColor(COLORS.text)
    .text("Laser Scanning & Building Documentation", PAGE.margin, y, {
      width: PAGE.contentWidth,
      align: "center",
    });

  // Project Address (combines projectTitle and projectAddress)
  y += 35;
  const fullAddress = data.projectAddress
    ? `${data.projectTitle}, ${data.projectAddress}`
    : data.projectTitle;
  doc
    .font("Roboto")
    .fontSize(20)
    .fillColor(COLORS.text)
    .text(fullAddress || "", PAGE.margin, y, {
      width: PAGE.contentWidth,
      align: "center",
      lineGap: 4,
    });

  // Services Line or Area Scope Lines (if multiple areas)
  y += 35;
  const areaScopeLines = (data as any).areaScopeLines as string[] | undefined;
  if (areaScopeLines && areaScopeLines.length > 1) {
    // Multiple areas - show each on its own line
    doc.font("Roboto").fontSize(18).fillColor(COLORS.text);
    areaScopeLines.forEach((line) => {
      doc.text(line, PAGE.margin, y, { width: PAGE.contentWidth, align: "center" });
      y += 24;
    });
  } else {
    // Single service line
    doc
      .font("Roboto")
      .fontSize(18)
      .fillColor(COLORS.text)
      .text(data.servicesLine || "", PAGE.margin, y, {
        width: PAGE.contentWidth,
        align: "center",
      });
  }

  // Bottom section: Legal paragraph and footer
  // Footer at Y=700, legal text above it
  const footerY = 700;
  const legalY = footerY - 70; // 630

  const legalText = `Scan2Plan, Inc., a Delaware corporation ("S2P") hereby proposes to provide the services set forth below to ${data.clientName || "[Client Name]"}. Use of the services or the project deliverables described herein constitutes acceptance by the client. This Proposal is dated ${data.date || new Date().toLocaleDateString()}.`;

  doc
    .font("Roboto")
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(legalText, PAGE.margin, legalY, {
      width: PAGE.contentWidth,
      align: "left",
      lineGap: 4,
      lineBreak: false,
    });

  // Footer - well within page bounds
  drawLine(doc, PAGE.margin, footerY - 12, PAGE.width - PAGE.margin, footerY - 12, COLORS.borderLight);
  doc
    .font("Roboto")
    .fontSize(8)
    .fillColor(COLORS.textMuted)
    .text(
      "Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 • admin@scan2plan.io • scan2plan.io",
      PAGE.margin,
      footerY,
      { width: PAGE.contentWidth, align: "center", lineBreak: false }
    );
}

/**
 * Page 2: About Page
 * Matches ProposalAboutPage.tsx exactly
 */
function renderAboutPage(doc: PDFKit.PDFDocument): void {
  let y = PAGE.margin;

  // Title with trademark symbol
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("About Scan2Plan", PAGE.margin, y, { continued: true });
  doc.font("Roboto").fontSize(14).text("\u00AE", { continued: false });
  y += TYPOGRAPHY.afterPageTitle;

  // About paragraphs matching example proposals
  doc.font("Roboto").fontSize(TYPOGRAPHY.bodyText).fillColor(COLORS.text);

  doc.text("We began in 2018 with a simple goal of helping firms ", PAGE.margin, y, {
    width: PAGE.contentWidth,
    lineGap: TYPOGRAPHY.bodyLineGap,
    continued: true
  });
  doc.font("Roboto-Bold").text("focus on design", {
    continued: true,
    underline: true
  });
  doc.font("Roboto").text(".", { continued: false, underline: false });
  y += 32;

  const para2 = "We're an on-demand LiDAR to BIM/CAD team that can model any building in weeks. This can be done within any scope, budget or schedule. We've scanned over 1,000 buildings (~10M sqft).";
  doc.font("Roboto").text(para2, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
  y += doc.heightOfString(para2, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + TYPOGRAPHY.betweenParagraphs;

  const para3 = "We use LiDAR scanners for 3D mapping with extreme accuracy. We deliver professionally drafted 3D BIM and 2D CAD for comprehensive existing conditions documentation. Our Point Cloud datasets serve as a verifiable single-source-of-truth for coordination and risk-mitigation across projects.";
  doc.text(para3, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
  y += doc.heightOfString(para3, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + 24;

  // Point Cloud Image
  const imagePath = path.join(process.cwd(), "client", "public", "point-cloud-building.jpg");
  if (fs.existsSync(imagePath)) {
    const imageWidth = 400;
    const imageX = (PAGE.width - imageWidth) / 2;
    doc.image(imagePath, imageX, y, { width: imageWidth, height: 160 });
    y += 180;
  } else {
    y += 20;
  }

  // Why Scan2Plan section
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("Why Scan2Plan?", PAGE.margin, y);
  y += TYPOGRAPHY.afterPageTitle;

  // Two column bullet list matching example proposals
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

  const colWidth = (PAGE.contentWidth - 30) / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colWidth + 30;

  doc.font("Roboto").fontSize(TYPOGRAPHY.bulletText).fillColor(COLORS.text);

  // Render both columns with proper spacing
  let leftY = y;
  let rightY = y;

  leftItems.forEach((item) => {
    doc.text(`\u2022  ${item}`, leftX, leftY, { width: colWidth, lineGap: TYPOGRAPHY.bulletLineGap });
    leftY += doc.heightOfString(`\u2022  ${item}`, { width: colWidth, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
  });

  rightItems.forEach((item) => {
    doc.text(`\u2022  ${item}`, rightX, rightY, { width: colWidth, lineGap: TYPOGRAPHY.bulletLineGap });
    rightY += doc.heightOfString(`\u2022  ${item}`, { width: colWidth, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
  });

  renderFooter(doc);
}

/**
 * Page 3: Project Page
 * Matches ProposalProjectPage.tsx
 */
function renderProjectPage(doc: PDFKit.PDFDocument, data: ProposalProjectData): void {
  let y = PAGE.margin;

  // Title
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("The Project", PAGE.margin, y);
  y += TYPOGRAPHY.afterPageTitle;

  // Overview
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.sectionHeading)
    .fillColor(COLORS.primary)
    .text("Overview", PAGE.margin, y);
  y += TYPOGRAPHY.afterSectionHeading;

  // Use overviewLine if set, otherwise fall back to legacy format
  const overviewText = data.overviewLine || `Service for ${data.overview || ""}`;
  doc
    .font("Roboto")
    .fontSize(TYPOGRAPHY.bodyText)
    .fillColor(COLORS.text)
    .text(overviewText, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
  y += doc.heightOfString(overviewText, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + TYPOGRAPHY.beforeSection;

  // Scope of Work
  if (data.scopeItems && data.scopeItems.length > 0) {
    doc
      .font("Roboto-Bold")
      .fontSize(TYPOGRAPHY.sectionHeading)
      .fillColor(COLORS.primary)
      .text("Scope of Work", PAGE.margin, y);
    y += TYPOGRAPHY.afterSectionHeading;

    doc.font("Roboto").fontSize(TYPOGRAPHY.bulletText).fillColor(COLORS.text);
    data.scopeItems.forEach((item) => {
      doc.text(`\u2022  ${item}`, PAGE.margin + 10, y, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap });
      y += doc.heightOfString(`\u2022  ${item}`, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
    });
    y += TYPOGRAPHY.beforeSection - TYPOGRAPHY.betweenBullets;
  }

  // Deliverables
  if (data.deliverables && data.deliverables.length > 0) {
    doc
      .font("Roboto-Bold")
      .fontSize(TYPOGRAPHY.sectionHeading)
      .fillColor(COLORS.primary)
      .text("Deliverables", PAGE.margin, y);
    y += TYPOGRAPHY.afterSectionHeading;

    doc.font("Roboto").fontSize(TYPOGRAPHY.bulletText).fillColor(COLORS.text);
    data.deliverables.forEach((item) => {
      doc.text(`\u2022  ${item}`, PAGE.margin + 10, y, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap });
      y += doc.heightOfString(`\u2022  ${item}`, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
    });
    y += TYPOGRAPHY.beforeSection - TYPOGRAPHY.betweenBullets;
  }

  // Timeline
  if (data.timelineIntro || (data.milestones && data.milestones.length > 0)) {
    doc
      .font("Roboto-Bold")
      .fontSize(TYPOGRAPHY.sectionHeading)
      .fillColor(COLORS.primary)
      .text("Timeline", PAGE.margin, y);
    y += TYPOGRAPHY.afterSectionHeading;

    if (data.timelineIntro) {
      doc
        .font("Roboto")
        .fontSize(TYPOGRAPHY.bodyText)
        .fillColor(COLORS.text)
        .text(data.timelineIntro, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
      y += doc.heightOfString(data.timelineIntro, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + TYPOGRAPHY.betweenParagraphs;
    }

    if (data.milestones && data.milestones.length > 0) {
      doc.font("Roboto").fontSize(TYPOGRAPHY.bulletText).fillColor(COLORS.text);
      data.milestones.forEach((item) => {
        doc.text(`\u2022  ${item}`, PAGE.margin + 10, y, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap });
        y += doc.heightOfString(`\u2022  ${item}`, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
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

  // Table - improved layout with combined description column
  const tableX = PAGE.margin;
  const colWidths = {
    description: 290,  // Combined item name and description
    qty: 50,
    rate: 60,
    amount: 84,  // Wider to prevent wrapping of large amounts
  };
  const tableWidth = colWidths.description + colWidths.qty + colWidths.rate + colWidths.amount;
  const headerHeight = 28;

  // Table header (solid blue background)
  doc.rect(tableX, y, tableWidth, headerHeight).fill(COLORS.primary);

  doc
    .font("Roboto-Bold")
    .fontSize(10)
    .fillColor(COLORS.white);

  let colX = tableX + 10;
  doc.text("ITEM", colX, y + 9);
  colX = tableX + colWidths.description;
  doc.text("QTY", colX, y + 9, { width: colWidths.qty - 8, align: "right" });
  colX += colWidths.qty;
  doc.text("RATE", colX, y + 9, { width: colWidths.rate - 8, align: "right" });
  colX += colWidths.rate;
  doc.text("AMOUNT", colX, y + 9, { width: colWidths.amount - 8, align: "right" });

  y += headerHeight;

  // Helper to render description with proper formatting (preserves line breaks and bullets)
  const renderFormattedDescription = (text: string, x: number, startY: number, width: number): number => {
    if (!text) return startY;

    const lines = text.split('\n');
    let currentY = startY;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        currentY += 6; // Empty line spacing
        return;
      }

      // Check if it's a bullet point
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        doc.font("Roboto").fontSize(8).fillColor(COLORS.textLight);
        const bulletText = trimmedLine.replace(/^[•\-\*]\s*/, '• ');
        doc.text(bulletText, x + 8, currentY, { width: width - 8, lineGap: 1 });
        currentY += doc.heightOfString(bulletText, { width: width - 8, lineGap: 1 }) + 2;
      } else if (trimmedLine.includes(':') && trimmedLine.length < 40) {
        // Section headers (like "Deliverables include:")
        doc.font("Roboto-Bold").fontSize(8).fillColor(COLORS.text);
        doc.text(trimmedLine, x, currentY, { width });
        currentY += doc.heightOfString(trimmedLine, { width }) + 3;
      } else {
        // Regular paragraph text
        doc.font("Roboto").fontSize(8).fillColor(COLORS.textLight);
        doc.text(trimmedLine, x, currentY, { width, lineGap: 1 });
        currentY += doc.heightOfString(trimmedLine, { width, lineGap: 1 }) + 2;
      }
    });

    return currentY;
  };

  // Table rows
  lineItems.forEach((item, index) => {
    const itemName = item.itemName || "";
    const description = item.description || "";

    // Calculate row height based on content
    doc.font("Roboto-Bold").fontSize(10);
    const nameHeight = doc.heightOfString(itemName, { width: colWidths.description - 24 });

    // Estimate description height
    let descHeight = 0;
    if (description) {
      const lines = description.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
          descHeight += 6;
        } else {
          doc.font("Roboto").fontSize(8);
          descHeight += doc.heightOfString(trimmed, { width: colWidths.description - 32, lineGap: 1 }) + 2;
        }
      });
    }

    const actualRowHeight = Math.max(32, nameHeight + descHeight + 16);

    // Check if we need a new page
    if (y + actualRowHeight > PAGE.height - 150) {
      doc.addPage();
      y = PAGE.margin;
    }

    // Row background (alternate light gray)
    if (index % 2 === 1) {
      doc.rect(tableX, y, tableWidth, actualRowHeight).fill("#f9fafb");
    }

    // Row border
    drawLine(doc, tableX, y + actualRowHeight, tableX + tableWidth, y + actualRowHeight, COLORS.borderLight);

    // Description column (combined item name and description)
    const textX = tableX + 10;
    let textY = y + 8;

    // Item name (bold)
    doc.font("Roboto-Bold").fontSize(10).fillColor(COLORS.text);
    doc.text(itemName, textX, textY, { width: colWidths.description - 24 });
    textY += nameHeight + 4;

    // Description with proper formatting
    if (description) {
      renderFormattedDescription(description, textX, textY, colWidths.description - 24);
    }

    // Qty column
    doc.font("Roboto").fontSize(10).fillColor(COLORS.text);
    doc.text(formatNumber(item.qty || 0), tableX + colWidths.description, y + 8, {
      width: colWidths.qty - 8,
      align: "right",
    });

    // Rate column
    doc.text(formatCurrency(item.rate || 0), tableX + colWidths.description + colWidths.qty, y + 8, {
      width: colWidths.rate - 8,
      align: "right",
    });

    // Amount column
    doc.font("Roboto-Bold").fontSize(10).fillColor(COLORS.text);
    doc.text(formatCurrency(item.amount || 0), tableX + colWidths.description + colWidths.qty + colWidths.rate, y + 8, {
      width: colWidths.amount - 8,
      align: "right",
    });

    y += actualRowHeight;
  });

  y += 8;

  // Total row with background
  const totalRowHeight = 32;
  doc.rect(tableX, y, tableWidth, totalRowHeight).fill("#f3f4f6");

  doc
    .font("Roboto-Bold")
    .fontSize(11)
    .fillColor(COLORS.textLight)
    .text("TOTAL", tableX + colWidths.description + colWidths.qty, y + 9, {
      width: colWidths.rate - 8,
      align: "right",
    });

  doc
    .font("Roboto-Bold")
    .fontSize(14)
    .fillColor(COLORS.primary)
    .text(formatCurrency(total), tableX + colWidths.description + colWidths.qty + colWidths.rate, y + 8, {
      width: colWidths.amount,
      align: "right",
      lineBreak: false, // Prevent wrapping of total amount
    });

  y += totalRowHeight + 24;

  // Signature section
  doc
    .font("Roboto")
    .fontSize(9)
    .fillColor(COLORS.textMuted)
    .text("Accepted By", PAGE.margin, y);
  drawLine(doc, PAGE.margin, y + 24, PAGE.margin + 200, y + 24, COLORS.border);

  y += 40;
  doc.text("Accepted Date", PAGE.margin, y);
  drawLine(doc, PAGE.margin, y + 24, PAGE.margin + 200, y + 24, COLORS.border);

  y += 50;

  // Notes
  doc
    .font("Roboto")
    .fontSize(8)
    .fillColor(COLORS.textMuted)
    .text(
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
  let y = PAGE.margin;

  // Title - "Payment Terms" instead of just "Payment"
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("Payment Terms", PAGE.margin, y);
  y += TYPOGRAPHY.afterPageTitle;

  // Payment Terms bullets
  if (data.terms && data.terms.length > 0) {
    doc.font("Roboto").fontSize(TYPOGRAPHY.bulletText).fillColor(COLORS.text);
    data.terms.forEach((term) => {
      const bulletText = `\u2022  ${term}`;
      doc.text(bulletText, PAGE.margin + 10, y, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap });
      y += doc.heightOfString(bulletText, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
    });
  }
  y += TYPOGRAPHY.beforeSection - TYPOGRAPHY.betweenBullets;

  // Accepted Forms of Payment
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.sectionHeading)
    .fillColor(COLORS.primary)
    .text("Accepted Forms of Payment:", PAGE.margin, y);
  y += TYPOGRAPHY.afterSectionHeading;

  if (data.paymentMethods && data.paymentMethods.length > 0) {
    doc.font("Roboto").fontSize(TYPOGRAPHY.bulletText).fillColor(COLORS.text);
    data.paymentMethods.forEach((method, index) => {
      const numberedText = `${index + 1}. ${method}`;
      doc.text(numberedText, PAGE.margin + 10, y, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap });
      y += doc.heightOfString(numberedText, { width: PAGE.contentWidth - 20, lineGap: TYPOGRAPHY.bulletLineGap }) + TYPOGRAPHY.betweenBullets;
    });
  }
  y += TYPOGRAPHY.beforeSection;

  // Acknowledgement section
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.sectionHeading)
    .fillColor(COLORS.primary)
    .text("Acknowledgement:", PAGE.margin, y);
  y += TYPOGRAPHY.afterSectionHeading;

  // Acknowledgement text with T&C link reference
  const ackDate = signatureData?.signedAt
    ? new Date(signatureData.signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : data.acknowledgementDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  doc
    .font("Roboto")
    .fontSize(TYPOGRAPHY.bodyText)
    .fillColor(COLORS.text)
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
    .fillColor(COLORS.text)
    .text(` dated `, { continued: true, underline: false });
  doc
    .font("Roboto-Bold")
    .text(ackDate, { continued: false });

  y += 32;

  doc
    .font("Roboto")
    .fontSize(TYPOGRAPHY.bodyText)
    .fillColor(COLORS.text)
    .text(
      "which are incorporated herein by reference.",
      PAGE.margin,
      y,
      { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }
    );
  y += TYPOGRAPHY.betweenParagraphs;

  doc
    .font("Roboto")
    .fontSize(TYPOGRAPHY.bodyText)
    .fillColor(COLORS.text)
    .text(
      "In witness whereof the parties hereto have caused this agreement to be executed as of the date(s) written below.",
      PAGE.margin,
      y,
      { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }
    );
  y += 50;

  // ===== DUAL SIGNATURE SECTION =====
  // Two columns: Client on LEFT, Scan2Plan on RIGHT
  const colWidth = 200;
  const colGap = 84;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colWidth + colGap;

  // ----- CLIENT SIGNATURE (Left Column) -----
  // Signature image
  if (signatureData?.signatureImage) {
    try {
      const base64Data = signatureData.signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      doc.image(signatureBuffer, leftX, y, { width: 180, height: 45 });
    } catch (error) {
      console.warn("[WYSIWYG PDF] Could not embed client signature image:", error);
    }
  }

  // ----- SENDER SIGNATURE (Right Column) -----
  // Signature image
  if (senderSignatureData?.signatureImage) {
    try {
      const base64Data = senderSignatureData.signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      doc.image(signatureBuffer, rightX, y, { width: 180, height: 45 });
    } catch (error) {
      console.warn("[WYSIWYG PDF] Could not embed sender signature image:", error);
    }
  }

  y += 55;

  // Name row
  if (signatureData?.signerName) {
    doc.font("Roboto").fontSize(11).fillColor(COLORS.text).text(signatureData.signerName, leftX, y);
  }
  if (senderSignatureData?.signerName) {
    doc.font("Roboto").fontSize(11).fillColor(COLORS.text).text(senderSignatureData.signerName, rightX, y);
  }
  y += 16;

  // Label "Name"
  doc.font("Roboto").fontSize(9).fillColor(COLORS.textMuted).text("Name", leftX, y);
  doc.font("Roboto").fontSize(9).fillColor(COLORS.textMuted).text("", rightX, y); // No label on right for name
  y += 20;

  // Company row
  if (signatureData?.signerTitle) {
    // Use signerTitle as company for client
    doc.font("Roboto").fontSize(11).fillColor(COLORS.text).text(signatureData.signerTitle, leftX, y);
  }
  if (senderSignatureData?.signerTitle) {
    // Show "Scan2Plan, Inc." for sender
    doc.font("Roboto").fontSize(11).fillColor(COLORS.text).text("Scan2Plan, Inc.", rightX, y);
  }
  y += 16;

  // Label "Company"
  doc.font("Roboto").fontSize(9).fillColor(COLORS.textMuted).text("Company", leftX, y);
  doc.font("Roboto").fontSize(9).fillColor(COLORS.textMuted).text("Company", rightX, y);
  y += 20;

  // Date row
  if (signatureData?.signedAt) {
    const clientDate = new Date(signatureData.signedAt).toLocaleDateString("en-CA"); // YYYY-MM-DD format
    doc.font("Roboto").fontSize(11).fillColor(COLORS.text).text(clientDate, leftX, y);
  }
  if (senderSignatureData?.signedAt) {
    const senderDate = new Date(senderSignatureData.signedAt).toLocaleDateString("en-CA"); // YYYY-MM-DD format
    doc.font("Roboto").fontSize(11).fillColor(COLORS.text).text(senderDate, rightX, y);
  }

  renderFooter(doc);
}

/**
 * Page 6: Capabilities Page
 * Matches ProposalCapabilitiesPage.tsx exactly
 */
function renderCapabilitiesPage(doc: PDFKit.PDFDocument): void {
  let y = PAGE.margin;

  // Title
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("Scan2Plan Capabilities", PAGE.margin, y);
  y += TYPOGRAPHY.afterPageTitle;

  // Target Audience - "Scan2Plan is for:" in regular, professions in blue/bold
  doc
    .font("Roboto")
    .fontSize(TYPOGRAPHY.bodyText)
    .fillColor(COLORS.text)
    .text("Scan2Plan is for: ", PAGE.margin, y, { continued: true });
  doc
    .font("Roboto-Bold")
    .fillColor(COLORS.primary)
    .text("Architects, Structural Engineers, MEP Engineers, Interior Designers, Property Managers, Owner/Operators, Landscape Architects, Civil Engineers.", { continued: false });
  y += 50;

  // Two column layout
  const colWidth = (PAGE.contentWidth - 30) / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colWidth + 30;
  let leftY = y;
  let rightY = y;

  // Helper to render nested bullet lists
  const renderBullet = (text: string, x: number, yPos: number, indent: number = 0, fontSize: number = 9) => {
    doc.font("Roboto").fontSize(fontSize).fillColor(COLORS.text);
    const bulletX = x + indent;
    doc.text(`\u2022   ${text}`, bulletX, yPos, { width: colWidth - indent });
    return yPos + doc.heightOfString(`\u2022   ${text}`, { width: colWidth - indent }) + 3;
  };

  // Helper to render linked bullet items
  const renderLinkedBullet = (text: string, url: string, x: number, yPos: number, indent: number = 0, fontSize: number = 9) => {
    doc.font("Roboto").fontSize(fontSize).fillColor(COLORS.primary);
    const bulletX = x + indent;
    const bulletText = `\u2022   ${text}`;
    doc.text(bulletText, bulletX, yPos, {
      width: colWidth - indent,
      link: url,
      underline: true
    });
    return yPos + doc.heightOfString(bulletText, { width: colWidth - indent }) + 3;
  };

  // Helper to render section header
  const renderSectionHeader = (text: string, x: number, yPos: number) => {
    doc.font("Roboto-Bold").fontSize(13).fillColor(COLORS.text).text(text, x, yPos);
    return yPos + 16;
  };

  // LEFT COLUMN - Scan-to-BIM
  leftY = renderSectionHeader("Scan-to-BIM", leftX, leftY);
  leftY = renderBullet("Architectural & Structural Existing Conditions Documentation.", leftX, leftY);
  leftY = renderBullet("Deliverables:", leftX, leftY);
  leftY = renderBullet("Revit Model", leftX, leftY, 20, 8);
  leftY = renderBullet("Colorized Point Cloud", leftX, leftY, 20, 8);
  leftY = renderBullet("360 Photo documentation", leftX, leftY, 20, 8);
  leftY = renderBullet("Standard Options:", leftX, leftY);
  leftY = renderLinkedBullet("LoD 200 (Approximate Geometry)", "https://www.scan2plan.io/lod-200", leftX, leftY, 20, 8);
  leftY = renderLinkedBullet("LoD 300 (Accurate Geometry)", "https://www.scan2plan.io/lod-300", leftX, leftY, 20, 8);
  leftY = renderLinkedBullet("LoD 350 (Precise Geometry)", "https://www.scan2plan.io/lod-350", leftX, leftY, 20, 8);
  leftY = renderBullet("Level of Accuracy:", leftX, leftY);
  leftY = renderBullet('Point Cloud - 0" to 1/8"', leftX, leftY, 20, 8);
  leftY = renderBullet('Model - 0" to 1/2"', leftX, leftY, 20, 8);
  leftY = renderBullet("Turnaround: 2-5 weeks (depending on scope)", leftX, leftY);
  leftY = renderBullet("Pricing: is based on", leftX, leftY);
  leftY = renderBullet("A) Type of Building/Structure", leftX, leftY, 20, 8);
  leftY = renderBullet("B) LoD Standard", leftX, leftY, 20, 8);
  leftY = renderBullet("C) Square Footage", leftX, leftY, 20, 8);
  leftY += 12;

  // BIM to CAD
  leftY = renderSectionHeader("BIM to CAD Conversion", leftX, leftY);
  leftY = renderBullet("Pristine CAD drawings converted from Revit Model.", leftX, leftY);

  // RIGHT COLUMN - MEPF Modeling
  rightY = renderSectionHeader("MEPF Modeling", rightX, rightY);
  rightY = renderBullet("Any exposed Mechanical, Electrical, Plumbing and Fire Safety elements documented in BIM or CAD.", rightX, rightY);
  rightY += 12;

  // Landscape
  rightY = renderSectionHeader("Landscape", rightX, rightY);
  rightY = renderBullet("Landscape, grounds, and urban spaces documented in BIM or CAD.", rightX, rightY);
  rightY = renderBullet("Georeferencing and forestry optional.", rightX, rightY);
  rightY += 12;

  // Matterport
  rightY = renderSectionHeader("Matterport 3D Tour", rightX, rightY);
  rightY = renderBullet("High resolution 360 photo documentation and virtual tour walkthrough. An excellent remote collaboration tool, easily shared and viewed on any mobile or desktop device.", rightX, rightY);
  rightY += 12;

  // Paper to BIM
  rightY = renderSectionHeader("Paper to BIM or CAD", rightX, rightY);
  rightY = renderBullet("Legacy 2D paper drawings converted to functional BIM or CAD documentation.", rightX, rightY);
  rightY += 12;

  // Model Only
  rightY = renderSectionHeader("Model Only / Point Cloud Only", rightX, rightY);
  rightY = renderBullet("You work with our point cloud or we'll model from yours.", rightX, rightY);

  // Software Support at bottom
  const softwareY = Math.max(leftY, rightY) + 30;
  doc.font("Roboto").fontSize(10).fillColor(COLORS.text).text("We support: ", PAGE.margin, softwareY, { continued: true });
  doc.font("Roboto-Bold").fillColor(COLORS.primary).text("Revit, AutoCAD, Sketchup, Rhino, Vectorworks, Solidworks, Chief Architect, ArchiCAD, Civil 3D", { continued: true });
  doc.font("Roboto").fillColor(COLORS.text).text(", and others....", { continued: false });

  renderFooter(doc);
}

/**
 * Page 7: Difference Page
 * Matches ProposalDifferencePage.tsx exactly
 */
function renderDifferencePage(doc: PDFKit.PDFDocument): void {
  let y = PAGE.margin;

  // Title - matches WYSIWYG text-3xl
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.pageTitle)
    .fillColor(COLORS.primary)
    .text("The Scan2Plan Difference", PAGE.margin, y);
  y += 34;

  // Subtitle - matches WYSIWYG text-xl
  doc
    .font("Roboto-Bold")
    .fontSize(TYPOGRAPHY.sectionHeading)
    .fillColor(COLORS.primary)
    .text("What to look for in a Scan-to-BIM partner.", PAGE.margin, y);
  y += TYPOGRAPHY.afterSectionHeading;

  // Intro paragraph - matches WYSIWYG text-sm
  const intro = "In the evolving landscape of scanning and modeling, it's important to consider your options to find a service that aligns with your specific needs. Scan2Plan is committed to delivering quality and precision in this field. Here's a closer look at what sets us apart:";
  doc.font("Roboto").fontSize(TYPOGRAPHY.bodyText).fillColor(COLORS.text).text(intro, PAGE.margin, y, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap });
  y += doc.heightOfString(intro, { width: PAGE.contentWidth, lineGap: TYPOGRAPHY.bodyLineGap }) + TYPOGRAPHY.betweenParagraphs;

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

  // Two column layout - 5 left, 4 right (matching WYSIWYG)
  const colWidth = (PAGE.contentWidth - 30) / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colWidth + 30;

  const leftItems = differencePoints.slice(0, 5);
  const rightItems = differencePoints.slice(5);

  // Render function for a single point - matches WYSIWYG styling
  const renderPoint = (point: { title: string; description: string }, x: number, currentY: number): number => {
    // Title with bullet - matches WYSIWYG text-sm font-semibold text-gray-900
    doc.font("Roboto-Bold").fontSize(9).fillColor(COLORS.text);
    const titleText = `• ${point.title}`;
    doc.text(titleText, x, currentY, { width: colWidth });
    const titleHeight = doc.heightOfString(titleText, { width: colWidth }) + 2;

    // Description - matches WYSIWYG text-xs text-gray-600 pl-3
    doc.font("Roboto").fontSize(8).fillColor(COLORS.textLight);
    doc.text(point.description, x + 8, currentY + titleHeight, { width: colWidth - 8, lineGap: 1 });
    const descHeight = doc.heightOfString(point.description, { width: colWidth - 8, lineGap: 1 });

    return titleHeight + descHeight + 10; // spacing between items
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
 * PandaDoc-style audit trail page showing both signatures with timestamps
 */
function renderCertificateOfSignature(
  doc: PDFKit.PDFDocument,
  auditTrail: SignatureAuditTrail
): void {
  // Teal border/background color matching PandaDoc style
  const CERT_COLORS = {
    border: "#7dd3c0", // Teal/mint border
    background: "#f0fdf9", // Very light teal background
    title: "#1f2937", // Dark gray
    label: "#6b7280", // Gray for labels
    value: "#111827", // Near black for values
  };

  // Draw decorative border pattern (simplified version of PandaDoc's guilloché pattern)
  doc.rect(20, 20, PAGE.width - 40, PAGE.height - 40).lineWidth(3).stroke(CERT_COLORS.border);
  doc.rect(30, 30, PAGE.width - 60, PAGE.height - 60).lineWidth(1).stroke(CERT_COLORS.border);

  let y = 70;

  // Title: "CERTIFICATE of SIGNATURE"
  doc
    .font("Roboto-Bold")
    .fontSize(28)
    .fillColor(CERT_COLORS.title)
    .text("CERTIFICATE ", PAGE.margin + 20, y, { continued: true, align: "center", width: PAGE.contentWidth - 40 });
  doc
    .font("Roboto")
    .fontSize(28)
    .text("of ", { continued: true });
  doc
    .font("Roboto-Bold")
    .text("SIGNATURE", { continued: false });

  y += 50;

  // Reference number and completion date
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("REF. NUMBER", PAGE.margin + 20, y);
  doc.text("DOCUMENT COMPLETED BY ALL PARTIES ON", PAGE.width - PAGE.margin - 180, y, { width: 160, align: "right" });
  y += 12;

  doc.font("Roboto-Bold").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.certificateRefNumber || "N/A", PAGE.margin + 20, y);

  if (auditTrail.documentCompletedAt) {
    const completedDate = new Date(auditTrail.documentCompletedAt);
    const dateStr = completedDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
    const timeStr = completedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    doc.text(`${dateStr} ${timeStr}`, PAGE.width - PAGE.margin - 180, y, { width: 160, align: "right" });
    y += 12;
    doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label).text("UTC", PAGE.width - PAGE.margin - 180, y, { width: 160, align: "right" });
  }

  y += 30;

  // Column headers
  const col1X = PAGE.margin + 20; // SIGNER column
  const col2X = PAGE.margin + 180; // TIMESTAMP column
  const col3X = PAGE.margin + 330; // SIGNATURE column

  doc.font("Roboto-Bold").fontSize(9).fillColor(CERT_COLORS.label);
  doc.text("SIGNER", col1X, y);
  doc.text("TIMESTAMP", col2X, y);
  doc.text("SIGNATURE", col3X, y);

  y += 20;
  drawLine(doc, PAGE.margin + 20, y, PAGE.width - PAGE.margin - 20, y, CERT_COLORS.border);
  y += 20;

  // Helper function to format timestamp
  const formatTimestamp = (date?: Date | string): string => {
    if (!date) return "";
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    return `${dateStr} ${timeStr}`;
  };

  // ===== SENDER (Scan2Plan) SECTION =====
  doc.font("Roboto-Bold").fontSize(11).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.senderName?.toUpperCase() || "SCAN2PLAN REPRESENTATIVE", col1X, y);

  // Timestamps column for sender
  const senderTimestampsY = y;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SENT", col2X, senderTimestampsY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.senderSentAt), col2X, senderTimestampsY + 10);

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("VIEWED", col2X, senderTimestampsY + 28);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.senderViewedAt), col2X, senderTimestampsY + 38);

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SIGNED", col2X, senderTimestampsY + 56);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.senderSignedAt), col2X, senderTimestampsY + 66);

  // Sender signature image
  if (auditTrail.senderSignatureImage) {
    try {
      const base64Data = auditTrail.senderSignatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      // Draw border around signature
      doc.rect(col3X, y - 5, 140, 50).lineWidth(0.5).stroke(CERT_COLORS.border);
      doc.image(signatureBuffer, col3X + 5, y, { width: 130, height: 40 });
    } catch (error) {
      console.warn("[Certificate PDF] Could not embed sender signature:", error);
    }
  }

  // IP Address for sender
  y += 16;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("EMAIL", col1X, y);
  y += 10;
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.senderEmail || "", col1X, y);

  y += 30;
  if (auditTrail.senderIpAddress) {
    doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
    doc.text("IP ADDRESS", col3X, y);
    doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
    doc.text(auditTrail.senderIpAddress, col3X, y + 10);
  }

  y += 40;

  // Divider line
  drawLine(doc, PAGE.margin + 20, y, PAGE.width - PAGE.margin - 20, y, CERT_COLORS.border);
  y += 10;

  // Recipient Verification header
  doc.font("Roboto-Bold").fontSize(10).fillColor(CERT_COLORS.label);
  doc.text("RECIPIENT VERIFICATION", col1X, y);
  y += 20;

  // Email verified timestamp (same as viewed)
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("EMAIL VERIFIED", col2X, y);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientViewedAt), col2X, y + 10);

  y += 40;
  drawLine(doc, PAGE.margin + 20, y, PAGE.width - PAGE.margin - 20, y, CERT_COLORS.border);
  y += 20;

  // ===== CLIENT SECTION =====
  doc.font("Roboto-Bold").fontSize(11).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.clientName?.toUpperCase() || "CLIENT", col1X, y);

  // Timestamps column for client
  const clientTimestampsY = y;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SENT", col2X, clientTimestampsY);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientSentAt), col2X, clientTimestampsY + 10);

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("VIEWED", col2X, clientTimestampsY + 28);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientViewedAt), col2X, clientTimestampsY + 38);

  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SIGNED", col2X, clientTimestampsY + 56);
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(formatTimestamp(auditTrail.clientSignedAt), col2X, clientTimestampsY + 66);

  // Client signature image
  if (auditTrail.clientSignatureImage) {
    try {
      const base64Data = auditTrail.clientSignatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      doc.rect(col3X, y - 5, 140, 50).lineWidth(0.5).stroke(CERT_COLORS.border);
      doc.image(signatureBuffer, col3X + 5, y, { width: 130, height: 40 });
    } catch (error) {
      console.warn("[Certificate PDF] Could not embed client signature:", error);
    }
  }

  // Client info
  y += 16;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("EMAIL", col1X, y);
  y += 10;
  doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
  doc.text(auditTrail.clientEmail || "", col1X, y);

  y += 16;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("SHARED VIA", col1X, y);
  y += 10;
  doc.font("Roboto").fontSize(9).fillColor(COLORS.primary);
  doc.text("LINK", col1X, y, { underline: true });

  // Client IP and location
  y = clientTimestampsY + 80;
  if (auditTrail.clientIpAddress) {
    doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
    doc.text("IP ADDRESS", col3X, y);
    doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
    doc.text(auditTrail.clientIpAddress, col3X, y + 10);
    y += 28;
  }

  if (auditTrail.clientLocation) {
    doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
    doc.text("LOCATION", col3X, y);
    doc.font("Roboto").fontSize(9).fillColor(CERT_COLORS.value);
    doc.text(auditTrail.clientLocation.toUpperCase(), col3X, y + 10);
  }

  // Footer with branding
  const footerY = PAGE.height - 60;
  doc.font("Roboto").fontSize(8).fillColor(CERT_COLORS.label);
  doc.text("Signed with Scan2Plan", PAGE.margin + 20, footerY);
  doc.text("PAGE 1 OF 1", PAGE.width / 2 - 30, footerY);
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
  try {
    if (fs.existsSync(FONTS.regular) && fs.existsSync(FONTS.bold)) {
      doc.registerFont("Roboto", FONTS.regular);
      doc.registerFont("Roboto-Bold", FONTS.bold);
    } else {
      console.warn("[WYSIWYG PDF] Roboto fonts not found, using system fallback");
    }
  } catch (error) {
    console.warn("[WYSIWYG PDF] Failed to register fonts:", error);
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
  doc.addPage();
  renderEstimatePage(doc, data.lineItems, data.coverData, data.leadId, data.total);

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
