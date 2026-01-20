export const BUILDING_TYPES = [
  "Commercial / Office",
  "Industrial / Warehouse",
  "Residential - Standard",
  "Residential - High-Rise",
  "Healthcare / Medical",
  "Education / Campus",
  "Retail / Hospitality",
  "Mixed Use",
  "Infrastructure",
  "Historical / Renovation",
  "Warehouse / Storage",
  "Religious Building",
  "Hotel / Resort",
  "Theatre / Performing Arts",
  "Museum / Gallery",
  "Other",
] as const;

export type BuildingType = typeof BUILDING_TYPES[number];

export const HBIM_BUILDING_TYPES: readonly BuildingType[] = [
  "Historical / Renovation",
  "Religious Building",
  "Hotel / Resort",
  "Theatre / Performing Arts",
  "Museum / Gallery",
] as const;

export const SCOPE_OPTIONS = [
  "Full Building",
  "Interior Only",
  "Exterior Only",
  "Roof/Facades Only",
  "MEP Systems Only",
  "Structural Only",
  "As-Built Documentation",
] as const;

export const LOD_LEVELS = [
  "LOD 100",
  "LOD 200",
  "LOD 300",
  "LOD 350",
  "LOD 400",
] as const;

export const LOA_LEVELS = [
  "LoA 10",
  "LoA 20",
  "LoA 30",
  "LoA 40",
  "LoA 50",
] as const;

export const DISCIPLINE_OPTIONS = [
  "Architecture (LOD 200)",
  "Architecture (LOD 300)",
  "Architecture (LOD 350)",
  "Structural (LOD 300)",
  "MEPF (LOD 200)",
  "MEPF (LOD 300)",
  "Civil/Site",
  "Full BIM (Arch + MEPF)",
] as const;

export const SCANNER_TYPES = [
  "Trimble X7",
  "NavVis SLAM",
  "Matterport Pro",
  "FARO Focus",
  "Other",
] as const;

export const BIM_DELIVERABLES = [
  "Revit",
  "Archicad",
  "SketchUp",
  "Rhino",
  "AutoCAD",
  "Point Cloud Only",
  "Navisworks",
  "IFC",
  "Other",
] as const;

export const STORAGE_MODES = [
  "legacy_drive",
  "hybrid_gcs",
  "gcs_native",
] as const;

export const SOURCE_OPTIONS = [
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "abm", label: "ABM Campaign" },
  { value: "referral_client", label: "Referral - Client" },
  { value: "referral_partner", label: "Referral - Partner" },
  { value: "existing_customer", label: "Existing Customer" },
  { value: "ceu", label: "CEU Event" },
  { value: "proof_vault", label: "Proof Vault" },
  { value: "spec_standards", label: "Spec Standards" },
  { value: "podcast", label: "Podcast" },
  { value: "site_seo", label: "Site SEO" },
  { value: "permit_trigger", label: "Permit Trigger" },
  { value: "compliance_trigger", label: "Compliance Trigger" },
  { value: "procurement_trigger", label: "Procurement Trigger" },
  { value: "event_conference", label: "Event/Conference" },
  { value: "social", label: "Social Media" },
  { value: "vendor_onboarding", label: "Vendor Onboarding" },
] as const;

export const REFERRAL_SOURCES = ["referral_client", "referral_partner"] as const;

export const TOUCHPOINT_OPTIONS = [
  { value: "existing_customer", label: "Existing Customer" },
  { value: "proof_vault", label: "Proof Vault" },
  { value: "spec_standards", label: "Spec Standards" },
  { value: "castle", label: "Castle (Digital Twin)" },
  { value: "deck_library", label: "Deck Library" },
  { value: "ceu", label: "CEU/Training" },
  { value: "case_study", label: "Case Study" },
  { value: "site_page", label: "Site Page" },
  { value: "podcast", label: "Podcast" },
  { value: "social", label: "Social Media" },
] as const;

export const ABM_TIERS = ["Tier A", "Tier B", "Tier C", "None"] as const;
export const FIRM_SIZES = ["1-10", "11-50", "50-100", "100+"] as const;
export const COMPANY_DISCIPLINES = ["Architecture", "GC", "Owner", "MEP"] as const;
export const EVENT_TYPES = ["webinar", "lunch_learn"] as const;
export const REGISTRATION_STATUSES = ["registered", "attended", "certificate_sent"] as const;

