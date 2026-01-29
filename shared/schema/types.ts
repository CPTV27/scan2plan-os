import {
  BUILDING_TYPES,
  SCOPE_OPTIONS,
  LOD_LEVELS,
  LOA_LEVELS,
  DISCIPLINE_OPTIONS,
  SCANNER_TYPES,
  BIM_DELIVERABLES,
  STORAGE_MODES,
  SOURCE_OPTIONS,
  TOUCHPOINT_OPTIONS,
  ABM_TIERS,
  FIRM_SIZES,
  COMPANY_DISCIPLINES,
  EVENT_TYPES,
  REGISTRATION_STATUSES,
  CPQ_DISCIPLINES,
  CPQ_LOD_VALUES,
  CPQ_SCOPE_VALUES,
  CPQ_DISPATCH_LOCATIONS,
  TRAVEL_MODES,
  CPQ_SERVICES,
  CPQ_BIM_SOFTWARE,
  CPQ_SCAN_REGISTRATION_OPTIONS,
  CPQ_TIMELINE_OPTIONS,
  COMPLEXITY_SCORES,
  CLIENT_TIERS,
  BUYER_PERSONAS,
  WORK_TYPES,
  ROLE_TYPES,
  FIELD_EXPENSE_CATEGORIES,
  ACCOUNT_TYPES,
  INVOICE_STATUSES,
  EWS_SCORES,
  MARKETING_POST_STATUSES,
  MARKETING_POST_CATEGORIES,
  MARKETING_PLATFORMS,
  PANDADOC_IMPORT_STATUSES,
  PANDADOC_BATCH_STATUSES,
  QC_VALIDATION_STATUS,
} from "./constants";

export type StorageMode = typeof STORAGE_MODES[number];
export type SourceOption = typeof SOURCE_OPTIONS[number]["value"];
export type TouchpointOption = typeof TOUCHPOINT_OPTIONS[number]["value"];
export type AbmTier = typeof ABM_TIERS[number];
export type FirmSize = typeof FIRM_SIZES[number];
export type CompanyDiscipline = typeof COMPANY_DISCIPLINES[number];
export type EventType = typeof EVENT_TYPES[number];
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number];
export type ScopeOption = typeof SCOPE_OPTIONS[number];
export type LODLevel = typeof LOD_LEVELS[number];
export type LOALevel = typeof LOA_LEVELS[number];
export type DisciplineOption = typeof DISCIPLINE_OPTIONS[number];
export type ScannerType = typeof SCANNER_TYPES[number];
export type BimDeliverable = typeof BIM_DELIVERABLES[number];
export type CpqDiscipline = typeof CPQ_DISCIPLINES[number];
export type CpqLodValue = typeof CPQ_LOD_VALUES[number];
export type CpqScopeValue = typeof CPQ_SCOPE_VALUES[number];
export type CpqDispatchLocation = typeof CPQ_DISPATCH_LOCATIONS[number];
export type TravelMode = typeof TRAVEL_MODES[number];
export type CpqService = typeof CPQ_SERVICES[number];
export type CpqBimSoftware = typeof CPQ_BIM_SOFTWARE[number];
export type CpqScanRegistrationOption = typeof CPQ_SCAN_REGISTRATION_OPTIONS[number];
export type CpqTimelineOption = typeof CPQ_TIMELINE_OPTIONS[number];
export type ComplexityScore = typeof COMPLEXITY_SCORES[number];
export type ClientTier = typeof CLIENT_TIERS[number];
export type BuyerPersonaId = keyof typeof BUYER_PERSONAS;
export type WorkType = typeof WORK_TYPES[number];
export type RoleType = typeof ROLE_TYPES[number];
export type FieldExpenseCategory = typeof FIELD_EXPENSE_CATEGORIES[number];
export type AccountType = typeof ACCOUNT_TYPES[number];
export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export type EwsScore = typeof EWS_SCORES[number];
export type MarketingPostStatus = typeof MARKETING_POST_STATUSES[number];
export type MarketingPostCategory = typeof MARKETING_POST_CATEGORIES[number];
export type MarketingPlatform = typeof MARKETING_PLATFORMS[number];
export type PandaDocImportStatus = typeof PANDADOC_IMPORT_STATUSES[number];
export type PandaDocBatchStatus = typeof PANDADOC_BATCH_STATUSES[number];
export type QCValidationStatus = typeof QC_VALIDATION_STATUS[number];

// === PROPOSAL LINE ITEMS ===
export interface ProposalLineItem {
  id: string;           // UUID for React keys
  itemName: string;     // "Scan2Plan Commercial - LoD 300"
  description: string;  // Full catalog description
  qty: number;          // Square footage or quantity
  rate: number;         // Per-unit rate
  amount: number;       // Calculated: qty × rate
}

// === PROPOSAL COVER DATA ===
export interface ProposalCoverData {
  projectTitle: string;       // "30 Cooper Sq (1F, basement Sub-basement)"
  projectAddress: string;     // "New York, NY 10003"
  serviceTitle?: string;      // "Laser Scanning & Building Documentation" (editable)
  servicesLine: string;       // "LoD 350 + MEPF + Structure + Matterport + CAD" (single area fallback)
  areaScopeLines?: string[];  // Per-area scope lines: ["Area 1: LoD 300 + Architecture", "Area 2: LoD 350 + MEPF"]
  clientName: string;         // "HENSON ARCHITECTURE"
  date: string;               // "10/21/25"
}

// === PROPOSAL PROJECT DATA ===
export interface ProposalProjectData {
  serviceType: "Commercial" | "Residential"; // Commercial Service or Residential Service
  hasMatterport: boolean;     // Whether Matterport is included
  overview: string;           // Legacy: address portion (for backwards compat)
  overviewLine?: string;      // Full editable overview line (e.g., "Service for Project, Address")
  scopeItems: string[];       // Bullet list of scope items
  deliverables: string[];     // Bullet list of deliverables
  timelineIntro: string;      // "Approximately 5 weeks..."
  milestones: string[];       // Timeline bullet items
}

// === PROPOSAL PAYMENT DATA ===
export interface ProposalPaymentData {
  terms: string[];            // Bullet list of payment terms
  paymentMethods: string[];   // Accepted payment methods
  acknowledgementDate: string; // Date for acknowledgement section
}
