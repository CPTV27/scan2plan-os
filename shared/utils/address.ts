// OS-Side Address Formatting & Georeferencing Utilities
// Ensures "Single Source of Truth" for addresses across Sales, CPQ, and legal documents

export interface FormattedAddress {
  fullAddress: string;        // Complete formatted address for legal documents
  streetAddress: string;      // Street number and name
  city: string;
  state: string;
  zipCode: string;
  country: string;
  googleMapsUrl: string;      // Ready-to-use Google Maps link
  uniqueIdentifier: string;   // Hash for PandaDoc/legal document matching
}

/**
 * Parse and format an address string into standardized components
 * Handles various input formats and normalizes for legal/CPQ use
 */
export function parseAddress(rawAddress: string): FormattedAddress {
  const cleaned = rawAddress.trim();
  
  // Extract zip code (5 or 9 digit formats)
  const zipMatch = cleaned.match(/(\d{5}(?:-\d{4})?)\s*$/);
  const zipCode = zipMatch ? zipMatch[1] : "";
  
  // Remove zip from working string
  let working = (zipCode && zipMatch) ? cleaned.replace(zipMatch[0], "").trim() : cleaned;
  
  // Extract state (2-letter code at end)
  const stateMatch = working.match(/,?\s*([A-Z]{2})\s*$/i);
  const state = stateMatch ? stateMatch[1].toUpperCase() : "";
  working = (state && stateMatch) ? working.replace(stateMatch[0], "").trim() : working;
  
  // Extract city (text before comma if present)
  const parts = working.split(",").map(p => p.trim());
  const city = parts.length > 1 ? parts[parts.length - 1] : "";
  const streetAddress = parts.length > 1 ? parts.slice(0, -1).join(", ") : working;
  
  // Rebuild full formatted address
  const addressParts = [streetAddress];
  if (city) addressParts.push(city);
  if (state) addressParts.push(state);
  if (zipCode) addressParts.push(zipCode);
  const fullAddress = addressParts.join(", ");
  
  // Generate Google Maps URL
  const encodedAddress = encodeURIComponent(fullAddress);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  
  // Generate unique identifier (hash of normalized address)
  const normalizedForHash = fullAddress.toLowerCase().replace(/[^a-z0-9]/g, "");
  const uniqueIdentifier = hashString(normalizedForHash);
  
  return {
    fullAddress,
    streetAddress,
    city,
    state,
    zipCode,
    country: "USA",
    googleMapsUrl,
    uniqueIdentifier,
  };
}

/**
 * Simple hash function for address uniqueness
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, "0");
}

/**
 * Format address for CPQ parameter passing
 * Returns a finalized, unique address string
 */
export function formatAddressForCPQ(rawAddress: string, zipCode?: string): string {
  const parsed = parseAddress(rawAddress);
  
  // If zip was provided separately, use it
  if (zipCode && !parsed.zipCode) {
    return `${parsed.streetAddress}, ${parsed.city}, ${parsed.state} ${zipCode}`;
  }
  
  return parsed.fullAddress;
}

/**
 * Legal footer for proposals and PDFs
 */
export const LEGAL_JURISDICTION_FOOTER = `This project is governed by the laws of Rensselaer County, NY, and any legal proceedings shall be handled within said jurisdiction.`;

/**
 * Terms & Conditions link
 */
export const TERMS_CONDITIONS_URL = "https://scan2plan.com/terms";

/**
 * Full legal footer with T&C link for PDFs
 */
export function getLegalFooter(): string {
  return `${LEGAL_JURISDICTION_FOOTER}

View Terms & Conditions: ${TERMS_CONDITIONS_URL}

Terms include provisions for reshoot fees (weather/site access delays) and delay fees.`;
}