export const CPQ_BUILDING_TYPES = {
  "1": "Residential - Single Family",
  "2": "Residential - Multi Family",
  "3": "Residential - Luxury",
  "4": "Commercial / Office",
  "5": "Retail / Restaurants",
  "6": "Kitchen / Catering Facilities",
  "7": "Education",
  "8": "Hotel / Theatre / Museum",
  "9": "Hospitals / Mixed Use",
  "10": "Mechanical / Utility Rooms",
  "11": "Warehouse / Storage",
  "12": "Religious Buildings",
  "13": "Infrastructure / Roads / Bridges",
  "14": "Built Landscape",
  "15": "Natural Landscape",
  "16": "ACT (Acoustic Ceiling Tiles)",
} as const;

export const CPQ_BUILDING_TYPE_IDS = Object.keys(CPQ_BUILDING_TYPES) as Array<keyof typeof CPQ_BUILDING_TYPES>;

export const CPQ_DISCIPLINES = ["arch", "struct", "mech", "elec", "plumb", "site"] as const;
export const CPQ_LOD_VALUES = ["200", "300", "350"] as const;
export const CPQ_SCOPE_VALUES = ["full", "interior", "exterior", "roof", "facade"] as const;

export const CPQ_RISK_FACTORS = [
  "remote",
  "fastTrack",
  "revisions",
  "coordination",
  "incomplete",
  "difficult",
  "multiPhase",
  "unionSite",
  "security",
  "occupied",
  "hazardous",
  "noPower",
] as const;

export type CpqRiskFactor = typeof CPQ_RISK_FACTORS[number];

export const CPQ_RISK_PERCENTAGES: Record<CpqRiskFactor, number> = {
  remote: 10,
  fastTrack: 15,
  revisions: 10,
  coordination: 10,
  incomplete: 15,
  difficult: 15,
  multiPhase: 10,
  unionSite: 10,
  security: 10,
  occupied: 15,
  hazardous: 25,
  noPower: 20,
};

export const CPQ_DISPATCH_LOCATIONS = ["troy", "brooklyn", "boise", "denver", "remote"] as const;
export const TRAVEL_MODES = ["local", "regional", "flyout"] as const;

export const CPQ_SERVICES = [
  "matterport",
  "georeferencing",
  "actScanning",
  "scanRegistrationOnly",
  "expedited",
] as const;

export const CPQ_PAYMENT_TERMS = [
  "partner",
  "owner",
  "50/50",
  "net15",
  "net30",
  "net45",
  "net60",
  "net90",
  "standard",
  "other",
] as const;

export type CpqPaymentTerm = typeof CPQ_PAYMENT_TERMS[number];

export const CPQ_PAYMENT_TERMS_DISPLAY: Record<CpqPaymentTerm, string> = {
  partner: "Partner (no premium)",
  owner: "Owner (no premium)",
  "50/50": "50% Deposit / 50% on Completion",
  net15: "Net 15",
  net30: "Net 30 (+5%)",
  net45: "Net 45 (+7%)",
  net60: "Net 60 (+10%)",
  net90: "Net 90 (+15%)",
  standard: "Standard",
  other: "Other",
};

export const CPQ_PAYMENT_TERM_PERCENTAGES: Record<CpqPaymentTerm, number> = {
  partner: -10,
  owner: 0,
  "50/50": 0,
  net15: 0,
  net30: 5,
  net45: 7,
  net60: 10,
  net90: 15,
  standard: 0,
  other: 0,
};

export const CPQ_BIM_SOFTWARE = [
  "revit",
  "archicad",
  "sketchup",
  "rhino",
  "other",
] as const;

export const CPQ_SCAN_REGISTRATION_OPTIONS = [
  "none",
  "fullDay",
  "halfDay",
] as const;

export const CPQ_TIMELINE_OPTIONS = [
  "1week",
  "2weeks",
  "3weeks",
  "4weeks",
  "5weeks",
  "6weeks",
] as const;

export const TIER_A_THRESHOLD = 50000;

export const TIER_A_SCANNING_COSTS = {
  "3500": 3500,
  "7000": 7000,
  "10500": 10500,
  "15000": 15000,
  "18500": 18500,
} as const;

