/**
 * PDF Rendering Helpers
 *
 * Utility functions for rendering consistent elements in proposal PDFs
 */

import PDFDocument from "pdfkit";

// Brand colors
export const COLORS = {
  primary: "#2563eb",
  primaryDark: "#1e40af",
  text: "#1a1a2e",
  textLight: "#4b5563",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  background: "#f8fafc",
  backgroundAlt: "#f9fafb",
  white: "#ffffff",
  green: "#10b981",
} as const;

// Page dimensions (Letter size)
export const PAGE = {
  width: 612,
  height: 792,
  margin: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50,
  },
  contentWidth: 512, // 612 - 50 - 50
} as const;

/**
 * Format currency value
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format currency with cents
 */
export function formatCurrencyWithCents(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format number with commas
 */
export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Draw horizontal line
 */
export function drawLine(
  doc: PDFKit.PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options?: {
    color?: string;
    lineWidth?: number;
  }
): void {
  doc
    .moveTo(x1, y1)
    .lineTo(x2, y2)
    .strokeColor(options?.color || COLORS.border)
    .lineWidth(options?.lineWidth || 1)
    .stroke();
}

/**
 * Draw filled rectangle
 */
export function drawRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: {
    fillColor?: string;
    strokeColor?: string;
    lineWidth?: number;
  }
): void {
  if (options?.fillColor) {
    doc.rect(x, y, width, height).fillColor(options.fillColor).fill();
  }
  if (options?.strokeColor) {
    doc
      .rect(x, y, width, height)
      .strokeColor(options.strokeColor)
      .lineWidth(options?.lineWidth || 1)
      .stroke();
  }
}

/**
 * Render section heading
 */
export function renderSectionHeading(
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
  options?: {
    fontSize?: number;
    color?: string;
    marginBottom?: number;
  }
): number {
  doc
    .font("Helvetica-Bold")
    .fontSize(options?.fontSize || 14)
    .fillColor(options?.color || COLORS.text)
    .text(text, PAGE.margin.left, y);

  return y + (options?.marginBottom || 20);
}

/**
 * Render paragraph
 */
export function renderParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
  options?: {
    fontSize?: number;
    color?: string;
    lineGap?: number;
    indent?: number;
    width?: number;
  }
): number {
  const fontSize = options?.fontSize || 10;
  const lineGap = options?.lineGap || 4;
  const indent = options?.indent || 0;
  const width = options?.width || PAGE.contentWidth - indent;

  doc
    .font("Helvetica")
    .fontSize(fontSize)
    .fillColor(options?.color || COLORS.text)
    .text(text, PAGE.margin.left + indent, y, {
      width,
      lineGap,
    });

  // Calculate height of text block
  const lines = Math.ceil(text.length / (width / (fontSize * 0.6)));
  const height = lines * (fontSize + lineGap);

  return y + height + 10;
}

/**
 * Render bullet list
 */
export function renderBulletList(
  doc: PDFKit.PDFDocument,
  items: string[],
  y: number,
  options?: {
    fontSize?: number;
    color?: string;
    bulletChar?: string;
    indent?: number;
  }
): number {
  const fontSize = options?.fontSize || 10;
  const bulletChar = options?.bulletChar || "•";
  const indent = options?.indent || 20;
  const lineHeight = fontSize + 6;

  doc
    .font("Helvetica")
    .fontSize(fontSize)
    .fillColor(options?.color || COLORS.text);

  items.forEach((item) => {
    // Bullet
    doc.text(bulletChar, PAGE.margin.left + indent, y);

    // Text
    doc.text(item, PAGE.margin.left + indent + 15, y, {
      width: PAGE.contentWidth - indent - 15,
    });

    y += lineHeight;
  });

  return y + 10;
}

/**
 * Render table
 */
export interface TableColumn {
  header: string;
  key: string;
  width: number;
  align?: "left" | "center" | "right";
}

export interface TableRow {
  [key: string]: string | number;
}

