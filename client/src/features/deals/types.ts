/**
 * Type definitions for Deal Workspace components
 * 
 * Provides strongly-typed form schemas for lead management and quote building,
 * replacing `any` types with proper TypeScript definitions.
 */

import { z } from "zod";
import { insertLeadSchema } from "@shared/schema";
import type { UseFormReturn } from "react-hook-form";
import type { UseMutationResult } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Lead, LeadDocument, CpqQuote } from "@shared/schema";

/**
 * Extended form schema for lead details with additional validation
 * Extends the base insertLeadSchema with required field validations
 */
export const leadFormSchema = insertLeadSchema.extend({
  clientName: z.string().min(1, "Client name is required"),
  projectName: z.string().min(1, "Project name is required"),
  projectAddress: z.string().min(1, "Project address is required"),
  dealStage: z.string().min(1, "Deal stage is required"),
  contactName: z.string().min(1, "Primary contact name is required"),
  contactEmail: z.string().email("Valid contact email is required"),
  leadSource: z.string().min(1, "Lead source is required for attribution"),
  billingContactName: z.string().min(1, "Billing contact name is required"),
  billingContactEmail: z.string().email("Valid billing email is required"),
  billingContactPhone: z.string().optional().nullable(),
  projectStatus: z.object({
    proposalPhase: z.boolean().optional(),
    inHand: z.boolean().optional(),
    urgent: z.boolean().optional(),
    other: z.boolean().optional(),
    otherText: z.string().optional(),
  }).optional(),
  proofLinks: z.string().optional().nullable(),
  missingInfo: z.array(z.object({
    fieldKey: z.string(),
    question: z.string(),
    addedAt: z.string(),
    status: z.enum(["pending", "sent", "answered"]),
    sentAt: z.string().optional(),
    answeredAt: z.string().optional(),
  })).optional(),
});

export interface MissingInfoEntry {
  fieldKey: string;
  question: string;
  addedAt: string;
  status: "pending" | "sent" | "answered";
  sentAt?: string;
  answeredAt?: string;
}

/**
 * Inferred type from the lead form schema
 * Used for form state, submission, and validation
 */
export type LeadFormData = z.infer<typeof leadFormSchema>;

/**
 * Area configuration for the Quote Builder
 * Represents a single building/area in a multi-area quote
 */
export interface QuoteBuilderArea {
  id: string;
  name: string;
  buildingType: string;
  squareFeet: string;
  disciplines: string[];
  disciplineLods: Record<string, { 
    discipline: string; 
    lod: string; 
    scope: string;
  }>;
}

/**
 * Complete form data for Quote Builder state
 * Captures all configuration needed for CPQ pricing
 */
export interface QuoteBuilderFormData {
  areas: QuoteBuilderArea[];
  dispatchLocation: string;
  distance: string;
  risks: string[];
  risksAffirmed: boolean;
  matterport: boolean;
  actScan: boolean;
  additionalElevations: string;
  servicesAffirmed: boolean;
  paymentTerms: string;
  marginTarget: number;
}

/**
 * Props for the LeadDetailsTab component
 * Provides typed form handling and mutation callbacks
 */
export interface LeadDetailsTabProps {
  lead: Lead;
  leadId: number;
  form: UseFormReturn<LeadFormData>;
  onSubmit: (data: LeadFormData) => Promise<void>;
  isPending: boolean;
  queryClient: QueryClient;
  updateMutation: UseMutationResult<any, Error, any, unknown>;
  toast: any;
  documents?: LeadDocument[];
  uploadDocumentMutation: UseMutationResult<LeadDocument, Error, File, unknown>;
}

/**
 * Props for the QuoteBuilderTab component
 */
export interface QuoteBuilderTabProps {
  lead: Lead;
  leadId: number;
  toast: (opts: { 
    title: string; 
    description?: string; 
    variant?: "default" | "destructive";
  }) => void;
  onQuoteSaved: () => void;
  existingQuotes?: CpqQuote[];
  sourceQuote?: CpqQuote | null;
  onClearSourceQuote?: () => void;
}

/**
 * Project status checkbox configuration
 */
export interface ProjectStatus {
  proposalPhase?: boolean;
  inHand?: boolean;
  urgent?: boolean;
  other?: boolean;
  otherText?: string;
}

/**
 * Buyer persona mapping for display
 */
export const BUYER_PERSONAS: Record<string, string> = {
  "BP-A": "Design Principal / Senior Architect",
  "BP-B": "Project Architect / Manager",
  "BP-C": "Owner Representative / Developer",
  "BP-D": "GC / Construction Manager",
} as const;
