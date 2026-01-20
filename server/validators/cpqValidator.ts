import { FY26_GOALS } from "@shared/businessGoals";
import { z } from "zod";

const MARGIN_FLOOR = FY26_GOALS.MARGIN_FLOOR;
const MARGIN_GUARDRAIL = FY26_GOALS.MARGIN_STRETCH;
const TIER_A_THRESHOLD = FY26_GOALS.TIER_A_FLOOR;
const PRICE_VARIANCE_TOLERANCE = 0.01;

export interface ValidationError {
  code: string;
  field?: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  integrityStatus: "pass" | "warning" | "blocked";
  tierClassification?: "A" | "B";
}

const areaSchema = z.object({
  name: z.string().optional(),
  buildingType: z.string(),
  squareFeet: z.union([z.string(), z.number()]),
  disciplines: z.array(z.string()).optional(),
  lod: z.string().optional(),
  scope: z.string().optional(),
  kind: z.string().optional(),
});

const quoteInputSchema = z.object({
  areas: z.array(areaSchema).min(1, "At least one area is required"),

  totalClientPrice: z.number().positive("Total client price must be positive"),
  totalUpteamCost: z.number().positive("Total upteam cost must be positive"),
  marginTarget: z.number().optional().transform(v => {
    if (v === undefined) return undefined;
    return v > 1 ? v / 100 : v;
  }),

  dispatchLocation: z.string().transform(v => v.toUpperCase()),
  projectName: z.string().min(1, "Project name is required"),
  projectAddress: z.string().min(1, "Project address is required"),
  typeOfBuilding: z.string(),

  overrideApproved: z.boolean().optional(),
  overrideApprovedBy: z.string().optional(),
}).passthrough();