export function renderTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: TableRow[],
  y: number,
  options?: {
    headerBg?: string;
    rowAltBg?: string;
    fontSize?: number;
    headerFontSize?: number;
    rowHeight?: number;
    headerHeight?: number;
  }
): number {
  const fontSize = options?.fontSize || 9;
  const headerFontSize = options?.headerFontSize || 10;
  const rowHeight = options?.rowHeight || 18;
  const headerHeight = options?.headerHeight || 22;
  const startX = PAGE.margin.left;

  // Header background
  if (options?.headerBg) {
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    drawRect(doc, startX, y, totalWidth, headerHeight, {
      fillColor: options.headerBg,
    });
  }

  // Header text
  doc.font("Helvetica-Bold").fontSize(headerFontSize).fillColor(COLORS.text);
  let x = startX;
  columns.forEach((col) => {
    doc.text(col.header, x + 5, y + 6, {
      width: col.width - 10,
      align: col.align || "left",
    });
    x += col.width;
  });

  y += headerHeight;

  // Rows
  doc.font("Helvetica").fontSize(fontSize);
  rows.forEach((row, idx) => {
    // Alternating background
    if (options?.rowAltBg && idx % 2 === 0) {
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
      drawRect(doc, startX, y, totalWidth, rowHeight, {
        fillColor: options.rowAltBg,
      });
    }

    // Row text
    x = startX;
    columns.forEach((col) => {
      const value = row[col.key]?.toString() || "";
      doc.text(value, x + 5, y + 4, {
        width: col.width - 10,
        align: col.align || "left",
      });
      x += col.width;
    });

    y += rowHeight;
  });

  return y + 10;
}

/**
 * Render key-value pair
 */
export function renderKeyValue(
  doc: PDFKit.PDFDocument,
  key: string,
  value: string,
  y: number,
  options?: {
    keyWidth?: number;
    fontSize?: number;
    keyColor?: string;
    valueColor?: string;
  }
): number {
  const keyWidth = options?.keyWidth || 100;
  const fontSize = options?.fontSize || 10;

  doc
    .font("Helvetica-Bold")
    .fontSize(fontSize)
    .fillColor(options?.keyColor || COLORS.textLight)
    .text(key, PAGE.margin.left, y, { width: keyWidth });

  doc
    .font("Helvetica")
    .fontSize(fontSize)
    .fillColor(options?.valueColor || COLORS.text)
    .text(value, PAGE.margin.left + keyWidth, y, {
      width: PAGE.contentWidth - keyWidth,
    });

  return y + fontSize + 6;
}

/**
 * Check if we need a new page
 */
export function checkPageBreak(
  doc: PDFKit.PDFDocument,
  currentY: number,
  requiredSpace: number
): number {
  const bottomMargin = PAGE.height - PAGE.margin.bottom;
  if (currentY + requiredSpace > bottomMargin) {
    doc.addPage();
    return PAGE.margin.top;
  }
  return currentY;
}

/**
 * Render footer on current page
 */
export function renderFooter(
  doc: PDFKit.PDFDocument,
  text: string,
  pageNumber?: number
): void {
  const footerY = PAGE.height - 30;

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.textMuted)
    .text(text, PAGE.margin.left, footerY, {
      width: PAGE.contentWidth,
      align: "center",
    });

  if (pageNumber) {
    doc.text(
      `Page ${pageNumber}`,
      PAGE.margin.left,
      footerY + 10,
      {
        width: PAGE.contentWidth,
        align: "center",
      }
    );
  }
}

/**
 * Wrap text to calculate height
 */
export function calculateTextHeight(
  text: string,
  fontSize: number,
  width: number,
  lineGap: number = 4
): number {
  const charWidth = fontSize * 0.6; // Approximate
  const charsPerLine = Math.floor(width / charWidth);
  const lines = Math.ceil(text.length / charsPerLine);
  return lines * (fontSize + lineGap);
}