export const TIER_A_MARGINS = {
  "2.352": { label: "2.352X (Standard)", value: 2.352 },
  "2.5": { label: "2.5X", value: 2.5 },
  "3.0": { label: "3.0X", value: 3.0 },
  "3.5": { label: "3.5X", value: 3.5 },
  "4.0": { label: "4.0X (Premium)", value: 4.0 },
} as const;

export const TRAVEL_TIERS = {
  TIER_C: { maxSqft: 10000, base: 150, perMileOver: 0, mileThreshold: 0 },
  TIER_B: { minSqft: 10000, maxSqft: 50000, base: 300, perMileOver: 0, mileThreshold: 0 },
  TIER_A: { minSqft: 50000, base: 0, perMileOver: 4, mileThreshold: 20 },
} as const;

export const COMPLEXITY_SCORES = ["Low", "Medium", "High"] as const;
export const CLIENT_TIERS = ["SMB", "Mid-Market", "Enterprise"] as const;

export const BUYER_PERSONAS = {
  "BP1": "Engineer (Technical Detail)",
  "BP2": "Executive (ROI/Speed)",
  "BP3": "Project Manager (Timeline/Budget)",
  "BP4": "Facilities Manager (Operations)",
  "BP5": "Architect (Design/Precision)",
  "BP6": "Owner/Developer (Value/Investment)",
  "BP7": "GC/Contractor (Schedule/Coordination)",
} as const;

export const QC_VALIDATION_STATUS = ["pending", "passed", "failed", "waived"] as const;
export const WORK_TYPES = ["Scanning", "Travel", "Modeling", "Site Prep", "Other"] as const;
export const ROLE_TYPES = ["tech", "admin", "sales"] as const;
export const ATTACHMENT_SOURCE = ["manual", "visual_scope", "document_ai", "client_upload"] as const;
export const ATTACHMENT_STATUS = ["processing", "ready", "failed"] as const;

export const FIELD_EXPENSE_CATEGORIES = [
  "Parking",
  "Tolls",
  "Fuel",
  "Meals",
  "Hotel",
  "Equipment Rental",
  "Supplies",
  "Other"
] as const;

export const ACCOUNT_TYPES = [
  "Operating",
  "Taxes",
  "Debt",
  "Marketing",
] as const;

export const INVOICE_STATUSES = [
  "Draft",
  "Sent",
  "Paid",
  "Partial",
  "Overdue",
  "Collections",
  "Written Off",
] as const;

export const EWS_SCORES = [1, 2, 3, 4, 5] as const;

export const MARKETING_POST_STATUSES = ["draft", "approved", "posted"] as const;
export const MARKETING_POST_CATEGORIES = ["stat_bomb", "process_tease", "case_highlight", "thought_leadership"] as const;
export const MARKETING_PLATFORMS = ["linkedin", "twitter", "instagram", "email"] as const;

export const GCS_STORAGE_MODES = {
  legacy_drive: { label: "Google Drive Only", description: "Store all files in Google Drive (current default)" },
  hybrid_gcs: { label: "Hybrid (Recommended)", description: "Scan data in GCS, documents in Google Drive" },
  gcs_native: { label: "GCS Only", description: "Store all files in Google Cloud Storage" },
} as const;

export const COMPENSATION_TYPES = {
  commission: "Sales Commission",
  referral: "Referral Fee",
  partner: "Partner Share",
  bonus: "Performance Bonus",
} as const;

export const PANDADOC_IMPORT_STATUSES = [
  "pending",
  "fetching",
  "extracted",
  "needs_review",
  "approved",
  "rejected",
  "error",
] as const;

export const PANDADOC_BATCH_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "partial",
  "failed",
] as const;

export const PANDADOC_STAGES = [
  "proposal_pending",
  "awaiting_internal",
  "closed_won",
  "closed_lost",
  "unknown",
] as const;

export type PandaDocStage = typeof PANDADOC_STAGES[number];

export const PANDADOC_STATUS_MAP: Record<number, PandaDocStage> = {
  0: "proposal_pending",
  1: "proposal_pending",
  5: "proposal_pending",
  6: "awaiting_internal",
  7: "awaiting_internal",
  2: "closed_won",
  10: "closed_won",
  11: "closed_lost",
  12: "closed_lost",
};

export const CPQ_API_DISCIPLINES = ["arch", "mepf", "structure", "site"] as const;
export const CPQ_API_LODS = ["200", "300", "350"] as const;
export const CPQ_API_SCOPES = ["full", "interior", "exterior", "mixed"] as const;
export const CPQ_API_RISKS = ["occupied", "hazardous", "no_power"] as const;
export const CPQ_API_DISPATCH_LOCATIONS = ["troy", "woodstock", "brooklyn", "fly_out"] as const;