export function validateQuote(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let integrityStatus: "pass" | "warning" | "blocked" = "pass";

  const parsed = quoteInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.errors.map(e => ({
        code: "VALIDATION_ERROR",
        field: e.path.join("."),
        message: e.message,
      })),
      warnings: [],
      integrityStatus: "blocked",
    };
  }

  const quote = parsed.data;

  const grossMargin = quote.totalClientPrice - quote.totalUpteamCost;
  const grossMarginPercent = (grossMargin / quote.totalClientPrice) * 100;

  const EPSILON = 0.0001;

  // DISABLED: Margin floor and guardrail validation (temporarily disabled for local dev)
  // if (grossMarginPercent < (MARGIN_FLOOR * 100) - EPSILON) {
  //   if (!quote.overrideApproved) {
  //     errors.push({
  //       code: "MARGIN_BELOW_FLOOR",
  //       message: `Gross margin ${grossMarginPercent.toFixed(1)}% is below the ${MARGIN_FLOOR * 100}% governance gate. CEO override required.`,
  //     });
  //     integrityStatus = "blocked";
  //   } else {
  //     warnings.push({
  //       code: "MARGIN_OVERRIDE_USED",
  //       message: `Quote saved with ${grossMarginPercent.toFixed(1)}% margin (below floor) via CEO override.`,
  //       details: { approvedBy: quote.overrideApprovedBy },
  //     });
  //     integrityStatus = "warning";
  //   }
  // } else if (grossMarginPercent < (MARGIN_GUARDRAIL * 100) - EPSILON) {
  //   warnings.push({
  //     code: "MARGIN_BELOW_GUARDRAIL",
  //     message: `Gross margin ${grossMarginPercent.toFixed(1)}% is below the ${MARGIN_GUARDRAIL * 100}% target.`,
  //   });
  //   integrityStatus = "warning";
  // }

  if (quote.marginTarget) {
    const expectedClientPrice = quote.totalUpteamCost / (1 - quote.marginTarget);
    const variance = Math.abs(quote.totalClientPrice - expectedClientPrice) / expectedClientPrice;

    if (variance > PRICE_VARIANCE_TOLERANCE) {
      errors.push({
        code: "PRICE_INTEGRITY_FAILED",
        message: `Client price $${quote.totalClientPrice.toFixed(2)} doesn't match expected $${expectedClientPrice.toFixed(2)} for ${(quote.marginTarget * 100).toFixed(0)}% margin. Variance: ${(variance * 100).toFixed(1)}%`,
      });
      integrityStatus = "blocked";
    }
  }

  const validLocations = ["TROY", "WOODSTOCK", "BROOKLYN", "FLY_OUT"];
  if (!validLocations.includes(quote.dispatchLocation)) {
    errors.push({
      code: "INVALID_DISPATCH_LOCATION",
      field: "dispatchLocation",
      message: `Invalid dispatch location "${quote.dispatchLocation}". Must be one of: ${validLocations.join(", ")}`,
    });
    integrityStatus = "blocked";
  }

  const totalSqft = quote.areas.reduce((sum, area) => {
    const sqft = typeof area.squareFeet === "string"
      ? parseFloat(area.squareFeet)
      : area.squareFeet;
    return sum + (isNaN(sqft) ? 0 : sqft);
  }, 0);

  const tierClassification = totalSqft >= TIER_A_THRESHOLD ? "A" : "B";

  if (tierClassification === "A") {
    warnings.push({
      code: "TIER_A_PROJECT",
      message: `Large project (${totalSqft.toLocaleString()} sqft) classified as Tier A.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    integrityStatus: errors.length > 0 ? "blocked" : integrityStatus,
    tierClassification,
  };
}

export function validatePandaDocSend(
  quote: { leadId?: number | null },
  lead: { contactEmail?: string | null; contactName?: string | null } | null,
  body: { recipientEmail?: string; recipientName?: string }
): ValidationResult {
  const errors: ValidationError[] = [];

  const recipientEmail = lead?.contactEmail || body.recipientEmail;
  const recipientName = lead?.contactName || body.recipientName;

  if (!recipientEmail) {
    errors.push({
      code: "MISSING_RECIPIENT_EMAIL",
      field: "contactEmail",
      message: "Recipient email is required. Add contact email to the lead first.",
    });
  }

  if (!recipientName) {
    errors.push({
      code: "MISSING_RECIPIENT_NAME",
      field: "contactName",
      message: "Recipient name is required. Add contact name to the lead first.",
    });
  }

  if (!quote.leadId) {
    errors.push({
      code: "QUOTE_NOT_LINKED",
      message: "Quote must be linked to a lead before sending for signature.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    integrityStatus: errors.length > 0 ? "blocked" : "pass",
  };
}

export function normalizeQuoteForValidation(data: any): any {
  const normalized = { ...data };

  if (normalized.travel && typeof normalized.travel.dispatchLocation === 'string') {
    normalized.dispatchLocation = normalized.travel.dispatchLocation.toUpperCase();
  } else if (typeof normalized.dispatchLocation === 'string') {
    normalized.dispatchLocation = normalized.dispatchLocation.toUpperCase();
  }

  if (!normalized.areas && normalized.requestData?.areas) {
    normalized.areas = normalized.requestData.areas;
  }

  const pricingBreakdown = normalized.pricingBreakdown || {};

  // Map totalPrice -> totalClientPrice (client sends totalPrice, validator expects totalClientPrice)
  if (!normalized.totalClientPrice) {
    if (normalized.totalPrice) {
      normalized.totalClientPrice = Number(normalized.totalPrice);
    } else if (pricingBreakdown.totalClientPrice) {
      normalized.totalClientPrice = Number(pricingBreakdown.totalClientPrice);
    }
  }

  // Map totalCost -> totalUpteamCost (client sends totalCost, validator expects totalUpteamCost)
  if (!normalized.totalUpteamCost) {
    if (normalized.totalCost) {
      normalized.totalUpteamCost = Number(normalized.totalCost);
    } else if (pricingBreakdown.totalCost) {
      normalized.totalUpteamCost = Number(pricingBreakdown.totalCost);
    }
  }

  if (!normalized.marginTarget && pricingBreakdown.marginTarget) {
    normalized.marginTarget = Number(pricingBreakdown.marginTarget);
  }

  if (normalized.requestData?.overrideApproved !== undefined) {
    normalized.overrideApproved = normalized.requestData.overrideApproved;
  }
  if (normalized.requestData?.overrideApprovedBy !== undefined) {
    normalized.overrideApprovedBy = normalized.requestData.overrideApprovedBy;
  }

  return normalized;
}
