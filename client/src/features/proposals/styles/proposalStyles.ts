/**
 * Proposal Styles - Shared constants for WYSIWYG editor
 *
 * These values are derived from the PDF generator (wysiwygPdfGenerator.ts)
 * to ensure the WYSIWYG preview matches the final PDF output.
 *
 * DO NOT MODIFY without also checking PDF output remains consistent.
 */

// Colors extracted from PDF generator - MUST match wysiwygPdfGenerator.ts COLORS
export const PROPOSAL_COLORS = {
  primary: "#123ea8",      // Primary blue for headers/links (PDF uses rgb(18,62,168))
  headerBg: "#e8f0fe",     // Light blue table header background
  text: "#49494b",         // Dark gray body text (PDF uses rgb(73,73,75))
  textLight: "#434343",    // Secondary text (PDF uses rgb(67,67,67))
  textMuted: "#616161",    // Muted gray for footer (PDF uses rgb(97,97,97))
  border: "#d1d5db",       // gray-300 equivalent
  borderLight: "#e5e7eb",  // gray-200 equivalent
  white: "#ffffff",
  rowAlt: "#f9fafb",       // Alternating row background (gray-50)
  totalBg: "#f3f4f6",      // Total row background (gray-100)
};

// Typography - Converting PDF pt sizes to CSS
// PDF uses points, CSS uses pixels. 1pt ≈ 1.333px at 96dpi
export const PROPOSAL_TYPOGRAPHY = {
  // Font sizes (converted from PDF pt to px)
  pageTitle: "30px",       // 23pt in PDF
  sectionHeading: "21px",  // 16pt in PDF
  subtitle: "26px",        // 20pt in PDF
  bodyText: "16px",        // 12pt in PDF
  bulletText: "16px",      // 12pt in PDF
  smallText: "13px",       // 10pt in PDF
  tableHeader: "12px",     // 9pt in PDF
  tableBody: "13px",       // 10pt in PDF

  // Line heights
  bodyLineHeight: "1.5",
  bulletLineHeight: "1.4",

  // Font family - matches PDF Roboto with web fallbacks
  fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// Spacing values (converted from PDF pt to px)
export const PROPOSAL_SPACING = {
  pageMargin: "50px",        // ~38pt in PDF
  afterPageTitle: "33px",    // 25pt in PDF
  afterSectionHeading: "33px", // 25pt in PDF
  betweenParagraphs: "21px", // 16pt in PDF
  betweenBullets: "3px",     // 2pt in PDF
  beforeSection: "26px",     // 20pt in PDF
  bulletIndent: "26px",      // 20pt in PDF
};

// CSS class generators for consistent styling
export const proposalClasses = {
  // Page container
  page: "min-h-[11in] bg-white relative",
  pageWithPadding: "min-h-[11in] p-[50px] bg-white relative",

  // Typography
  pageTitle: `text-[30px] font-bold text-[${PROPOSAL_COLORS.primary}]`,
  sectionHeading: `text-[21px] font-semibold text-[${PROPOSAL_COLORS.primary}]`,
  subtitle: `text-[26px] font-semibold text-[${PROPOSAL_COLORS.text}]`,
  bodyText: `text-[16px] text-[${PROPOSAL_COLORS.text}] leading-relaxed`,
  smallText: `text-[13px] text-[${PROPOSAL_COLORS.textMuted}]`,

  // Table styles
  tableHeader: `bg-[${PROPOSAL_COLORS.primary}] text-white text-[12px] font-semibold`,
  tableCell: `text-[13px] text-[${PROPOSAL_COLORS.text}]`,
  tableRowAlt: `bg-[${PROPOSAL_COLORS.rowAlt}]`,

  // Links
  link: `text-[${PROPOSAL_COLORS.primary}] underline`,
};

// Tailwind-compatible style objects for inline use
export const proposalStyles = {
  primary: { color: PROPOSAL_COLORS.primary },
  text: { color: PROPOSAL_COLORS.text },
  textLight: { color: PROPOSAL_COLORS.textLight },
  textMuted: { color: PROPOSAL_COLORS.textMuted },
  headerBg: { backgroundColor: PROPOSAL_COLORS.primary },
  headerBgLight: { backgroundColor: PROPOSAL_COLORS.headerBg },
};
