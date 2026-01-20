import { format } from "date-fns";

export interface ProjectIdComponents {
  clientCode: string;
  projectNumber: number;
  creationDate: Date;
}

export interface UPIDComponents {
  clientName: string;
  projectName: string;
  closedWonDate: Date;
  leadSource?: string | null;
}

// Referral prefix mapping based on lead source
// Format: [REFERRAL]-[CLIENT_CODE]-[PROJ_CODE]-[YYYYMMDD]
export const REFERRAL_PREFIX_MAP: Record<string, string> = {
  // Core referral sources per NOMENCLATURE_STANDARDS.md
  "amplify": "AMP",
  "direct": "DIR",
  "referral": "REF",
  "partner": "PART",
  "repeat": "REP",
  "repeat client": "REP",
  "returning": "REP",
  // Import sources
  "pdf import": "PDF",
  "pdf_import": "PDF",
  "import": "IMP",
  // Marketing sources
  "website": "WEB",
  "cold call": "COLD",
  "trade show": "TRAD",
  "linkedin": "LINK",
  "google": "GOOG",
  "email": "MAIL",
  "inbound": "INB",
  "outbound": "OUT",
  // Partner-specific sources
  "matterport": "MATT",
  "ayon": "AYON",
};

export function getReferralPrefix(leadSource: string | null | undefined): string {
  if (!leadSource) return "GEN"; // General/Unknown source
  
  const normalizedSource = leadSource.trim().toLowerCase();
  
  // Check for exact match first
  if (REFERRAL_PREFIX_MAP[normalizedSource]) {
    return REFERRAL_PREFIX_MAP[normalizedSource];
  }
  
  // Check for partial matches (e.g., "Amplify Partner" should match "amplify")
  for (const [key, prefix] of Object.entries(REFERRAL_PREFIX_MAP)) {
    if (normalizedSource.includes(key)) {
      return prefix;
    }
  }
  
  // Generate prefix from first 3-4 characters of source
  const cleanSource = leadSource.replace(/[^a-zA-Z0-9]/g, "");
  if (cleanSource.length >= 3) {
    return cleanSource.substring(0, 4).toUpperCase();
  }
  
  return "GEN";
}

export function generateUniversalProjectId(components: ProjectIdComponents): string {
  const { clientCode, projectNumber, creationDate } = components;
  const cleanClientCode = clientCode
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const dateStr = format(creationDate, "yyMMdd");
  const paddedNumber = String(projectNumber).padStart(4, "0");
  return `${cleanClientCode}-${dateStr}-${paddedNumber}`;
}

export function generateUPID(components: UPIDComponents): string {
  const { clientName, projectName, closedWonDate, leadSource } = components;
  
  const referralPrefix = getReferralPrefix(leadSource);
  const clientCode = generateClientCode(clientName);
  const projCode = generateProjectCode(projectName);
  const dateStr = format(closedWonDate, "yyyyMMdd");
  
  // Format: [REFERRAL]-[CLIENT_CODE]-[PROJ_CODE]-[YYYYMMDD]
  return `${referralPrefix}-${clientCode}-${projCode}-${dateStr}`;
}

export function generateProjectCode(projectName: string): string {
  if (!projectName || projectName.trim() === "") {
    return "PROJ";
  }
  
  const words = projectName.trim().split(/\s+/);
  const cleaned = words
    .map(word => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(word => word.length > 0);
  
  if (cleaned.length === 0) {
    return "PROJ";
  }
  
  if (cleaned.length === 1) {
    return cleaned[0].substring(0, 5).toUpperCase();
  }
  
  return cleaned
    .slice(0, 5)
    .map(word => word.charAt(0))
    .join("")
    .toUpperCase();
}

// Updated regex for 4-part UPID: [REFERRAL]-[CLIENT_CODE]-[PROJ_CODE]-[YYYYMMDD]
export const UPID_REGEX = /^[A-Z0-9]{2,5}-[A-Z0-9]{2,4}-[A-Z0-9]{1,5}-[0-9]{8}$/;

export function validateUPID(upid: string): boolean {
  return UPID_REGEX.test(upid);
}

// Legacy 3-part regex for backward compatibility
export const LEGACY_UPID_REGEX = /^[A-Z0-9]{3,4}-[A-Z0-9]{4,5}-[0-9]{8}$/;

export function validateLegacyUPID(upid: string): boolean {
  return LEGACY_UPID_REGEX.test(upid);
}

export function generateProjectCodeFromLead(
  clientName: string,
  year: number,
  sequenceNumber: number
): string {
  const yearStr = String(year);
  const paddedSeq = String(sequenceNumber).padStart(4, "0");
  return `S2P-${yearStr}-${paddedSeq}`;
}

export function parseUniversalProjectId(projectId: string): ProjectIdComponents | null {
  const regex = /^([A-Z]{2,4})-(\d{6})-(\d{4})$/;
  const match = projectId.match(regex);
  
  if (!match) return null;
  
  const [, clientCode, dateStr, numberStr] = match;
  const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10) - 1;
  const day = parseInt(dateStr.substring(4, 6), 10);
  
  return {
    clientCode,
    creationDate: new Date(year, month, day),
    projectNumber: parseInt(numberStr, 10),
  };
}

export function generateClientCode(clientName: string): string {
  const words = clientName.trim().split(/\s+/);
  
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }
  
  return words
    .slice(0, 4)
    .map(word => word.charAt(0))
    .join("")
    .toUpperCase();
}

// Quote Number Generation - S2P-YYYY-NNNN format
export const QUOTE_NUMBER_REGEX = /^S2P-(\d{4})-(\d{4})$/;

export function parseQuoteNumber(quoteNumber: string): { year: number; sequence: number } | null {
  const match = quoteNumber.match(QUOTE_NUMBER_REGEX);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}

export function generateQuoteNumber(year: number, sequence: number): string {
  const paddedSequence = String(sequence).padStart(4, "0");
  return `S2P-${year}-${paddedSequence}`;
}

export function getNextQuoteNumber(existingQuoteNumbers: string[], currentYear?: number): string {
  const year = currentYear ?? new Date().getFullYear();
  
  let maxSequenceThisYear = 0;
  
  for (const qn of existingQuoteNumbers) {
    const parsed = parseQuoteNumber(qn);
    if (parsed && parsed.year === year) {
      maxSequenceThisYear = Math.max(maxSequenceThisYear, parsed.sequence);
    }
  }
  
  return generateQuoteNumber(year, maxSequenceThisYear + 1);
}