export interface GoogleBuildingInsights {
  available: boolean;
  squareFeet?: number;
  squareMeters?: number;
  maxRoofHeightFeet?: number;
  maxRoofHeightMeters?: number;
  roofSegments?: number;
  imageryDate?: string;
  imageryQuality?: string;
  coordinates?: { lat: number; lng: number };
  fetchedAt?: string;
  error?: string;
}

export interface GoogleTravelInsights {
  available: boolean;
  origin?: string;
  destination?: string;
  distanceMiles?: number;
  durationMinutes?: number;
  durationText?: string;
  scenarioType?: "local" | "regional" | "flyout";
  scenarioLabel?: string;
  fetchedAt?: string;
  error?: string;
}

export interface GoogleIntel {
  buildingInsights?: GoogleBuildingInsights;
  travelInsights?: GoogleTravelInsights;
}

export interface ProjectStatusType {
  proposalPhase?: boolean;
  inHand?: boolean;
  urgent?: boolean;
  other?: boolean;
  otherText?: string;
}

export interface LeadSourcesConfig {
  sources: string[];
}

export interface StalenessConfig {
  warningDays: number;
  criticalDays: number;
  penaltyPercent: number;
}

export interface BusinessDefaultsConfig {
  defaultTravelRate: number;
  dispatchLocations: string[];
  defaultBimDeliverable: string;
  defaultBimVersion: string;
}

export interface GcsStorageConfig {
  projectId: string;
  defaultBucket: string;
  configured: boolean;
  defaultStorageMode: "legacy_drive" | "hybrid_gcs" | "gcs_native";
  lastTestedAt?: string;
}

import { z } from "zod";

export const optionalString = z.preprocess(
  (val) => (val === "" || val === undefined ? null : val),
  z.string().nullable().optional()
);

export const optionalNumber = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  },
  z.number().nullable().optional()
);

export const cpqAreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  buildingName: z.string().optional(),
  buildingType: z.string(),
  squareFeet: z.string(),
  scope: z.enum(CPQ_SCOPE_VALUES),
  disciplines: z.array(z.enum(CPQ_DISCIPLINES)),
  disciplineLods: z.record(z.enum(CPQ_DISCIPLINES), z.enum(CPQ_LOD_VALUES)).optional(),
  mixedInteriorLod: z.enum(CPQ_LOD_VALUES).optional(),
  mixedExteriorLod: z.enum(CPQ_LOD_VALUES).optional(),
  numberOfRoofs: z.number().optional(),
  facades: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  gradeAroundBuilding: z.boolean().optional(),
  gradeLod: z.enum(CPQ_LOD_VALUES).optional(),
  includeCad: z.boolean().optional(),
  additionalElevations: z.number().optional(),
});
export type CpqArea = z.infer<typeof cpqAreaSchema>;

export const cpqTravelSchema = z.object({
  travelMode: z.enum(TRAVEL_MODES).default("local"),
  localTransitCost: z.number().optional(),
  localRentalCarNeeded: z.boolean().optional(),
  localRentalCarCost: z.number().optional(),
  localRentalDays: z.number().optional(),
  localMileage: z.number().optional(),
  localMileageRate: z.number().optional(),
  localParkingCost: z.number().optional(),
  localTollsCost: z.number().optional(),
  dispatchLocation: z.enum(CPQ_DISPATCH_LOCATIONS).optional(),
  distance: z.number().optional(),
  truckMileageRate: z.number().optional(),
  scanDays: z.number().optional(),
  perDiem: z.number().optional(),
  overnightRequired: z.boolean().optional(),
  hotelCostRegional: z.number().optional(),
  hotelNightsRegional: z.number().optional(),
  flyoutOrigin: z.string().optional(),
  flyoutDestination: z.string().optional(),
  flyoutFlightCost: z.number().optional(),
  flyoutNumTechnicians: z.number().optional(),
  flyoutHotelCost: z.number().optional(),
  flyoutHotelNights: z.number().optional(),
  flyoutGroundTransport: z.number().optional(),
  flyoutPerDiem: z.number().optional(),
  flyoutBaggageFees: z.number().optional(),
  flightSearchResults: z.array(z.object({
    airline: z.string(),
    price: z.number(),
    departure: z.string(),
    arrival: z.string(),
    stops: z.number(),
  })).optional(),
  hotelSearchResults: z.array(z.object({
    name: z.string(),
    price: z.number(),
    rating: z.number().optional(),
    address: z.string().optional(),
  })).optional(),
  searchTimestamp: z.string().optional(),
  customTravelCost: z.number().optional(),
  calculatedTravelCost: z.number().optional(),
  travelNotes: z.string().optional(),
});
export type CpqTravel = z.infer<typeof cpqTravelSchema>;

