import { z } from "zod";
import {
  CPQ_PAYMENT_TERMS,
  CPQ_API_DISCIPLINES,
  CPQ_API_LODS,
  CPQ_API_SCOPES,
  CPQ_API_RISKS,
  CPQ_API_DISPATCH_LOCATIONS,
} from "./constants";

export const cpqApiDisciplineLodSchema = z.object({
  discipline: z.enum(CPQ_API_DISCIPLINES),
  lod: z.enum(CPQ_API_LODS),
  scope: z.enum(CPQ_API_SCOPES).optional(),
});
export type CpqApiDisciplineLod = z.infer<typeof cpqApiDisciplineLodSchema>;

export const cpqApiAreaSchema = z.object({
  name: z.string().optional(),
  buildingType: z.string(),
  squareFeet: z.string(),
  disciplines: z.array(z.enum(CPQ_API_DISCIPLINES)).optional(),
  disciplineLods: z.record(z.string(), cpqApiDisciplineLodSchema).optional(),
});
export type CpqApiArea = z.infer<typeof cpqApiAreaSchema>;

export const cpqServicesSchema = z.object({
  matterport: z.boolean().optional(),
  actScan: z.boolean().optional(),
  additionalElevations: z.number().optional(),
});
export type CpqServices = z.infer<typeof cpqServicesSchema>;

export const cpqCalculateRequestSchema = z.object({
  clientName: z.string().optional(),
  projectName: z.string().optional(),
  projectAddress: z.string().optional(),
  areas: z.array(cpqApiAreaSchema).min(1),
  risks: z.array(z.enum(CPQ_API_RISKS)).optional(),
  dispatchLocation: z.enum(CPQ_API_DISPATCH_LOCATIONS),
  distance: z.number().optional(),
  customTravelCost: z.number().optional(),
  services: cpqServicesSchema.optional(),
  paymentTerms: z.enum(CPQ_PAYMENT_TERMS).optional(),
  leadId: z.number().optional(),
  marginTarget: z.number().min(0.35).max(0.60).optional(),
});
export type CpqCalculateRequest = z.infer<typeof cpqCalculateRequestSchema>;

export const cpqLineItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(["discipline", "area", "risk", "travel", "service", "subtotal", "total"]),
  clientPrice: z.number(),
  upteamCost: z.number(),
  details: z.object({
    sqft: z.number().optional(),
    discipline: z.string().optional(),
    lod: z.string().optional(),
    scope: z.string().optional(),
    clientRate: z.number().optional(),
    upteamRate: z.number().optional(),
  }).optional(),
});
export type CpqLineItem = z.infer<typeof cpqLineItemSchema>;

export const cpqIntegrityFlagSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["warning", "error"]),
});
export type CpqIntegrityFlag = z.infer<typeof cpqIntegrityFlagSchema>;

export const cpqMarginWarningSchema = z.object({
  code: z.enum(["BELOW_GUARDRAIL", "BELOW_FLOOR", "MARGIN_ADJUSTED"]),
  message: z.string(),
  targetMargin: z.number().optional(),
  calculatedMargin: z.number().optional(),
});
export type CpqMarginWarning = z.infer<typeof cpqMarginWarningSchema>;

export const cpqCalculateResponseSchema = z.object({
  success: z.literal(true),
  totalClientPrice: z.number(),
  totalUpteamCost: z.number(),
  grossMargin: z.number(),
  grossMarginPercent: z.number(),
  lineItems: z.array(cpqLineItemSchema),
  subtotals: z.object({
    modeling: z.number(),
    travel: z.number(),
    riskPremiums: z.number(),
    services: z.number(),
    paymentPremium: z.number(),
  }),
  areaSubtotals: z.record(z.string(), z.number()).optional(), // Per-area subtotals keyed by area ID
  integrityStatus: z.enum(["pass", "warning", "blocked"]),
  integrityFlags: z.array(cpqIntegrityFlagSchema).optional(),
  marginTarget: z.number().optional(),
  marginWarnings: z.array(cpqMarginWarningSchema).optional(),
  calculatedAt: z.string(),
  engineVersion: z.string(),
});
export type CpqCalculateResponse = z.infer<typeof cpqCalculateResponseSchema>;

export const cpqErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.object({
    formErrors: z.array(z.string()).optional(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }).optional(),
});
export type CpqErrorResponse = z.infer<typeof cpqErrorResponseSchema>;