export const cpqScopingDataSchema = z.object({
  hasBasement: z.boolean().optional(),
  hasAttic: z.boolean().optional(),
  specificBuilding: z.string().optional(),
  aboveBelowACT: z.enum(["", "above", "below", "both", "other"]).optional(),
  aboveBelowACTOther: z.string().optional(),
  actSqft: z.string().optional(),
  scanRegistrationOnly: z.enum(["", "none", "fullDay", "halfDay"]).optional(),
  bimDeliverable: z.array(z.string()).optional(),
  bimDeliverableOther: z.string().optional(),
  bimVersion: z.string().optional(),
  customTemplate: z.enum(["", "yes", "no", "other"]).optional(),
  customTemplateOther: z.string().optional(),
  sqftAssumptions: z.string().optional(),
  assumedGrossMargin: z.string().optional(),
  caveatsProfitability: z.string().optional(),
  projectNotes: z.string().optional(),
  mixedScope: z.string().optional(),
  insuranceRequirements: z.string().optional(),
  estimatedTimeline: z.enum(["", "1week", "2weeks", "3weeks", "4weeks", "5weeks", "6weeks", "other"]).optional(),
  timelineOther: z.string().optional(),
  timelineNotes: z.string().optional(),
  paymentTerms: z.enum(["", "partner", "owner", "50/50", "net15", "net30", "net45", "net60", "net90", "standard", "other"]).optional(),
  paymentTermsOther: z.string().optional(),
  paymentNotes: z.string().optional(),
  accountContact: z.string().optional(),
  accountContactEmail: z.string().optional(),
  accountContactPhone: z.string().optional(),
  phoneNumber: z.string().optional(),
  designProContact: z.string().optional(),
  designProCompanyContact: z.string().optional(),
  otherContact: z.string().optional(),
  billingContactName: z.string().optional(),
  billingContactEmail: z.string().optional(),
  billingContactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  proofLinks: z.string().optional(),
  source: z.enum(["", "referral", "website", "linkedin", "coldOutreach", "repeat", "partner", "other"]).optional(),
  sourceNote: z.string().optional(),
  assist: z.string().optional(),
  probabilityOfClosing: z.string().optional(),
  projectStatus: z.enum(["", "lead", "qualified", "proposal", "negotiation", "won", "lost", "other"]).optional(),
  projectStatusOther: z.string().optional(),
  tierAScanningCost: z.enum(["", "3500", "7000", "10500", "15000", "18500", "other"]).optional(),
  tierAScanningCostOther: z.number().optional(),
  tierAModelingCost: z.number().optional(),
  tierAMargin: z.enum(["", "2.352", "2.5", "3.0", "3.5", "4.0"]).optional(),
  tierAClientPrice: z.number().optional(),
});
export type CpqScopingData = z.infer<typeof cpqScopingDataSchema>;

export const regulatoryRiskSchema = z.object({
  risk: z.string(),
  severity: z.enum(["Low", "Medium", "High"]),
  source: z.string().optional(),
});
export type RegulatoryRisk = z.infer<typeof regulatoryRiskSchema>;

export const PRODUCT_CATEGORIES = [
  "S2P", // Core Product (e.g., S2P COM 300)
  "Added Disciplines", // e.g., MEPF, Structural
  "Add Ons", // e.g., CAD Packages, BOMA
  "Conditions", // e.g., Occupied, Expedited
  "Travel", // Travel-related products
  "Other",
] as const;

export const PRICING_MODELS = [
  "Fixed", // Flat rate (e.g., $150)
  "PerSqFt", // Multiplied by project sqft (e.g., $0.10/sqft)
  "Percentage", // Percentage of total (e.g., 10%)
  "Dynamic", // Uses complex logic (e.g., Vendor Rates)
] as const;
