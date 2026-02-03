import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  EVENT_TYPES,
  REGISTRATION_STATUSES,
  CPQ_RISK_FACTORS,
  CPQ_SERVICES,
  COMPLEXITY_SCORES,
  CLIENT_TIERS,
  STORAGE_MODES,
  ABM_TIERS,
  FIRM_SIZES,
  COMPANY_DISCIPLINES,
  LOD_LEVELS,
  LOA_LEVELS,
  QC_VALIDATION_STATUS,
  ATTACHMENT_SOURCE,
  ATTACHMENT_STATUS,
  WORK_TYPES,
  ROLE_TYPES,
  FIELD_EXPENSE_CATEGORIES,
  ACCOUNT_TYPES,
  INVOICE_STATUSES,
  EWS_SCORES,
  MARKETING_POST_STATUSES,
  MARKETING_POST_CATEGORIES,
  MARKETING_PLATFORMS,
  optionalString,
  optionalNumber,
  cpqAreaSchema,
  cpqTravelSchema,
  cpqScopingDataSchema,
  regulatoryRiskSchema,
} from "./constants";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  projectCode: text("project_code"), // Unique identifier across OS, QuickBooks, Airtable (e.g., "S2P-2026-0001")
  clientName: text("client_name").notNull(),
  projectName: text("project_name"),
  projectAddress: text("project_address"),
  projectZipCode: text("project_zip_code"), // Full zip code for PandaDoc unique identifier
  value: decimal("value", { precision: 12, scale: 2 }).default("0"),
  dealStage: text("deal_stage").notNull().default("Leads"), // Leads, Contacted, Proposal, Negotiation, On Hold, Closed Won, Closed Lost
  probability: integer("probability").default(0), // 0-100
  lastContactDate: timestamp("last_contact_date").defaultNow(),
  closedAt: timestamp("closed_at"), // When deal was won/lost
  lossReason: text("loss_reason"), // Why was the deal lost?
  wonReason: text("won_reason"), // Why was the deal won?
  notes: text("notes"),
  // Payment & Retainer Status
  retainerPaid: boolean("retainer_paid").default(false), // Tracks if retainer has been received
  retainerAmount: decimal("retainer_amount", { precision: 12, scale: 2 }),
  retainerPaidDate: timestamp("retainer_paid_date"),
  // Legal & Jurisdiction
  legalJurisdiction: text("legal_jurisdiction").default("Welor County"), // For small claims court
  // Scoping Document Fields
  quoteNumber: text("quote_number"),
  buildingType: text("building_type"), // Warehouse, Commercial, Residential, etc.
  sqft: integer("sqft"),
  scope: text("scope"), // Interior Only, Exterior Only, Full Building, Roof/Facades
  disciplines: text("disciplines"), // Architecture LOD 300, MEPF LOD 300, etc.
  bimDeliverable: text("bim_deliverable"), // Revit, AutoCAD, etc. (comma-separated for multi-select)
  bimVersion: text("bim_version"), // Client template version
  // Building Features
  hasBasement: boolean("has_basement").default(false),
  hasAttic: boolean("has_attic").default(false),
  insuranceRequirements: text("insurance_requirements"), // Special insurance requirements
  // Contact Info (Project Contact)
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  // Billing Contact Info (Required for invoicing)
  billingContactName: text("billing_contact_name"),
  billingContactEmail: text("billing_contact_email"),
  billingContactPhone: text("billing_contact_phone"),
  // Travel & Dispatch
  dispatchLocation: text("dispatch_location"),
  distance: integer("distance"), // miles
  travelRate: decimal("travel_rate", { precision: 6, scale: 2 }), // $/mile
  // Timeline & Payment
  timeline: text("timeline"), // e.g., "4 weeks"
  paymentTerms: text("payment_terms"), // owner, partner, etc.
  customPaymentTerms: text("custom_payment_terms"), // Custom terms text when paymentTerms is "custom"
  // CPQ Integration
  quoteUrl: text("quote_url"), // Link to generated quote from CPQ tool
  quoteVersion: integer("quote_version"), // Current version number from CPQ (V1, V2, etc.)
  // CPQ Multi-Building Areas (JSONB array of CpqArea)
  cpqAreas: jsonb("cpq_areas"), // Array of areas with building type, sqft, scope, disciplines, LoDs
  // CPQ Risk Factors (array of risk IDs)
  cpqRisks: jsonb("cpq_risks"), // ["remote", "fastTrack", etc.]
  // CPQ Travel Configuration
  cpqTravel: jsonb("cpq_travel"), // {dispatchLocation, distance, customTravelCost}
  // CPQ Additional Services
  cpqServices: jsonb("cpq_services"), // {matterport: 1, sitePhotography: 2}
  // CPQ Extended Scoping Data
  cpqScopingData: jsonb("cpq_scoping_data"), // ACT options, deliverables, timeline, contacts, etc.
  // Lead Source Attribution (Canonical Source)
  leadSource: text("lead_source"), // Legacy field - kept for backwards compatibility
  source: text("source").default("cold_outreach"), // Canonical: abm, cold_outreach, referral_client, referral_partner, existing_customer, ceu, proof_vault, spec_standards, podcast, site_seo, permit_trigger, compliance_trigger, procurement_trigger, event_conference, social, vendor_onboarding
  // Referrer Network Effect (for referral sources)
  referrerCompanyName: text("referrer_company_name"), // Company that referred this lead
  referrerContactName: text("referrer_contact_name"), // Contact person who referred
  // Lead Priority (1-5, where 5 is highest priority)
  leadPriority: integer("lead_priority").default(3),
  // Buyer Persona (for personalized communication)
  buyerPersona: text("buyer_persona"), // BP1, BP2, BP3, etc. - see BUYER_PERSONAS constant
  // AI-Derived Intelligence (extracted from research modules)
  complexityScore: text("complexity_score"), // "Low" | "Medium" | "High" - MEP complexity from property research
  clientTier: text("client_tier"), // "SMB" | "Mid-Market" | "Enterprise" - from client research
  regulatoryRisks: jsonb("regulatory_risks"), // Array of identified regulatory risks [{risk, severity, source}]
  aiInsightsUpdatedAt: timestamp("ai_insights_updated_at"), // When AI fields were last updated
  // Google API Data (Solar API building insights + Distance Matrix travel data)
  googleIntel: jsonb("google_intel"), // {buildingInsights: {...}, travelInsights: {...}}
  // CPQ Integrity Auditor Fields (synced from CPQ validation system)
  integrityStatus: text("integrity_status"), // "pass" | "warning" | "blocked"
  integrityFlags: jsonb("integrity_flags"), // Array of {code, severity, message, details}
  requiresOverride: boolean("requires_override").default(false),
  overrideApproved: boolean("override_approved").default(false),
  overrideApprovedBy: text("override_approved_by"),
  overrideApprovedAt: timestamp("override_approved_at"),
  driveFolderId: text("drive_folder_id"), // Google Drive folder ID (early binding)
  driveFolderUrl: text("drive_folder_url"), // Direct URL to Drive folder (early binding)
  // Hybrid Storage Strategy (Legacy Drive + GCS)
  storageMode: text("storage_mode").default("legacy_drive"), // legacy_drive | hybrid_gcs | gcs_native
  gcsBucket: text("gcs_bucket"), // GCS bucket name (e.g., "s2p-active")
  gcsPath: text("gcs_path"), // GCS path for scan data (e.g., "AYON-ACME-HQ-20260108/")
  // QuickBooks Online Integration
  qboEstimateId: text("qbo_estimate_id"), // QuickBooks Estimate ID (e.g., "1024")
  qboEstimateNumber: text("qbo_estimate_number"), // QuickBooks Estimate DocNumber (e.g., "EST-1024")
  qboEstimateStatus: text("qbo_estimate_status"), // Pending, Accepted, Closed, Rejected
  qboInvoiceId: text("qbo_invoice_id"), // QuickBooks Invoice ID (e.g., "2048")
  qboInvoiceNumber: text("qbo_invoice_number"), // QuickBooks Invoice DocNumber (e.g., "INV-2048")
  qboCustomerId: text("qbo_customer_id"), // QuickBooks Customer ID
  qboSyncedAt: timestamp("qbo_synced_at"), // Last sync timestamp
  qboHasLinkedInvoice: boolean("qbo_has_linked_invoice").default(false), // Whether estimate has a linked invoice
  // Import Source Tracking
  importSource: text("import_source"), // "qbo_sync", "hubspot", "manual", "pandadoc", etc.
  // PandaDoc Integration (E-Signature)
  pandaDocId: text("pandadoc_id"), // PandaDoc Document ID
  pandaDocStatus: text("pandadoc_status"), // document_draft, document_sent, document_completed, etc.
  pandaDocSentAt: timestamp("pandadoc_sent_at"), // When document was sent for signing
  // HubSpot Integration (Growth Engine) - Legacy
  hubspotId: text("hubspot_id"), // HubSpot Contact ID
  // GoHighLevel Integration (Growth Engine)
  ghlContactId: text("ghl_contact_id"), // GoHighLevel Contact ID
  ghlOpportunityId: text("ghl_opportunity_id"), // GoHighLevel Opportunity ID
  leadScore: integer("lead_score").default(0), // Engagement-based lead score
  ownerId: text("owner_id"), // Assigned sales owner (references users.id)
  // ABM Tiering Fields (Account-Based Marketing)
  abmTier: text("abm_tier").default("None"), // Tier A, Tier B, Tier C, None
  firmSize: text("firm_size"), // 1-10, 11-50, 50-100, 100+
  discipline: text("discipline"), // Architecture, GC, Owner, MEP
  focusSector: text("focus_sector"), // e.g., "Historic Preservation"
  // Estimator Card (Required for Tier A deals before proposal)
  estimatorCardId: text("estimator_card_id"), // Google Drive file ID for estimator card PDF
  estimatorCardUrl: text("estimator_card_url"), // Direct URL to estimator card in Drive
  // Project Status Checkboxes (Proposal Phase, In Hand, Urgent, Other)
  projectStatus: jsonb("project_status"), // {proposalPhase: boolean, inHand: boolean, urgent: boolean, other: boolean, otherText: string}
  // Proof Links (URLs to proof documents, photos, floor plans)
  proofLinks: text("proof_links"), // Free-form text for storing multiple URLs
  // Site Readiness Questionnaire (Magic Link)
  siteReadiness: jsonb("site_readiness").$type<Record<string, any>>(), // Answers to site readiness questions
  siteReadinessQuestionsSent: jsonb("site_readiness_questions_sent").$type<string[]>(), // Question IDs sent to client
  siteReadinessStatus: text("site_readiness_status").default("pending"), // pending | sent | completed
  siteReadinessSentAt: timestamp("site_readiness_sent_at"), // When magic link was sent
  siteReadinessCompletedAt: timestamp("site_readiness_completed_at"), // When client submitted answers
  clientToken: text("client_token"), // Magic link token for public access
  clientTokenExpiresAt: timestamp("client_token_expires_at"), // Token expiration
  // Deliberate Affirmation Pattern (tracks explicit "N/A" decisions for data quality)
  fieldAffirmations: jsonb("field_affirmations").$type<Record<string, boolean>>(), // {contactPhone: true, proofLinks: true} = explicitly marked N/A
  // Hungry Fields - Missing Info Tracking (fields marked "I don't know" for follow-up)
  missingInfo: jsonb("missing_info").$type<Array<{
    fieldKey: string;          // e.g., "timeline", "paymentTerms", "proofLinks"
    question: string;          // Human-readable question for follow-up
    addedAt: string;           // ISO timestamp when marked unknown
    status: "pending" | "sent" | "answered";
    sentAt?: string;           // When follow-up was sent
    answeredAt?: string;       // When client answered
  }>>(),
  // Soft Delete (60-day trash can)
  deletedAt: timestamp("deleted_at"), // When record was moved to trash (null = active)
  deletedBy: text("deleted_by"), // User ID who deleted the record
  // Client Signature (open-source alternative to PandaDoc)
  signatureImage: text("signature_image"), // Base64 PNG of signature
  signerName: text("signer_name"), // Full name of person who signed
  signerEmail: text("signer_email"), // Email of person who signed
  signerTitle: text("signer_title"), // Title/role of person who signed
  signedAt: timestamp("signed_at"), // When proposal was signed
  signatureProposalId: integer("signature_proposal_id"), // Which proposal version to use for signature
  // Signature Audit Trail (for ESIGN Act compliance)
  signerIpAddress: text("signer_ip_address"),
  signerUserAgent: text("signer_user_agent"),
  documentHash: text("document_hash"),
  // Sender/Proposal-Maker Signature (Scan2Plan representative)
  senderSignatureImage: text("sender_signature_image"), // Base64 PNG of sender signature
  senderSignerName: text("sender_signer_name"), // Full name of Scan2Plan rep
  senderSignerEmail: text("sender_signer_email"), // Email of Scan2Plan rep
  senderSignerTitle: text("sender_signer_title"), // Title (e.g., "Account Manager")
  senderSignedAt: timestamp("sender_signed_at"), // When sender signed
  senderViewedAt: timestamp("sender_viewed_at"), // When sender first viewed the signing page
  senderIpAddress: text("sender_ip_address"), // IP address for audit trail
  senderUserAgent: text("sender_user_agent"), // Browser UA for audit trail
  senderToken: text("sender_token"), // Magic link token for sender signing
  senderTokenExpiresAt: timestamp("sender_token_expires_at"), // Token expiration
  // Proposal Tracking Timestamps
  proposalSentAt: timestamp("proposal_sent_at"), // When signature link was sent to client
  proposalViewedAt: timestamp("proposal_viewed_at"), // When client first viewed the proposal
  // Certificate of Signature Reference
  certificateRefNumber: text("certificate_ref_number"), // Unique reference for certificate (e.g., "LNXDW-8Q8WR-C7TW6-89K4S")
  // Mautic Marketing Automation
  mauticContactId: text("mautic_contact_id"), // Mautic Contact ID for marketing sync

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === MARKETING SEQUENCES ===
export const sequences = pgTable("sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "New Lead Nurture"
  description: text("description"),
  triggerType: text("trigger_type").default("manual"), // manual, stage_change, form_submission
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sequenceSteps = pgTable("sequence_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").references(() => sequences.id).notNull(),
  stepOrder: integer("step_order").notNull(), // 1, 2, 3...
  delayDays: integer("delay_days").default(0), // Days to wait after previous step
  type: text("type").notNull().default("email"), // email, task, sms
  subject: text("subject"), // For emails
  content: text("content"), // Email body or task description
  templateId: text("template_id"), // Optional link to a template
  createdAt: timestamp("created_at").defaultNow(),
});

export const sequenceEnrollments = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  sequenceId: integer("sequence_id").references(() => sequences.id).notNull(),
  currentStep: integer("current_step").default(1),
  status: text("status").default("active"), // active, completed, paused, cancelled
  nextExecutionAt: timestamp("next_execution_at"), // When the next step should run
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertSequenceSchema = createInsertSchema(sequences);
export const insertSequenceStepSchema = createInsertSchema(sequenceSteps);
export const insertSequenceEnrollmentSchema = createInsertSchema(sequenceEnrollments);
export type Sequence = typeof sequences.$inferSelect;
export type SequenceStep = typeof sequenceSteps.$inferSelect;
export type SequenceEnrollment = typeof sequenceEnrollments.$inferSelect;

// === DEAL ATTRIBUTIONS (Marketing Influence "Assist" Tracker) ===
export const dealAttributions = pgTable("deal_attributions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  // The influence channel touchpoint
  touchpoint: text("touchpoint").notNull(), // proof_vault, spec_standards, castle, deck_library, ceu, case_study, site_page, podcast, social
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const insertDealAttributionSchema = createInsertSchema(dealAttributions).omit({
  id: true,
  recordedAt: true,
});
export type InsertDealAttribution = z.infer<typeof insertDealAttributionSchema>;
export type DealAttribution = typeof dealAttributions.$inferSelect;

// === EVENTS (Education-Led Sales / CEU Strategy) ===
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // e.g., "Scanning for Historic Preservation"
  description: text("description"),
  date: timestamp("date").notNull(),
  type: text("type").notNull().default("webinar"), // webinar, lunch_learn
  ceuCredits: decimal("ceu_credits", { precision: 4, scale: 2 }).default("0"), // AIA CEU credits
  location: text("location"), // Physical location or "Virtual"
  maxAttendees: integer("max_attendees"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
}).extend({
  type: z.enum(EVENT_TYPES),
  ceuCredits: z.coerce.number().min(0).optional(),
  date: z.coerce.date(),
  maxAttendees: z.coerce.number().min(1).optional(),
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// === EVENT REGISTRATIONS (Tracking CEU Strategy) ===
export const eventRegistrations = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  status: text("status").notNull().default("registered"), // registered, attended, certificate_sent
  registeredAt: timestamp("registered_at").defaultNow(),
  attendedAt: timestamp("attended_at"),
  certificateSentAt: timestamp("certificate_sent_at"),
});

export const insertEventRegistrationSchema = createInsertSchema(eventRegistrations).omit({
  id: true,
  registeredAt: true,
  attendedAt: true,
  certificateSentAt: true,
}).extend({
  status: z.enum(REGISTRATION_STATUSES).optional(),
});
export type InsertEventRegistration = z.infer<typeof insertEventRegistrationSchema>;
export type EventRegistration = typeof eventRegistrations.$inferSelect;

// === LEAD RESEARCH (Deep Research Results) ===
export const leadResearch = pgTable("lead_research", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  researchType: text("research_type").notNull(), // "client" or "property"
  summary: text("summary").notNull(),
  highlights: text("highlights"), // JSON array of key findings
  citations: text("citations"), // JSON array of source URLs
  rawResponse: text("raw_response"), // Full API response for debugging
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadResearchSchema = createInsertSchema(leadResearch).omit({
  id: true,
  createdAt: true,
});
export type InsertLeadResearch = z.infer<typeof insertLeadResearchSchema>;
export type LeadResearch = typeof leadResearch.$inferSelect;

// === LEAD DOCUMENTS (Files attached to deals) ===
export const leadDocuments = pgTable("lead_documents", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: text("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  movedToDriveAt: timestamp("moved_to_drive_at"),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  metadata: jsonb("metadata"),
});

export const insertLeadDocumentSchema = createInsertSchema(leadDocuments).omit({
  id: true,
  uploadedAt: true,
  movedToDriveAt: true,
  driveFileId: true,
  driveFileUrl: true,
  metadata: true,
});
export type InsertLeadDocument = z.infer<typeof insertLeadDocumentSchema>;
export type LeadDocument = typeof leadDocuments.$inferSelect;

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  value: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return null;
      const num = Number(val);
      return Number.isNaN(num) ? null : num;
    },
    z.number().nullable().optional()
  ),
  probability: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return null;
      const num = Number(val);
      return Number.isNaN(num) ? null : num;
    },
    z.number().min(0).max(100).nullable().optional()
  ),
  projectName: optionalString,
  quoteNumber: optionalString,
  buildingType: optionalString,
  sqft: optionalNumber,
  scope: optionalString,
  disciplines: optionalString,
  bimDeliverable: optionalString,
  bimVersion: optionalString,
  contactName: optionalString,
  contactEmail: optionalString,
  contactPhone: optionalString,
  billingContactName: optionalString,
  billingContactEmail: optionalString,
  billingContactPhone: optionalString,
  dispatchLocation: optionalString,
  distance: optionalNumber,
  travelRate: optionalNumber,
  timeline: optionalString,
  paymentTerms: optionalString,
  notes: optionalString,
  quoteUrl: optionalString,
  quoteVersion: optionalNumber,
  leadSource: optionalString,
  source: optionalString,
  referrerCompanyName: optionalString,
  referrerContactName: optionalString,
  leadPriority: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return undefined;
      const num = Number(val);
      return Number.isNaN(num) ? undefined : num;
    },
    z.number().min(1).max(5).optional().default(3)
  ),
  buyerPersona: optionalString, // BP1, BP2, etc.
  // CPQ Integration fields (JSONB)
  cpqAreas: z.array(cpqAreaSchema).optional(),
  cpqRisks: z.array(z.enum(CPQ_RISK_FACTORS)).optional(),
  cpqTravel: cpqTravelSchema.optional(),
  cpqServices: z.record(z.enum(CPQ_SERVICES), z.number()).optional(),
  cpqScopingData: cpqScopingDataSchema.optional(),
  // AI-Derived Intelligence fields
  complexityScore: z.enum(COMPLEXITY_SCORES).optional(),
  clientTier: z.enum(CLIENT_TIERS).optional(),
  regulatoryRisks: z.array(regulatoryRiskSchema).optional(),
  aiInsightsUpdatedAt: z.coerce.date().optional(),
  // Hybrid Storage fields
  storageMode: z.enum(STORAGE_MODES).optional(),
  gcsBucket: z.string().optional(),
  gcsPath: z.string().optional(),
  // ABM Tiering fields
  abmTier: z.enum(ABM_TIERS).optional(),
  firmSize: z.enum(FIRM_SIZES).optional(),
  discipline: z.enum(COMPANY_DISCIPLINES).optional(),
  focusSector: optionalString,
  // Project Status Checkboxes
  projectStatus: z.object({
    proposalPhase: z.boolean().optional(),
    inHand: z.boolean().optional(),
    urgent: z.boolean().optional(),
    other: z.boolean().optional(),
    otherText: z.string().optional(),
  }).optional(),
  // Proof Links
  proofLinks: optionalString,
  // Hungry Fields - Missing Info for follow-up
  missingInfo: z.array(z.object({
    fieldKey: z.string(),
    question: z.string(),
    addedAt: z.string(),
    status: z.enum(["pending", "sent", "answered"]),
    sentAt: z.string().optional(),
    answeredAt: z.string().optional(),
  })).optional(),
});

// === SCANTECHS (Field Technicians) ===
export const scantechs = pgTable("scantechs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  baseLocation: text("base_location").notNull(), // City/region where technician is based
  canDoTravel: boolean("can_do_travel").default(false), // Can handle out-of-state travel jobs
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScantechSchema = createInsertSchema(scantechs).omit({
  id: true,
  createdAt: true,
});
export type InsertScantech = z.infer<typeof insertScantechSchema>;
export type Scantech = typeof scantechs.$inferSelect;

// === PROJECTS (Production Tracker) ===
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  universalProjectId: text("universal_project_id").unique(), // [ClientCode]-[YYMMDD]-[Seq] links QuickBooks accounting with production
  leadId: integer("lead_id").references(() => leads.id), // Optional link to lead
  assignedTechId: integer("assigned_tech_id").references(() => scantechs.id), // Assigned ScanTech
  name: text("name").notNull(),
  status: text("status").notNull().default("Scheduling"), // Scheduling, Scanning, Registration, Modeling, QC, Delivered
  priority: text("priority").default("Medium"), // Low, Medium, High
  dueDate: timestamp("due_date"),
  progress: integer("progress").default(0), // 0-100
  // LoD/LoA Standards (Scan2Plan "Measure of Excellence")
  targetLoD: text("target_lod").default("LOD 300"), // Level of Development per USIBD
  targetLoaMeasured: text("target_loa_measured").default("LoA 40"), // ≤ 1/4" measured tolerance (S2P standard)
  targetLoaModeled: text("target_loa_modeled").default("LoA 30"), // ≤ 1/2" modeled tolerance (S2P standard)
  // Square Foot Audit Fields (10% Variance Hard Gate)
  estimatedSqft: integer("estimated_sqft"), // Client-provided estimate
  actualSqft: integer("actual_sqft"), // Scanned/measured actual
  sqftVariance: decimal("sqft_variance", { precision: 5, scale: 2 }), // Percentage variance
  sqftAuditComplete: boolean("sqft_audit_complete").default(false), // Auto-set: true if ≤10% variance, false if >10%
  billingAdjustmentApproved: boolean("billing_adjustment_approved").default(false), // Hard Gate: Must be approved if variance >10% to proceed to Modeling/Delivered
  // QC 3-Stage Validation Gates (Scanning → Registration → Modeling)
  bValidationStatus: text("b_validation_status").default("pending"), // Cross-scan alignment validation
  cValidationStatus: text("c_validation_status").default("pending"), // Control point alignment (optional)
  registrationRms: decimal("registration_rms", { precision: 6, scale: 3 }), // RMS value in inches (LoA compliance)
  registrationPassedAt: timestamp("registration_passed_at"), // When B/C validation passed
  registrationNotes: text("registration_notes"), // Technician notes on registration
  // LEED v5 Embodied Carbon Tracking (A1-A3 Cradle-to-Gate GWP)
  leedCarbonEnabled: boolean("leed_carbon_enabled").default(false), // Track embodied carbon for this project
  gwpBaseline: decimal("gwp_baseline", { precision: 12, scale: 2 }), // Baseline kgCO2e for reference building
  gwpActual: decimal("gwp_actual", { precision: 12, scale: 2 }), // Actual kgCO2e from BoM analysis
  gwpReductionTarget: integer("gwp_reduction_target").default(10), // % reduction target (LEED v5 = 5-20%)
  bomMaterials: jsonb("bom_materials"), // Bill of Materials [{material, quantity, unit, gwpFactor, gwpTotal}]
  bomNotes: text("bom_notes"), // Notes on material choices and carbon reduction strategies
  // Google Drive Integration
  driveFolderId: text("drive_folder_id"), // Google Drive folder ID for project files
  driveFolderUrl: text("drive_folder_url"), // Direct URL to the Google Drive folder
  driveFolderStatus: text("drive_folder_status").default("pending"), // pending, success, failed
  driveSubfolders: jsonb("drive_subfolders"), // {fieldCapture, bimProduction, accountingFinancials, clientDeliverables, additionalDocuments}
  // Travel-Aware Scheduling
  scanDate: timestamp("scan_date"), // Scheduled scan date
  calendarEventId: text("calendar_event_id"), // Google Calendar event ID
  travelDistanceMiles: decimal("travel_distance_miles", { precision: 8, scale: 2 }), // Distance from office to site
  travelDurationMinutes: integer("travel_duration_minutes"), // Travel time in minutes
  travelScenario: text("travel_scenario"), // local, regional, flyout
  // Project Concierge (Google Chat Integration)
  chatSpaceId: text("chat_space_id"), // Google Chat space ID (e.g., spaces/XXXXXXX)
  chatSpaceUrl: text("chat_space_url"), // URL to the Chat space
  // Hybrid Storage Strategy (Legacy Drive + GCS)
  storageMode: text("storage_mode").default("legacy_drive"), // legacy_drive | hybrid_gcs | gcs_native
  gcsBucket: text("gcs_bucket"), // GCS bucket name (e.g., "s2p-active")
  gcsPath: text("gcs_path"), // GCS path for scan data (e.g., "AYON-ACME-HQ-20260108/")
  // Real-Time Margin Tracking
  vendorCostActual: decimal("vendor_cost_actual", { precision: 12, scale: 2 }), // Calculated vendor cost based on rates
  marginActual: decimal("margin_actual", { precision: 12, scale: 2 }), // Revenue - Vendor Cost
  marginPercent: decimal("margin_percent", { precision: 5, scale: 2 }), // Margin as percentage
  // Point Cloud Delivery (Heavy Artillery - Potree Integration)
  potreePath: text("potree_path"), // Internal GCS path to converted point cloud
  viewerUrl: text("viewer_url"), // Public/Signed URL for Potree viewer
  deliveryStatus: text("delivery_status").default("pending"), // pending | processing | ready | failed

  // === CPQ Inheritance (from lead at time of Closed Won) ===
  quotedPrice: decimal("quoted_price", { precision: 12, scale: 2 }),
  quotedMargin: decimal("quoted_margin", { precision: 5, scale: 2 }),
  quotedAreas: jsonb("quoted_areas").$type<any[]>(), // Snapshot of cpqAreas
  quotedRisks: jsonb("quoted_risks").$type<any>(), // Snapshot of cpqRisks
  quotedTravel: jsonb("quoted_travel").$type<any>(), // Snapshot of cpqTravel
  quotedServices: jsonb("quoted_services").$type<any>(), // Snapshot of cpqServices

  // === Site Readiness Inheritance ===
  siteReadiness: jsonb("site_readiness").$type<Record<string, any>>(),

  // === Client Contact (snapshot at close) ===
  clientName: text("client_name"),
  clientContact: text("client_contact"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  projectAddress: text("project_address"),

  // === Dispatch & Travel ===
  dispatchLocation: text("dispatch_location"),
  distance: integer("distance"),

  // === Scope Summary (auto-generated plain English) ===
  scopeSummary: text("scope_summary"),

  // Deliberate Affirmation Pattern (tracks explicit "N/A" decisions for data quality)
  fieldAffirmations: jsonb("field_affirmations").$type<Record<string, boolean>>(),

  // === Field Equipment Configuration ===
  scannerType: text("scanner_type").default("trimble_x7"), // trimble_x7 | navvis_slam
  matterportRequired: boolean("matterport_required").default(false),
  droneRequired: boolean("drone_required").default(false),
  extensionTripodNeeded: boolean("extension_tripod_needed").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

// === PRODUCTS (CPQ Catalog) ===
import { PRODUCT_CATEGORIES, PRICING_MODELS } from "./constants";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(), // e.g., "S2P COM 300"
  name: text("name").notNull(), // e.g., "Scan2Plan Commercial - LoD 300"
  description: text("description"),
  category: text("category").notNull(), // S2P, Added Disciplines, Add Ons, etc.
  type: text("type").default("Service"), // Service, Non-Inventory

  // Pricing Configuration
  price: decimal("price", { precision: 12, scale: 2 }).default("0"),
  pricingModel: text("pricing_model").default("Fixed"), // Fixed, PerSqFt, Percentage, Dynamic

  // Configurator Attributes (The "Lookup Engine" Logic)
  attributes: jsonb("attributes").$type<{
    propertyType?: "Residential" | "Commercial" | "Industrial" | string;
    scope?: "Interior" | "Exterior" | "Both" | string;
    lod?: "200" | "300" | "350" | string;
    discipline?: "Architecture" | "MEP" | "Structure" | string;
  }>(),

  // QuickBooks Integration
  qboItemId: text("qbo_item_id"), // Synced QB Item ID
  qboAccountName: text("qbo_account_name"), // Income Account

  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// === VENDOR RATES (Margin Tracking) ===
export const vendorRates = pgTable("vendor_rates", {
  id: serial("id").primaryKey(),
  discipline: text("discipline"), // "arch", "mep", "structure"
  lod: text("lod"), // "200", "300", "350"
  tier: text("tier").default("standard"), // "standard", "premium"
  ratePerSqft: decimal("rate_per_sqft", { precision: 10, scale: 4 }), // 0.0450
});

export const insertVendorRateSchema = createInsertSchema(vendorRates).omit({
  id: true,
});
export type VendorRate = typeof vendorRates.$inferSelect;
export type InsertVendorRate = z.infer<typeof insertVendorRateSchema>;

// LEED v5 Bill of Materials item schema
export const bomItemSchema = z.object({
  material: z.string(),
  category: z.enum(["Concrete", "Steel", "Aluminum", "Glass", "Insulation", "Other"]).optional(),
  quantity: z.number().min(0),
  unit: z.enum(["kg", "m3", "m2", "ea", "lf"]),
  gwpFactor: z.number().min(0), // kgCO2e per unit (A1-A3 stages)
  gwpTotal: z.number().min(0), // quantity × gwpFactor
});

export type BomItem = z.infer<typeof bomItemSchema>;

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  universalProjectId: true, // Auto-generated on backend
}).partial().extend({
  name: z.string(),
  progress: z.coerce.number().min(0).max(100).optional().default(0),
  dueDate: z.coerce.date().optional(),
  targetLoD: z.enum(LOD_LEVELS).optional(),
  targetLoaMeasured: z.enum(LOA_LEVELS).optional(),
  targetLoaModeled: z.enum(LOA_LEVELS).optional(),
  estimatedSqft: z.coerce.number().min(0).optional(),
  actualSqft: z.coerce.number().min(0).optional(),
  sqftVariance: z.coerce.number().optional(),
  sqftAuditComplete: z.boolean().optional(),
  billingAdjustmentApproved: z.boolean().optional(),
  bValidationStatus: z.enum(QC_VALIDATION_STATUS).optional(),
  cValidationStatus: z.enum(QC_VALIDATION_STATUS).optional(),
  registrationRms: z.coerce.number().min(0).optional(),
  registrationPassedAt: z.coerce.date().optional(),
  registrationNotes: z.string().optional(),
  // LEED v5 Embodied Carbon fields
  leedCarbonEnabled: z.boolean().optional(),
  gwpBaseline: z.coerce.number().min(0).optional(),
  gwpActual: z.coerce.number().min(0).optional(),
  gwpReductionTarget: z.coerce.number().min(0).max(100).optional(),
  bomMaterials: z.array(bomItemSchema).optional(),
  bomNotes: z.string().optional(),
  driveFolderId: z.string().optional(),
  driveFolderUrl: z.string().optional(),
  driveFolderStatus: z.enum(["pending", "success", "failed"]).optional(),
  driveSubfolders: z.object({
    fieldCapture: z.string(),
    bimProduction: z.string(),
    accountingFinancials: z.string(),
    clientDeliverables: z.string(),
    additionalDocuments: z.string().optional(),
  }).optional(),
  chatSpaceId: z.string().optional(),
  chatSpaceUrl: z.string().optional(),
  // Hybrid Storage fields
  storageMode: z.enum(STORAGE_MODES).optional(),
  gcsBucket: z.string().optional(),
  gcsPath: z.string().optional(),
  // Point Cloud Delivery (Potree Integration)
  potreePath: z.string().optional(),
  viewerUrl: z.string().optional(),
  deliveryStatus: z.enum(["pending", "processing", "ready", "failed"]).optional(),
  // Field Equipment Configuration
  scannerType: z.enum(["trimble_x7", "navvis_slam"]).optional(),
  matterportRequired: z.boolean().optional(),
  droneRequired: z.boolean().optional(),
  extensionTripodNeeded: z.boolean().optional(),
});

// === FIELD NOTES (AI Technical Translation) ===
export const fieldNotes = pgTable("field_notes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  leadId: integer("lead_id").references(() => leads.id),
  rawContent: text("raw_content").notNull(),
  processedScope: text("processed_scope"), // The AI translation
  status: text("status").default("Pending"), // Pending, Processing, Completed, Failed
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFieldNoteSchema = createInsertSchema(fieldNotes).omit({
  id: true,
  createdAt: true,
  processedScope: true,
  status: true
});

// === SCAN TECH TIME LOGS (Automated Clock In/Out) ===
export const timeLogs = pgTable("time_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  techId: text("tech_id").notNull(), // User ID of the technician
  arrivalTime: timestamp("arrival_time"),
  departureTime: timestamp("departure_time"),
  totalSiteMinutes: integer("total_site_minutes"),
  type: text("type").default("Automatic"), // Automatic (GPS) or Manual
  workType: text("work_type").default("Scanning"), // Scanning, Travel, Modeling, Site Prep, Other (different pay rates)
  roleType: text("role_type").default("tech"), // "tech" | "admin" | "sales" - Dual Hat tracking
  hourlyCost: decimal("hourly_cost", { precision: 10, scale: 2 }), // Snapshot of cost at time of work
  latitude: decimal("latitude", { precision: 10, scale: 7 }), // GPS coords at clock-in
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  notes: text("notes"), // Optional technician notes
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimeLogSchema = createInsertSchema(timeLogs).omit({
  id: true,
  createdAt: true,
  totalSiteMinutes: true,
});

export const missionLogs = pgTable("mission_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  techId: text("tech_id").notNull(),
  missionDate: timestamp("mission_date").defaultNow(),

  // Four-point timestamps
  startTravelTime: timestamp("start_travel_time"), // Departure from home/office
  arriveSiteTime: timestamp("arrive_site_time"),   // Arrival at project location
  leaveSiteTime: timestamp("leave_site_time"),     // Completion of scan/walkthrough
  arriveHomeTime: timestamp("arrive_home_time"),   // Arrival back at home/office

  // Manual override flags (true if manually entered vs auto-tapped)
  startTravelManual: boolean("start_travel_manual").default(false),
  arriveSiteManual: boolean("arrive_site_manual").default(false),
  leaveSiteManual: boolean("leave_site_manual").default(false),
  arriveHomeManual: boolean("arrive_home_manual").default(false),

  // Calculated durations (in minutes)
  travelDurationMinutes: integer("travel_duration_minutes"),
  scanningDurationMinutes: integer("scanning_duration_minutes"),

  // Status
  status: text("status").default("in_progress"), // in_progress, completed, invoiced
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMissionLogSchema = createInsertSchema(missionLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  travelDurationMinutes: true,
  scanningDurationMinutes: true,
});
export type MissionLog = typeof missionLogs.$inferSelect;
export type InsertMissionLog = z.infer<typeof insertMissionLogSchema>;

export const siteIntelligence = pgTable("site_intelligence", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  techId: text("tech_id").notNull(),
  videoUrl: text("video_url"), // URL to stored video file
  audioUrl: text("audio_url"), // URL to stored audio file
  transcript: text("transcript"), // Whisper transcription
  aiSummary: text("ai_summary"), // GPT analysis of the walkthrough
  obstructions: text("obstructions"), // Extracted: Physical site obstructions
  lightingConditions: text("lighting_conditions"), // Extracted: Lighting conditions
  confirmedAreas: text("confirmed_areas"), // Extracted: Rooms/areas confirmed for scanning
  scopeChanges: text("scope_changes"), // Extracted: Any requested changes to original scope
  status: text("status").default("recording"), // recording, transcribing, analyzing, complete
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSiteIntelligenceSchema = createInsertSchema(siteIntelligence).omit({
  id: true,
  createdAt: true,
  transcript: true,
  aiSummary: true,
  obstructions: true,
  lightingConditions: true,
  confirmedAreas: true,
  scopeChanges: true,
  status: true,
});
export const projectAttachments = pgTable("project_attachments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  leadId: integer("lead_id").references(() => leads.id), // Optional: attach to lead before project exists
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(), // Original filename before renaming
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"), // Size in bytes
  driveFileId: text("drive_file_id").notNull(), // Google Drive file ID
  driveFileUrl: text("drive_file_url").notNull(), // webViewLink for browser viewing
  driveDownloadUrl: text("drive_download_url"), // webContentLink for direct download
  thumbnailUrl: text("thumbnail_url"), // For image preview
  subfolder: text("subfolder").default("01_Field_Capture"), // Which Drive subfolder
  source: text("source").default("manual"), // manual, visual_scope, document_ai, client_upload
  uploadedBy: text("uploaded_by"), // User ID who uploaded
  status: text("status").default("ready"), // processing, ready, failed
  aiTags: jsonb("ai_tags"), // AI-extracted tags/metadata
  version: integer("version").default(1), // File version tracking
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectAttachmentSchema = createInsertSchema(projectAttachments).omit({
  id: true,
  createdAt: true,
}).extend({
  source: z.enum(ATTACHMENT_SOURCE).optional(),
  status: z.enum(ATTACHMENT_STATUS).optional(),
});

export type ProjectAttachment = typeof projectAttachments.$inferSelect;
export type InsertProjectAttachment = z.infer<typeof insertProjectAttachmentSchema>;
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});
export const quickbooksTokens = pgTable("quickbooks_tokens", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  realmId: text("realm_id").notNull(), // QuickBooks company ID
  expiresAt: timestamp("expires_at").notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type QuickBooksToken = typeof quickbooksTokens.$inferSelect;
export const qbCustomers = pgTable("qb_customers", {
  id: serial("id").primaryKey(),
  qbId: text("qb_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  fax: text("fax"),
  billingLine1: text("billing_line1"),
  billingLine2: text("billing_line2"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingPostalCode: text("billing_postal_code"),
  billingCountry: text("billing_country"),
  shippingLine1: text("shipping_line1"),
  shippingLine2: text("shipping_line2"),
  shippingCity: text("shipping_city"),
  shippingState: text("shipping_state"),
  shippingPostalCode: text("shipping_postal_code"),
  shippingCountry: text("shipping_country"),
  balance: decimal("balance", { precision: 12, scale: 2 }),
  active: boolean("active").default(true),
  // CRM / Enrichment Fields
  website: text("website"),
  industry: text("industry"),
  employeeCount: text("employee_count"),
  linkedinUrl: text("linkedin_url"),
  marketingStatus: text("marketing_status").default("Lead"), // Lead, Customer, Churned, Partner
  tags: text("tags").array(), // Application-level tags
  notes: text("notes"),
  enrichmentData: jsonb("enrichment_data"), // AI gathered data
  syncedAt: timestamp("synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQbCustomerSchema = createInsertSchema(qbCustomers).omit({
  id: true,
  createdAt: true,
  syncedAt: true,
});
export type InsertQbCustomer = z.infer<typeof insertQbCustomerSchema>;
export type QbCustomer = typeof qbCustomers.$inferSelect;

// === EXPENSES (From QuickBooks or Field Entry) ===
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  qbExpenseId: text("qb_expense_id").unique(), // QuickBooks expense ID (null for field entries)
  leadId: integer("lead_id").references(() => leads.id), // Optional link to deal
  projectId: integer("project_id").references(() => projects.id), // Optional link to project
  techId: text("tech_id"), // User ID of technician who entered (for field expenses)
  vendorName: text("vendor_name"),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: timestamp("expense_date"),
  category: text("category"), // e.g., "Parking", "Tolls", "Fuel", "Meals", "Hotel", etc.
  accountName: text("account_name"), // QuickBooks account name
  source: text("source").default("field"), // "field" for manual entry, "quickbooks" for QB sync
  isBillable: boolean("is_billable").default(true), // Field expenses are billable by default
  receiptUrl: text("receipt_url"), // Optional photo of receipt
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  syncedAt: true,
  createdAt: true,
});
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// === PROFIT FIRST ACCOUNTS (Virtual/Real Bank Balances) ===
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  accountType: text("account_type").notNull(), // Operating, Taxes, Debt, Marketing
  actualBalance: decimal("actual_balance", { precision: 14, scale: 2 }).default("0"), // Real M&T balance
  virtualBalance: decimal("virtual_balance", { precision: 14, scale: 2 }).default("0"), // Should-be balance from allocations
  allocationPercent: decimal("allocation_percent", { precision: 5, scale: 2 }).notNull(), // e.g., 10.00 for 10%
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  actualBalance: z.coerce.number().default(0),
  virtualBalance: z.coerce.number().default(0),
  allocationPercent: z.coerce.number().min(0).max(100),
});
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

// === INVOICES (Accounts Receivable with Interest Tracking) ===
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  projectId: integer("project_id").references(() => projects.id),
  invoiceNumber: text("invoice_number").notNull(),
  clientName: text("client_name").notNull(),
  description: text("description"),
  totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 14, scale: 2 }).default("0"),
  interestAccrued: decimal("interest_accrued", { precision: 14, scale: 2 }).default("0"), // 8% monthly penalty
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  status: text("status").notNull().default("Sent"), // Draft, Sent, Paid, Partial, Overdue, Collections, Written Off
  daysOverdue: integer("days_overdue").default(0),
  isHighRisk: boolean("is_high_risk").default(false), // Flag for >$50k or >60 days overdue
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  daysOverdue: true,
  isHighRisk: true,
  interestAccrued: true,
}).extend({
  totalAmount: z.coerce.number().min(0),
  amountPaid: z.coerce.number().min(0).default(0),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  paidDate: z.coerce.date().optional().nullable(),
});
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export const internalLoans = pgTable("internal_loans", {
  id: serial("id").primaryKey(),
  fromAccountType: text("from_account_type").notNull(), // e.g., "Taxes"
  toAccountType: text("to_account_type").notNull(), // e.g., "Operating"
  originalAmount: decimal("original_amount", { precision: 14, scale: 2 }).notNull(),
  amountRepaid: decimal("amount_repaid", { precision: 14, scale: 2 }).default("0"),
  remainingBalance: decimal("remaining_balance", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason"),
  loanDate: timestamp("loan_date").notNull(),
  targetRepayDate: timestamp("target_repay_date"),
  isFullyRepaid: boolean("is_fully_repaid").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInternalLoanSchema = createInsertSchema(internalLoans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  remainingBalance: true,
  isFullyRepaid: true,
}).extend({
  originalAmount: z.coerce.number().min(0),
  amountRepaid: z.coerce.number().min(0).default(0),
  loanDate: z.coerce.date(),
  targetRepayDate: z.coerce.date().optional().nullable(),
});
export type InternalLoan = typeof internalLoans.$inferSelect;
export type InsertInternalLoan = z.infer<typeof insertInternalLoanSchema>;
export const vendorPayables = pgTable("vendor_payables", {
  id: serial("id").primaryKey(),
  vendorName: text("vendor_name").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  dueDate: timestamp("due_date"),
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: text("recurring_frequency"), // Monthly, Weekly, Quarterly
  priority: integer("priority").default(3), // 1-5, 5 = highest priority
  isPaid: boolean("is_paid").default(false),
  paidDate: timestamp("paid_date"),
  category: text("category"), // Loan, Insurance, Software, Contractor, etc.
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVendorPayableSchema = createInsertSchema(vendorPayables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.coerce.number().min(0),
  dueDate: z.coerce.date().optional().nullable(),
  paidDate: z.coerce.date().optional().nullable(),
  priority: z.coerce.number().min(1).max(5).default(3),
});
export type VendorPayable = typeof vendorPayables.$inferSelect;
export type InsertVendorPayable = z.infer<typeof insertVendorPayableSchema>;
export const quoteVersions = pgTable("quote_versions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  versionNumber: integer("version_number").notNull(),
  cpqQuoteId: text("cpq_quote_id"), // ID/slug from CPQ system
  quoteUrl: text("quote_url"), // Direct link to this version
  priceSnapshot: jsonb("price_snapshot"), // { total, lineItems, labor, travel, etc. }
  summary: text("summary"), // Brief description of changes
  createdBy: text("created_by"), // User who created this version
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteVersionSchema = createInsertSchema(quoteVersions).omit({
  id: true,
  createdAt: true,
});
export type QuoteVersion = typeof quoteVersions.$inferSelect;
export type InsertQuoteVersion = z.infer<typeof insertQuoteVersionSchema>;
export const cpqPricingMatrix = pgTable("cpq_pricing_matrix", {
  id: serial("id").primaryKey(),
  buildingTypeId: integer("building_type_id").notNull(),
  areaTier: text("area_tier").notNull(),
  discipline: text("discipline").notNull(),
  lod: text("lod").notNull(),
  ratePerSqFt: decimal("rate_per_sq_ft", { precision: 10, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cpqUpteamPricingMatrix = pgTable("cpq_upteam_pricing_matrix", {
  id: serial("id").primaryKey(),
  buildingTypeId: integer("building_type_id").notNull(),
  areaTier: text("area_tier").notNull(),
  discipline: text("discipline").notNull(),
  lod: text("lod").notNull(),
  ratePerSqFt: decimal("rate_per_sq_ft", { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cpqCadPricingMatrix = pgTable("cpq_cad_pricing_matrix", {
  id: serial("id").primaryKey(),
  buildingTypeId: integer("building_type_id").notNull(),
  areaTier: text("area_tier").notNull(),
  packageType: text("package_type").notNull(),
  ratePerSqFt: decimal("rate_per_sq_ft", { precision: 10, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cpqPricingParameters = pgTable("cpq_pricing_parameters", {
  id: serial("id").primaryKey(),
  parameterKey: text("parameter_key").notNull().unique(),
  parameterValue: text("parameter_value").notNull(),
  parameterType: text("parameter_type").notNull(),
  description: text("description"),
  category: text("category"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const cpqQuotes = pgTable("cpq_quotes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  quoteNumber: text("quote_number").notNull(),

  clientName: text("client_name"),
  projectName: text("project_name").notNull(),
  projectAddress: text("project_address").notNull(),
  specificBuilding: text("specific_building"),
  typeOfBuilding: text("type_of_building").notNull(),
  hasBasement: boolean("has_basement").default(false),
  hasAttic: boolean("has_attic").default(false),
  notes: text("notes"),

  scopingMode: boolean("scoping_mode").default(false).notNull(),
  areas: jsonb("areas").notNull(),
  risks: jsonb("risks").default('[]').notNull(),

  dispatchLocation: text("dispatch_location").notNull(),
  distance: integer("distance"),
  customTravelCost: decimal("custom_travel_cost", { precision: 12, scale: 2 }),

  services: jsonb("services").default('{}').notNull(),
  scopingData: jsonb("scoping_data"),

  totalPrice: decimal("total_price", { precision: 12, scale: 2 }),
  pricingBreakdown: jsonb("pricing_breakdown"),

  parentQuoteId: integer("parent_quote_id"),
  versionNumber: integer("version_number").default(1).notNull(),
  versionName: text("version_name"),
  isLatest: boolean("is_latest").default(true).notNull(),

  // Additional fields for unified deal workspace
  travel: jsonb("travel"),
  paymentTerms: text("payment_terms").default("standard"),

  // RFI fields that can be marked as "ask_client"
  siteStatus: text("site_status"),
  mepScope: text("mep_scope"),
  actScanning: text("act_scanning"),
  scanningOnly: text("scanning_only"),
  actScanningNotes: text("act_scanning_notes"),

  // Client Input Portal (Magic Link)
  clientToken: text("client_token"),
  clientTokenExpiresAt: timestamp("client_token_expires_at"),
  clientStatus: text("client_status").default("pending"),

  // External CPQ Integration
  externalCpqId: text("external_cpq_id"),
  externalCpqUrl: text("external_cpq_url"),

  // PandaDoc Integration
  pandadocDocumentId: text("pandadoc_document_id"),
  pandadocStatus: text("pandadoc_status"),
  pandadocSentAt: timestamp("pandadoc_sent_at"),
  pandadocCompletedAt: timestamp("pandadoc_completed_at"),
  pandadocSignedBy: text("pandadoc_signed_by"),

  // E-Signature Integration (DocuSeal/universal)
  signatureProvider: text("signature_provider").$type<"pandadoc" | "docuseal">(),
  signatureSubmissionId: text("signature_submission_id"),
  signatureStatus: text("signature_status").$type<"pending" | "sent" | "viewed" | "in_progress" | "signed" | "declined">(),
  signatureSentAt: timestamp("signature_sent_at"),
  signatureSignedAt: timestamp("signature_signed_at"),

  // Deliberate Affirmation Pattern (tracks explicit "N/A" decisions for data quality)

  fieldAffirmations: jsonb("field_affirmations").$type<Record<string, boolean>>(),

  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCpqQuoteSchema = createInsertSchema(cpqQuotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateCpqQuoteSchema = insertCpqQuoteSchema.partial();
export type CpqQuote = typeof cpqQuotes.$inferSelect;
export type InsertCpqQuote = z.infer<typeof insertCpqQuoteSchema>;

export type CpqPricingMatrix = typeof cpqPricingMatrix.$inferSelect;
export type CpqUpteamPricingMatrix = typeof cpqUpteamPricingMatrix.$inferSelect;
export type CpqCadPricingMatrix = typeof cpqCadPricingMatrix.$inferSelect;
export type CpqPricingParameter = typeof cpqPricingParameters.$inferSelect;

export const caseStudies = pgTable("case_studies", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  blurb: text("blurb").notNull(),
  tags: text("tags").array().notNull(),
  imageUrl: text("image_url"),
  stats: jsonb("stats"),
  clientName: text("client_name"),
  heroStat: text("hero_stat"),
  pdfUrl: text("pdf_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCaseStudySchema = createInsertSchema(caseStudies).omit({
  id: true,
  createdAt: true,
});
export type CaseStudy = typeof caseStudies.$inferSelect;
export type InsertCaseStudy = z.infer<typeof insertCaseStudySchema>;

// Case study snippets for reusable content in proposals
export const caseStudySnippets = pgTable("case_study_snippets", {
  id: serial("id").primaryKey(),
  caseStudyId: integer("case_study_id").references(() => caseStudies.id).notNull(),
  title: text("title").notNull(),         // "Key Metric", "Problem Solved", "Testimonial"
  content: text("content").notNull(),     // The actual snippet text
  snippetType: text("snippet_type"),      // "stat", "quote", "summary", "result"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCaseStudySnippetSchema = createInsertSchema(caseStudySnippets).omit({
  id: true,
  createdAt: true,
});
export type CaseStudySnippet = typeof caseStudySnippets.$inferSelect;
export type InsertCaseStudySnippet = z.infer<typeof insertCaseStudySnippetSchema>;

export const personas = pgTable("personas", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // "BP1", "BP5"
  name: text("name").notNull(),
  painPoints: text("pain_points").array(),
  preferredTags: text("preferred_tags").array(),
  scriptTemplate: text("script_template"), // Template with {{variables}}
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
});
export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export const hubspotSyncLogs = pgTable("hubspot_sync_logs", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  hubspotContactId: text("hubspot_contact_id"),
  syncStatus: text("sync_status"), // "pending", "synced", "failed"
  errorMessage: text("error_message"),
  lastSyncAt: timestamp("last_sync_at").defaultNow(),
});

export const insertHubspotSyncLogSchema = createInsertSchema(hubspotSyncLogs).omit({
  id: true,
  lastSyncAt: true,
});
export type HubspotSyncLog = typeof hubspotSyncLogs.$inferSelect;
export type InsertHubspotSyncLog = z.infer<typeof insertHubspotSyncLogSchema>;
export const ghlSyncLogs = pgTable("ghl_sync_logs", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  ghlContactId: text("ghl_contact_id"),
  ghlOpportunityId: text("ghl_opportunity_id"),
  syncStatus: text("sync_status"), // "pending", "synced", "failed"
  errorMessage: text("error_message"),
  lastSyncAt: timestamp("last_sync_at").defaultNow(),
});

export const insertGhlSyncLogSchema = createInsertSchema(ghlSyncLogs).omit({
  id: true,
  lastSyncAt: true,
});
export type GhlSyncLog = typeof ghlSyncLogs.$inferSelect;
export type InsertGhlSyncLog = z.infer<typeof insertGhlSyncLogSchema>;

export const trackingEvents = pgTable("tracking_events", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  eventType: text("event_type"), // "case_study_click"
  assetUrl: text("asset_url"),
  clickedAt: timestamp("clicked_at").defaultNow(),
  referrer: text("referrer"),
});

export const insertTrackingEventSchema = createInsertSchema(trackingEvents).omit({
  id: true,
  clickedAt: true,
});
export type TrackingEvent = typeof trackingEvents.$inferSelect;
export type InsertTrackingEvent = z.infer<typeof insertTrackingEventSchema>;
export const proposalEmailEvents = pgTable("proposal_email_events", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  quoteId: integer("quote_id").references(() => cpqQuotes.id),
  token: text("token").notNull().unique(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  firstOpenedAt: timestamp("first_opened_at"),
  lastOpenedAt: timestamp("last_opened_at"),
  openCount: integer("open_count").default(0).notNull(),
  clickCount: integer("click_count").default(0).notNull(),
});

export const insertProposalEmailEventSchema = createInsertSchema(proposalEmailEvents).omit({
  id: true,
  sentAt: true,
  firstOpenedAt: true,
  lastOpenedAt: true,
  openCount: true,
  clickCount: true,
});
export type ProposalEmailEvent = typeof proposalEmailEvents.$inferSelect;
export type InsertProposalEmailEvent = z.infer<typeof insertProposalEmailEventSchema>;
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id"), // References users.id (varchar)
  type: text("type"), // "lead_click", "sync_failure", "client_input", "variance_alert"
  title: text("title"),
  leadId: integer("lead_id").references(() => leads.id),
  quoteId: integer("quote_id"),
  message: text("message"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const evidenceVault = pgTable("evidence_vault", {
  id: serial("id").primaryKey(),
  personaCode: text("persona_code"), // "BP1", "BP2", etc.
  hookContent: text("hook_content"), // "RFIs killing your schedule?"
  ewsScore: integer("ews_score"), // 1-5 (Emotional Weight Score)
  sourceUrl: text("source_url"), // LinkedIn post URL, research source
  usageCount: integer("usage_count").default(0), // How many times used in scripts
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEvidenceVaultSchema = createInsertSchema(evidenceVault).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});
export type EvidenceVaultEntry = typeof evidenceVault.$inferSelect;
export type InsertEvidenceVaultEntry = z.infer<typeof insertEvidenceVaultSchema>;

export const marketingPosts = pgTable("marketing_posts", {
  id: serial("id").primaryKey(),
  caseStudyId: integer("case_study_id").references(() => caseStudies.id),
  projectId: integer("project_id").references(() => projects.id),
  platform: text("platform").default("linkedin"),
  category: text("category"), // "stat_bomb", "process_tease"
  content: text("content"), // The formatted text body
  suggestedVisual: text("suggested_visual"), // "Bar Chart"
  status: text("status").default("draft"), // "draft", "approved", "posted"
  variancePercent: decimal("variance_percent", { precision: 10, scale: 2 }),
  savingsAmount: decimal("savings_amount", { precision: 12, scale: 2 }),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingPostSchema = createInsertSchema(marketingPosts).omit({
  id: true,
  createdAt: true,
});
export type MarketingPost = typeof marketingPosts.$inferSelect;
export type InsertMarketingPost = z.infer<typeof insertMarketingPostSchema>;
// === TYPES ===
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

// Project Status Type (for checkboxes)
export interface ProjectStatus {
  proposalPhase?: boolean;
  inHand?: boolean;
  urgent?: boolean;
  other?: boolean;
  otherText?: string;
}

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type FieldNote = typeof fieldNotes.$inferSelect;
export type InsertFieldNote = z.infer<typeof insertFieldNoteSchema>;

export type TimeLog = typeof timeLogs.$inferSelect;
export type InsertTimeLog = z.infer<typeof insertTimeLogSchema>;

export type SiteIntelligence = typeof siteIntelligence.$inferSelect;
export type InsertSiteIntelligence = z.infer<typeof insertSiteIntelligenceSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingsSchema>;

export const salesReps = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Links to Replit Auth user ID (ownerId in leads)
  name: text("name").notNull(),
  email: text("email"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("5.00"), // % of Gross Revenue
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalesRepSchema = createInsertSchema(salesReps).omit({
  id: true,
  createdAt: true,
});
export type SalesRep = typeof salesReps.$inferSelect;
export type InsertSalesRep = z.infer<typeof insertSalesRepSchema>;
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  overheadRate: decimal("overhead_rate", { precision: 5, scale: 2 }).default("15.00"), // % allocation for Ops/Rent/Software
  targetNetMargin: decimal("target_net_margin", { precision: 5, scale: 2 }).default("20.00"), // Target net margin %
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
});
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

export const compensationSplits = pgTable("compensation_splits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  type: text("type").default("commission"),
  defaultRate: decimal("default_rate", { precision: 5, scale: 2 }).default("5.00"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompensationSplitSchema = createInsertSchema(compensationSplits).omit({
  id: true,
  createdAt: true,
});
export type CompensationSplit = typeof compensationSplits.$inferSelect;
export type InsertCompensationSplit = z.infer<typeof insertCompensationSplitSchema>;
export const dealPredictions = pgTable("deal_predictions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  predictedProbability: integer("predicted_probability"),
  predictedOutcome: text("predicted_outcome"), // "won" | "lost"
  actualOutcome: text("actual_outcome"),
  predictionDate: timestamp("prediction_date").defaultNow(),
  outcomeDate: timestamp("outcome_date"),
});

export const insertDealPredictionSchema = createInsertSchema(dealPredictions).omit({
  id: true,
  predictionDate: true,
});
export type DealPrediction = typeof dealPredictions.$inferSelect;
export type InsertDealPrediction = z.infer<typeof insertDealPredictionSchema>;
export const cpqConversations = pgTable("cpq_conversations", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  userId: text("user_id"),
  messages: jsonb("messages"), // Array of {role, content, timestamp}
  extractedData: jsonb("extracted_data"), // CPQ fields gathered so far
  quoteId: integer("quote_id"),
  status: text("status").default("active"), // "active" | "converted" | "abandoned"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCpqConversationSchema = createInsertSchema(cpqConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CpqConversation = typeof cpqConversations.$inferSelect;
export type InsertCpqConversation = z.infer<typeof insertCpqConversationSchema>;
export const projectEmbeddings = pgTable("project_embeddings", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  embedding: text("embedding"), // JSON array of floats
  projectSummary: text("project_summary"), // Text used for embedding
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectEmbeddingSchema = createInsertSchema(projectEmbeddings).omit({
  id: true,
  updatedAt: true,
});
export type ProjectEmbedding = typeof projectEmbeddings.$inferSelect;
export type InsertProjectEmbedding = z.infer<typeof insertProjectEmbeddingSchema>;
export const aiAnalytics = pgTable("ai_analytics", {
  id: serial("id").primaryKey(),
  feature: text("feature").notNull(), // 'scoping' | 'document' | 'intelligence' | 'proposal' | 'nlp_cpq' | 'matching'
  userId: text("user_id"),
  leadId: integer("lead_id"),
  action: text("action"), // 'generated' | 'accepted' | 'rejected' | 'modified'
  timeTakenMs: integer("time_taken_ms"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiAnalyticsSchema = createInsertSchema(aiAnalytics).omit({
  id: true,
  createdAt: true,
});
export type AiAnalytic = typeof aiAnalytics.$inferSelect;
export type InsertAiAnalytic = z.infer<typeof insertAiAnalyticsSchema>;
// === PANDADOC IMPORT SYSTEM (Proposal Vault) ===
export const pandaDocImportBatches = pgTable("pandadoc_import_batches", {
  id: serial("id").primaryKey(),
  name: text("name"),
  status: text("status").default("pending").notNull(),
  totalDocuments: integer("total_documents").default(0),
  processedDocuments: integer("processed_documents").default(0),
  successfulDocuments: integer("successful_documents").default(0),
  failedDocuments: integer("failed_documents").default(0),
  lastSyncCursor: text("last_sync_cursor"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPandaDocImportBatchSchema = createInsertSchema(pandaDocImportBatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PandaDocImportBatch = typeof pandaDocImportBatches.$inferSelect;
export type InsertPandaDocImportBatch = z.infer<typeof insertPandaDocImportBatchSchema>;
export const pandaDocDocuments = pgTable("pandadoc_documents", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").references(() => pandaDocImportBatches.id),
  pandaDocId: text("pandadoc_id").notNull().unique(),
  pandaDocName: text("pandadoc_name"),
  pandaDocStatus: text("pandadoc_status"),
  pandaDocStatusCode: integer("pandadoc_status_code"),
  pandaDocStage: text("pandadoc_stage").default("unknown"),
  pandaDocVersion: text("pandadoc_version"),
  pandaDocCreatedAt: timestamp("pandadoc_created_at"),
  pandaDocUpdatedAt: timestamp("pandadoc_updated_at"),
  pandaDocPdfUrl: text("pandadoc_pdf_url"),

  importStatus: text("import_status").default("pending").notNull(),
  extractedData: jsonb("extracted_data"),
  extractionConfidence: decimal("extraction_confidence", { precision: 5, scale: 2 }),
  extractionErrors: jsonb("extraction_errors"),

  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  cpqQuoteId: integer("cpq_quote_id").references(() => cpqQuotes.id),
  leadId: integer("lead_id").references(() => leads.id),

  rawPandaDocData: jsonb("raw_pandadoc_data"),
  pricingTableData: jsonb("pricing_table_data"),
  recipientsData: jsonb("recipients_data"),
  variablesData: jsonb("variables_data"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPandaDocDocumentSchema = createInsertSchema(pandaDocDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PandaDocDocument = typeof pandaDocDocuments.$inferSelect;
export type InsertPandaDocDocument = z.infer<typeof insertPandaDocDocumentSchema>;

export const pandaDocImportBatchesRelations = relations(pandaDocImportBatches, ({ many }) => ({
  documents: many(pandaDocDocuments),
}));

export const pandaDocDocumentsRelations = relations(pandaDocDocuments, ({ one }) => ({
  batch: one(pandaDocImportBatches, {
    fields: [pandaDocDocuments.batchId],
    references: [pandaDocImportBatches.id],
  }),
  cpqQuote: one(cpqQuotes, {
    fields: [pandaDocDocuments.cpqQuoteId],
    references: [cpqQuotes.id],
  }),
  lead: one(leads, {
    fields: [pandaDocDocuments.leadId],
    references: [leads.id],
  }),
}));
// === COGNITIVE BRAND ENGINE TABLES ===

// Brand Personas - Stores the "voice modes" (Executive Signal Mapper, Master Author, etc.)
export const brandPersonas = pgTable("brand_personas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  coreIdentity: text("core_identity").notNull(),
  voiceMode: jsonb("voice_mode"),
  mantra: text("mantra"),
  directives: text("directives"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrandPersonaSchema = createInsertSchema(brandPersonas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BrandPersona = typeof brandPersonas.$inferSelect;
export type InsertBrandPersona = z.infer<typeof insertBrandPersonaSchema>;

export const governanceRedLines = pgTable("governance_red_lines", {
  id: serial("id").primaryKey(),
  ruleContent: text("rule_content").notNull(),
  violationCategory: text("violation_category").notNull(),
  correctionInstruction: text("correction_instruction").notNull(),
  severity: integer("severity").default(1).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGovernanceRedLineSchema = createInsertSchema(governanceRedLines).omit({
  id: true,
  createdAt: true,
});
export type GovernanceRedLine = typeof governanceRedLines.$inferSelect;
export type InsertGovernanceRedLine = z.infer<typeof insertGovernanceRedLineSchema>;

export const standardDefinitions = pgTable("standard_definitions", {
  id: serial("id").primaryKey(),
  term: text("term").notNull().unique(),
  definition: text("definition").notNull(),
  guaranteeText: text("guarantee_text"),
  category: text("category").default("general"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStandardDefinitionSchema = createInsertSchema(standardDefinitions).omit({
  id: true,
  createdAt: true,
});
export type StandardDefinition = typeof standardDefinitions.$inferSelect;
export type InsertStandardDefinition = z.infer<typeof insertStandardDefinitionSchema>;
export const generationAuditLogs = pgTable("generation_audit_logs", {
  id: serial("id").primaryKey(),
  promptContext: text("prompt_context").notNull(),
  buyerType: text("buyer_type"),
  painPoint: text("pain_point"),
  situation: text("situation"),
  initialDraft: text("initial_draft").notNull(),
  violationCount: integer("violation_count").default(0).notNull(),
  violationsFound: jsonb("violations_found"),
  rewriteAttempts: integer("rewrite_attempts").default(0).notNull(),
  finalOutput: text("final_output").notNull(),
  personaUsed: text("persona_used"),
  authorMode: text("author_mode"),
  processingTimeMs: integer("processing_time_ms"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGenerationAuditLogSchema = createInsertSchema(generationAuditLogs).omit({
  id: true,
  createdAt: true,
});
export type GenerationAuditLog = typeof generationAuditLogs.$inferSelect;
export type InsertGenerationAuditLog = z.infer<typeof insertGenerationAuditLogSchema>;
// === BUYER PERSONA INTELLIGENCE ENGINE ===

// Enhanced Buyer Personas - Detailed psychological profiles for targeted content
export const buyerPersonas = pgTable("buyer_personas", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // BP1, BP2, BP3, etc.
  name: text("name").notNull(), // "The Architect", "The GC"
  icon: text("icon"), // lucide icon name

  // Identity
  roleTitle: text("role_title").notNull(),
  roleVariants: jsonb("role_variants").$type<string[]>(),
  organizationType: text("organization_type"),
  description: text("description"),

  // Cognitive Blueprint
  coreValues: jsonb("core_values").$type<string[]>(),
  primaryPain: text("primary_pain").notNull(),
  secondaryPain: text("secondary_pain"),
  hiddenFear: text("hidden_fear"),
  purchaseTriggers: jsonb("purchase_triggers").$type<string[]>(),

  // Sales Strategy
  valueDriver: text("value_driver").notNull(),
  valueHook: text("value_hook"), // "Design with confidence..."
  exactLanguage: jsonb("exact_language").$type<string[]>(), // phrases TO use
  avoidWords: jsonb("avoid_words").$type<string[]>(), // phrases to NEVER use

  // Decision Making
  decisionCriteria: jsonb("decision_criteria").$type<string[]>(),
  dealbreakers: jsonb("dealbreakers").$type<string[]>(),
  projectPhases: jsonb("project_phases").$type<string[]>(),
  budgetAuthority: text("budget_authority"),
  typicalBudgetRange: text("typical_budget_range"),
  influenceChain: jsonb("influence_chain").$type<{
    reportsTo: string;
    needsApprovalFrom: string[];
    influencedBy: string[];
  }>(),

  // Communication
  tonePreference: text("tone_preference").notNull(),
  communicationStyle: text("communication_style"),
  attentionSpan: text("attention_span"),
  technicalTriggers: jsonb("technical_triggers").$type<string[]>(),
  emotionalTriggers: jsonb("emotional_triggers").$type<string[]>(),

  // Risk Profile
  vetoPower: boolean("veto_power").default(false),
  defaultRiskLevel: text("default_risk_level").default("medium"), // low, medium, high
  disqualifiers: jsonb("disqualifiers").$type<string[]>(),

  // Buying Mode Overrides (Firefighter/Optimizer/Innovator strategies)
  buyingModeStrategies: jsonb("buying_mode_strategies").$type<{
    firefighter?: string;
    optimizer?: string;
    innovator?: string;
  }>(),

  // Asset Mapping
  requiredAssets: jsonb("required_assets").$type<string[]>(), // ["precision_validation_report", "technical_appendix"]
  proposalSections: jsonb("proposal_sections").$type<string[]>(), // PandaDoc section IDs to auto-include

  // AI Learning Metrics
  winRate: decimal("win_rate", { precision: 5, scale: 2 }),
  avgDealSize: decimal("avg_deal_size", { precision: 12, scale: 2 }),
  avgSalesCycleDays: integer("avg_sales_cycle_days"),
  totalDeals: integer("total_deals").default(0),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBuyerPersonaSchema = createInsertSchema(buyerPersonas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BuyerPersona = typeof buyerPersonas.$inferSelect;
export type InsertBuyerPersona = z.infer<typeof insertBuyerPersonaSchema>;

export const personaInsights = pgTable("persona_insights", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").references(() => buyerPersonas.id),
  leadId: integer("lead_id").references(() => leads.id),

  // What was used
  buyingModeUsed: text("buying_mode_used"), // firefighter, optimizer, innovator
  strategyNotes: text("strategy_notes"),
  assetsDelivered: jsonb("assets_delivered").$type<string[]>(),

  // Outcome
  outcome: text("outcome").notNull(), // won, lost, stalled
  dealValue: decimal("deal_value", { precision: 12, scale: 2 }),
  cycleLengthDays: integer("cycle_length_days"),
  lossReason: text("loss_reason"),

  // AI-generated learnings
  aiAnalysis: text("ai_analysis"),
  suggestedRefinements: jsonb("suggested_refinements").$type<{
    valueHook?: string;
    languageToAdd?: string[];
    languageToAvoid?: string[];
    buyingModeStrategy?: string;
    otherNotes?: string;
  }>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPersonaInsightSchema = createInsertSchema(personaInsights).omit({
  id: true,
  createdAt: true,
});
export type PersonaInsight = typeof personaInsights.$inferSelect;
export type InsertPersonaInsight = z.infer<typeof insertPersonaInsightSchema>;
export const brandVoices = pgTable("brand_voices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  purpose: text("purpose").notNull(),
  baseInstruction: text("base_instruction").notNull(),
  toneMarkers: jsonb("tone_markers").$type<string[]>(),
  prohibitions: jsonb("prohibitions").$type<string[]>(),
  exampleOutput: text("example_output"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBrandVoiceSchema = createInsertSchema(brandVoices).omit({
  id: true,
  createdAt: true,
});
export type BrandVoice = typeof brandVoices.$inferSelect;
export type InsertBrandVoice = z.infer<typeof insertBrandVoiceSchema>;

export const brandValues = pgTable("brand_values", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // mission, vision, core_values, three_uniques, guarantee, sustainability, empowerment, taglines
  title: text("title").notNull(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrandValueSchema = createInsertSchema(brandValues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BrandValue = typeof brandValues.$inferSelect;
export type InsertBrandValue = z.infer<typeof insertBrandValueSchema>;

export const solutionMappings = pgTable("solution_mappings", {
  id: serial("id").primaryKey(),
  buyerCode: text("buyer_code").notNull(),
  painPoint: text("pain_point").notNull(),
  solutionMechanism: text("solution_mechanism").notNull(),
  proofPoint: text("proof_point"),
  argumentFrame: text("argument_frame").notNull(),
  objectionPreempt: text("objection_preempt"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSolutionMappingSchema = createInsertSchema(solutionMappings).omit({
  id: true,
  createdAt: true,
});
export type SolutionMapping = typeof solutionMappings.$inferSelect;
export type InsertSolutionMapping = z.infer<typeof insertSolutionMappingSchema>;
export const negotiationPlaybook = pgTable("negotiation_playbook", {
  id: serial("id").primaryKey(),
  buyerCode: text("buyer_code").notNull(),
  objectionPattern: text("objection_pattern").notNull(),
  underlyingConcern: text("underlying_concern"),
  responseStrategy: text("response_strategy").notNull(),
  reframeLanguage: text("reframe_language"),
  walkAwaySignal: text("walk_away_signal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNegotiationPlaybookSchema = createInsertSchema(negotiationPlaybook).omit({
  id: true,
  createdAt: true,
});
export type NegotiationPlaybookEntry = typeof negotiationPlaybook.$inferSelect;
export type InsertNegotiationPlaybookEntry = z.infer<typeof insertNegotiationPlaybookSchema>;
export const intelligenceGeneratedContent = pgTable("intelligence_generated_content", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(), // proposal, negotiation_brief, email, ad_copy, etc.
  targetPersona: text("target_persona"),
  projectContext: jsonb("project_context").$type<{
    projectName?: string;
    projectType?: string;
    squareFootage?: string;
    timeline?: string;
    specialConditions?: string[];
  }>(),
  inputPrompt: text("input_prompt"),
  generatedOutput: text("generated_output").notNull(),
  voiceUsed: text("voice_used"),
  qualityScore: integer("quality_score"),
  wasUsed: boolean("was_used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIntelligenceGeneratedContentSchema = createInsertSchema(intelligenceGeneratedContent).omit({
  id: true,
  createdAt: true,
});
export type IntelligenceGeneratedContent = typeof intelligenceGeneratedContent.$inferSelect;
export type InsertIntelligenceGeneratedContent = z.infer<typeof insertIntelligenceGeneratedContentSchema>;
export const emailThreads = pgTable("email_threads", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  gmailThreadId: text("gmail_thread_id").unique(),
  subject: text("subject"),
  participants: jsonb("participants").$type<string[]>().default([]),
  snippet: text("snippet"),
  messageCount: integer("message_count").default(0),
  hasAttachments: boolean("has_attachments").default(false),
  isUnread: boolean("is_unread").default(false),
  lastMessageAt: timestamp("last_message_at"),
  syncedAt: timestamp("synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({
  id: true,
  syncedAt: true,
  createdAt: true,
});
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type EmailThread = typeof emailThreads.$inferSelect;

// Individual email messages within threads
export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => emailThreads.id).notNull(),
  gmailMessageId: text("gmail_message_id").unique(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmails: jsonb("to_emails").$type<string[]>().default([]),
  ccEmails: jsonb("cc_emails").$type<string[]>().default([]),
  subject: text("subject"),
  bodyPreview: text("body_preview"),
  bodyHtml: text("body_html"),
  hasAttachments: boolean("has_attachments").default(false),
  attachmentNames: jsonb("attachment_names").$type<string[]>().default([]),
  isInbound: boolean("is_inbound").default(true),
  sentAt: timestamp("sent_at").notNull(),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({
  id: true,
  syncedAt: true,
});
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;

// === PROPOSAL TEMPLATES (Boilerplate sections for proposal assembly) ===
export const proposalTemplates = pgTable("proposal_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "Company Overview", "Deliverables", "Terms & Conditions"
  slug: text("slug").notNull().unique(), // "company-overview", "deliverables", "terms"
  category: text("category").notNull().default("boilerplate"), // "intro", "company", "scope", "pricing", "terms", "legal", "appendix"
  content: text("content").notNull(), // Markdown/rich text content with variable placeholders
  description: text("description"), // Optional description for template management
  version: integer("version").notNull().default(1),
  isDefault: boolean("is_default").default(false), // Default template for this category
  isActive: boolean("is_active").default(true), // Soft delete support
  sortOrder: integer("sort_order").default(0), // For ordering within category
  variables: jsonb("variables").$type<string[]>().default([]), // List of variables used in this template
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"), // User who created the template
});

export const insertProposalTemplateSchema = createInsertSchema(proposalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProposalTemplate = z.infer<typeof insertProposalTemplateSchema>;
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;

// === PROPOSAL TEMPLATE GROUPS (Collections of templates for different proposal types) ===
export const proposalTemplateGroups = pgTable("proposal_template_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "Standard Proposal", "Enterprise", "Simple Quote"
  slug: text("slug").notNull().unique(), // "standard", "enterprise", "simple"
  description: text("description"),
  sections: jsonb("sections").$type<{
    templateId: number;
    sortOrder: number;
    required: boolean;
  }[]>().default([]), // Ordered list of template sections
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProposalTemplateGroupSchema = createInsertSchema(proposalTemplateGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProposalTemplateGroup = z.infer<typeof insertProposalTemplateGroupSchema>;
export type ProposalTemplateGroup = typeof proposalTemplateGroups.$inferSelect;

// === GENERATED PROPOSALS (Assembled proposals per deal) ===
export const generatedProposals = pgTable("generated_proposals", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  quoteId: integer("quote_id").references(() => cpqQuotes.id),
  templateGroupId: integer("template_group_id").references(() => proposalTemplateGroups.id),
  name: text("name").notNull(), // "Proposal for JPMC - 545 Washington Blvd"
  status: text("status").default("draft"), // "draft", "generated", "sent", "signed"
  // Snapshot of sections used (allows for per-proposal customization)
  sections: jsonb("sections").$type<{
    templateId: number;
    name: string;
    content: string; // Rendered content with variables replaced
    sortOrder: number;
    included: boolean;
  }[]>().default([]),
  // === WYSIWYG Proposal Data (editable structured content) ===
  // Cover page data
  coverData: jsonb("cover_data").$type<{
    projectTitle: string;
    projectAddress: string;
    servicesLine: string;
    clientName: string;
    date: string;
  }>(),
  // Project page data
  projectData: jsonb("project_data").$type<{
    overview: string;
    scopeItems: string[];
    deliverables: string[];
    timelineIntro: string;
    milestones: string[];
  }>(),
  // Editable line items for estimate table
  lineItems: jsonb("line_items").$type<{
    id: string;
    itemName: string;
    description: string;
    qty: number;
    rate: number;
    amount: number;
  }[]>(),
  // Payment terms data
  paymentData: jsonb("payment_data").$type<{
    terms: string[];
    paymentMethods: string[];
    acknowledgementDate: string;
  }>(),
  // Display settings (rollup preferences, etc.)
  displaySettings: jsonb("display_settings").$type<{
    rollupByDiscipline: boolean;
  }>(),
  // Calculated totals
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  total: decimal("total", { precision: 12, scale: 2 }),
  // PDF generation
  pdfUrl: text("pdf_url"), // URL to generated PDF
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  // PandaDoc integration
  pandaDocDocumentId: text("pandadoc_document_id"),
  pandaDocStatus: text("pandadoc_status"), // "draft", "sent", "viewed", "completed"
  pandaDocSentAt: timestamp("pandadoc_sent_at"),
  pandaDocCompletedAt: timestamp("pandadoc_completed_at"),
  // Metadata
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

export const insertGeneratedProposalSchema = createInsertSchema(generatedProposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGeneratedProposal = z.infer<typeof insertGeneratedProposalSchema>;
export type GeneratedProposal = typeof generatedProposals.$inferSelect;

// Products / Services catalog (synced from QuickBooks)

// === INTEL NEWS ITEMS (Regional Intel News Feeds) ===
export const INTEL_NEWS_TYPES = [
  "opportunity",      // Bidding opportunities (RFPs, ITBs)
  "policy",          // Regulatory & policy updates
  "competitor",      // Competitor intelligence
  "project",         // New construction/renovation projects
  "technology",      // Scanning/BIM industry tech news
  "funding",         // Grant & funding opportunities
  "event",           // Industry conferences & networking
  "talent",          // Hiring trends & talent market
  "market",          // Market trends & analysis
  // Trigger Pod Types (P9.1, P16, P17)
  "permit",          // Building permit filings (NYC DOB, Boston ISD)
  "compliance",      // Compliance triggers (LL11, LL87, LL97, BERDO)
  "procurement",     // Public procurement (PASSPort, NYSCR, DASNY)
] as const;
export type IntelNewsType = typeof INTEL_NEWS_TYPES[number];

export const INTEL_REGIONS = ["Northeast", "Mid-Atlantic", "Southeast", "Midwest", "Southwest", "West", "National"] as const;
export type IntelRegion = typeof INTEL_REGIONS[number];

export const intelNewsItems = pgTable("intel_news_items", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().$type<IntelNewsType>(), // "opportunity", "policy", "competitor"
  title: text("title").notNull(),
  summary: text("summary"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"), // "BidNet", "NYC DOB", "LinkedIn", etc.
  region: text("region").$type<IntelRegion>(), // Geographic region
  // For opportunities
  deadline: timestamp("deadline"), // Bid deadline
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }),
  projectType: text("project_type"), // Building type for matching
  // For policy items
  effectiveDate: timestamp("effective_date"),
  agency: text("agency"), // "NYC DOB", "OSHA", "EPA", etc.
  // For competitor items
  competitorName: text("competitor_name"),
  // Tracking
  isRead: boolean("is_read").default(false),
  isActionable: boolean("is_actionable").default(true),
  isArchived: boolean("is_archived").default(false),
  relevanceScore: integer("relevance_score").default(50), // 0-100
  // Metadata
  metadata: jsonb("metadata"), // Additional flexible data
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

export const insertIntelNewsItemSchema = createInsertSchema(intelNewsItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntelNewsItem = z.infer<typeof insertIntelNewsItemSchema>;
export type IntelNewsItem = typeof intelNewsItems.$inferSelect;

// === INTEL PIPELINE PROCESSING (Automatic Agent Processing) ===
export const PIPELINE_STATUSES = ["pending", "running", "completed", "failed", "skipped"] as const;
export type PipelineStatus = typeof PIPELINE_STATUSES[number];

export const AGENT_TYPES = ["scout", "analyst", "strategist", "composer", "auditor"] as const;
export type AgentType = typeof AGENT_TYPES[number];

// Tracks each intel item's processing run through the 5-agent pipeline
export const intelPipelineRuns = pgTable("intel_pipeline_runs", {
  id: serial("id").primaryKey(),
  intelItemId: integer("intel_item_id").notNull(), // FK to intel_news_items
  status: text("status").notNull().$type<PipelineStatus>().default("pending"),
  currentAgent: text("current_agent").$type<AgentType>(), // Which agent is currently processing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"), // Error message if failed
  retryCount: integer("retry_count").default(0),
  // Final synthesized outputs
  executiveSummary: text("executive_summary"), // AI-generated summary
  recommendedActions: jsonb("recommended_actions").$type<string[]>(), // Priority action items
  draftEmail: text("draft_email"), // Composer's draft outreach
  auditScore: integer("audit_score"), // Auditor's quality score (0-100)
  auditVerdict: text("audit_verdict"), // "approved" | "needs_revision" | "rejected"
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIntelPipelineRunSchema = createInsertSchema(intelPipelineRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntelPipelineRun = z.infer<typeof insertIntelPipelineRunSchema>;
export type IntelPipelineRun = typeof intelPipelineRuns.$inferSelect;

// Stores individual agent outputs for each pipeline run
export const intelAgentOutputs = pgTable("intel_agent_outputs", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(), // FK to intel_pipeline_runs
  agent: text("agent").notNull().$type<AgentType>(),
  output: jsonb("output"), // Agent's structured output
  durationMs: integer("duration_ms"), // How long the agent took
  confidence: integer("confidence"), // Agent's confidence score (0-100)
  status: text("status").notNull().$type<"pending" | "running" | "completed" | "failed">().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntelAgentOutputSchema = createInsertSchema(intelAgentOutputs).omit({
  id: true,
  createdAt: true,
});
export type InsertIntelAgentOutput = z.infer<typeof insertIntelAgentOutputSchema>;
export type IntelAgentOutput = typeof intelAgentOutputs.$inferSelect;

// === X.COM (TWITTER) INTEGRATION ===
export const xConnections = pgTable("x_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id"), // Our app user
  xUserId: text("x_user_id"), // Twitter user ID
  xUsername: text("x_username"), // @handle
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes"), // Comma-separated scopes
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertXConnectionSchema = createInsertSchema(xConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertXConnection = z.infer<typeof insertXConnectionSchema>;
export type XConnection = typeof xConnections.$inferSelect;

// Competitor accounts to monitor
export const xMonitoredAccounts = pgTable("x_monitored_accounts", {
  id: serial("id").primaryKey(),
  xUsername: text("x_username").notNull(), // @handle
  xUserId: text("x_user_id"),
  displayName: text("display_name"),
  category: text("category").default("competitor"), // competitor, regulator, partner, influencer
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertXMonitoredAccountSchema = createInsertSchema(xMonitoredAccounts).omit({
  id: true,
  createdAt: true,
});
export type InsertXMonitoredAccount = z.infer<typeof insertXMonitoredAccountSchema>;
export type XMonitoredAccount = typeof xMonitoredAccounts.$inferSelect;

// Saved hashtag searches
export const xSavedSearches = pgTable("x_saved_searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(), // "#ConstructionBids" or "scan-to-BIM"
  category: text("category").default("opportunity"), // opportunity, policy, competitor, industry
  description: text("description"),
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertXSavedSearchSchema = createInsertSchema(xSavedSearches).omit({
  id: true,
  createdAt: true,
});
export type InsertXSavedSearch = z.infer<typeof insertXSavedSearchSchema>;
export type XSavedSearch = typeof xSavedSearches.$inferSelect;

// === RFP RESPONSE AUTOMATION ===
export const RFP_STATUSES = ["pending", "extracting", "extracted", "generating", "proposal_ready", "approved", "sent", "rejected"] as const;
export type RfpStatus = typeof RFP_STATUSES[number];

export const rfpSubmissions = pgTable("rfp_submissions", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().$type<RfpStatus>().default("pending"),
  // Original document
  originalFileName: text("original_file_name"),
  fileUrl: text("file_url"), // Uploaded file URL
  fileType: text("file_type"), // pdf, docx, email
  // Extracted data
  extractedData: jsonb("extracted_data").$type<{
    projectName?: string;
    clientName?: string;
    projectAddress?: string;
    scope?: string;
    requirements?: string[];
    deadline?: string;
    budget?: string;
    contacts?: { name: string; email: string; phone?: string }[];
    buildingType?: string;
    sqft?: number;
    disciplines?: string[];
    specialRequirements?: string[];
  }>(),
  // Generated entities
  generatedLeadId: integer("generated_lead_id").references(() => leads.id),
  generatedQuoteId: integer("generated_quote_id"),
  generatedProposalId: integer("generated_proposal_id").references(() => generatedProposals.id),
  // Review workflow
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  // PandaDoc
  pandaDocDocumentId: text("pandadoc_document_id"),
  sentAt: timestamp("sent_at"),
  sentTo: text("sent_to"),
  // Tracking
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRfpSubmissionSchema = createInsertSchema(rfpSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRfpSubmission = z.infer<typeof insertRfpSubmissionSchema>;
export type RfpSubmission = typeof rfpSubmissions.$inferSelect;

// === COMPANY CAPABILITIES ===
export const CAPABILITY_CATEGORIES = [
  "core", // Core Capabilities (LiDAR, BIM, etc.)
  "service", // Service Portfolio
  "unique", // Unique Capabilities
  "differentiator", // Differentiators
  "risk", // Risk Mitigation
] as const;
export type CapabilityCategory = typeof CAPABILITY_CATEGORIES[number];

export const companyCapabilities = pgTable("company_capabilities", {
  id: serial("id").primaryKey(),
  category: text("category").notNull().$type<CapabilityCategory>().default("core"),
  name: text("name").notNull(),
  description: text("description").notNull(),
  details: jsonb("details").$type<{
    tools?: string[];
    environments?: string[];
    deliverables?: string[];
    disciplines?: string[];
    useCases?: string[];
    applications?: string[];
    formats?: string[];
  }>(),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanyCapabilitySchema = createInsertSchema(companyCapabilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanyCapability = z.infer<typeof insertCompanyCapabilitySchema>;
export type CompanyCapability = typeof companyCapabilities.$inferSelect;

// === INTEL FEED SOURCES (Configuration for BidNet API, RSS, Webhooks) ===
export const INTEL_SOURCE_TYPES = [
  "bidnet_api",       // BidNet API
  "rss",              // RSS feed
  "webhook",          // Webhook receiver
  // Permit Sources (P9.1)
  "nyc_dob_bis",      // NYC DOB BIS API (ic3t-wcy2)
  "nyc_dob_now",      // NYC DOB NOW API (w9ak-ipjd)
  "boston_isd",       // Boston ISD permits
  "nyc_pluto",        // NYC PLUTO for size/type enrichment
  // Compliance Sources (P16)
  "nyc_ll11",         // LL11/FISP facade compliance
  "nyc_ll87",         // LL87 energy audit filings
  "nyc_ll97",         // LL97 covered buildings list
  "boston_berdo",     // Boston BERDO
  "cambridge_beudo",  // Cambridge BEUDO
  // Procurement Sources (P17)
  "nyc_passport",     // NYC PASSPort Public
  "nys_contract_reporter", // NYS Contract Reporter
  "dasny",            // DASNY term consultants
  "panynj",           // Port Authority NY/NJ
  "massport",         // Massport
  "mbta",             // MBTA
] as const;
export type IntelSourceType = typeof INTEL_SOURCE_TYPES[number];

export const INTEL_SYNC_STATUSES = ["success", "error"] as const;
export type IntelSyncStatus = typeof INTEL_SYNC_STATUSES[number];

export const intelFeedSources = pgTable("intel_feed_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<IntelSourceType>(),
  config: jsonb("config").$type<{
    apiKey?: string;
    apiUrl?: string;
    feedUrl?: string;
    webhookSecret?: string;
    filters?: Record<string, any>;
    syncIntervalMinutes?: number;
    searchPrompt?: string;  // Editable search/filter prompt
    keywords?: string[];     // Keywords to match
    excludeKeywords?: string[]; // Keywords to exclude
    targetType?: IntelNewsType; // What type of intel this source produces
  }>(),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status").$type<IntelSyncStatus | null>(),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIntelFeedSourceSchema = createInsertSchema(intelFeedSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntelFeedSource = z.infer<typeof insertIntelFeedSourceSchema>;
export type IntelFeedSource = typeof intelFeedSources.$inferSelect;

// === HELP CENTER ARTICLES ===
export const HELP_ARTICLE_CATEGORIES = [
  "getting-started",
  "sales",
  "cpq",
  "production",
  "fieldhub",
  "ai-tools",
  "settings",
  "faq",
] as const;
export type HelpArticleCategory = typeof HELP_ARTICLE_CATEGORIES[number];

export const helpArticles = pgTable("help_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull().$type<HelpArticleCategory>(),
  content: text("content").notNull(), // Markdown content
  sortOrder: integer("sort_order").default(0),
  isPublished: boolean("is_published").default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHelpArticleSchema = createInsertSchema(helpArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHelpArticle = z.infer<typeof insertHelpArticleSchema>;
export type HelpArticle = typeof helpArticles.$inferSelect;

// === AGENT PROMPT LIBRARY ===
export const PROMPT_CREATOR_TYPES = ["system", "user", "agent"] as const;
export type PromptCreatorType = typeof PROMPT_CREATOR_TYPES[number];

export const agentPrompts = pgTable("agent_prompts", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // Intel category or use case
  name: text("name").notNull(),         // Human-readable name
  basePrompt: text("base_prompt").notNull(),       // Original prompt
  optimizedPrompt: text("optimized_prompt").notNull(), // AI-refined version
  variables: jsonb("variables").$type<string[]>().default([]), // Placeholders
  performance: jsonb("performance").$type<{
    usageCount: number;
    successRate: number;
    avgConfidence: number;
    lastUsed: string;
  }>().default({ usageCount: 0, successRate: 50, avgConfidence: 50, lastUsed: "" }),
  metadata: jsonb("metadata").$type<{
    createdBy: PromptCreatorType;
    version: number;
    parentId?: number;
    optimizationNotes?: string;
  }>().default({ createdBy: "system", version: 1 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAgentPromptSchema = createInsertSchema(agentPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentPrompt = z.infer<typeof insertAgentPromptSchema>;
export type AgentPrompt = typeof agentPrompts.$inferSelect;

// === MARKETING INTELLIGENCE ===
export const marketingIntel = pgTable("marketing_intel", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),   // "competitor", "market", "opportunity", etc.
  title: text("title").notNull(),
  summary: text("summary"),
  insights: jsonb("insights").$type<string[]>().default([]),
  actionItems: jsonb("action_items").$type<string[]>().default([]),
  relatedLeads: jsonb("related_leads").$type<number[]>(),
  relatedProjects: jsonb("related_projects").$type<number[]>(),
  confidence: integer("confidence").default(50), // AI confidence score
  source: text("source"),                   // Where this intel came from
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  isActioned: boolean("is_actioned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),       // When intel becomes stale
});

export const insertMarketingIntelSchema = createInsertSchema(marketingIntel).omit({
  id: true,
  createdAt: true,
});
export type InsertMarketingIntel = z.infer<typeof insertMarketingIntelSchema>;
export type MarketingIntelRecord = typeof marketingIntel.$inferSelect;

// === AI LEARNING MEMORY SYSTEM ===
// Facts the AI has learned from research, deals, and user corrections

export const AI_MEMORY_CATEGORIES = [
  "competitor",       // Competitor intelligence
  "regulation",       // Laws, codes, compliance requirements
  "technique",        // Best practices, methods
  "client",           // Client-specific knowledge
  "pricing",          // Pricing patterns and insights
  "failure",          // What went wrong (lessons learned)
  "success",          // What worked well
  "market",           // Market trends and data
  "technology",       // Tech trends, equipment info
] as const;
export type AIMemoryCategory = typeof AI_MEMORY_CATEGORIES[number];

export const AI_MEMORY_SOURCES = [
  "agent_research",   // From agent pipeline
  "deal_outcome",     // From won/lost deals
  "user_correction",  // Human correction
  "web_search",       // Web research
  "document",         // Extracted from documents
  "manual_entry",     // Manually added
] as const;
export type AIMemorySource = typeof AI_MEMORY_SOURCES[number];

export const aiResearchMemory = pgTable("ai_research_memory", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),                    // "competitor_terracon", "nyc_ll97_compliance"
  category: text("category").notNull().$type<AIMemoryCategory>(),
  summary: text("summary").notNull(),                // Key finding
  details: jsonb("details").$type<Record<string, any>>(),  // Structured data
  sourceType: text("source_type").$type<AIMemorySource>(),
  sourceUrl: text("source_url"),
  sourceId: integer("source_id"),                    // FK to source record (deal, intel item, etc.)
  confidence: integer("confidence").default(70),     // 0-100
  citationCount: integer("citation_count").default(0), // Times referenced by agents
  lastCitedAt: timestamp("last_cited_at"),
  isVerified: boolean("is_verified").default(false), // Human verified?
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),                // Some facts expire
  tags: jsonb("tags").$type<string[]>().default([]),
  relatedMemoryIds: jsonb("related_memory_ids").$type<number[]>(), // Links to related facts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiResearchMemorySchema = createInsertSchema(aiResearchMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiResearchMemory = z.infer<typeof insertAiResearchMemorySchema>;
export type AiResearchMemory = typeof aiResearchMemory.$inferSelect;

// What agents learned from each interaction
export const aiLearningLogs = pgTable("ai_learning_logs", {
  id: serial("id").primaryKey(),
  agent: text("agent").notNull().$type<AgentType>(), // "strategist", "composer", etc.
  interactionType: text("interaction_type").notNull(), // "pipeline_run", "user_correction", "deal_outcome"
  interactionId: integer("interaction_id"),          // FK to relevant table
  learnedFacts: jsonb("learned_facts").$type<Array<{
    topic: string;
    category: AIMemoryCategory;
    summary: string;
    confidence: number;
  }>>(),
  confidenceDelta: integer("confidence_delta"),      // How much to adjust existing knowledge
  appliedToMemoryIds: jsonb("applied_to_memory_ids").$type<number[]>(), // Which memory records were updated
  reasoning: text("reasoning"),                      // Why the agent learned this
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiLearningLogSchema = createInsertSchema(aiLearningLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAiLearningLog = z.infer<typeof insertAiLearningLogSchema>;
export type AiLearningLog = typeof aiLearningLogs.$inferSelect;

// Track when memory is used (feedback loop)
export const aiFactCitations = pgTable("ai_fact_citations", {
  id: serial("id").primaryKey(),
  memoryId: integer("memory_id").notNull(),          // FK to ai_research_memory
  agent: text("agent").notNull().$type<AgentType>(),
  context: text("context"),                          // Why it was cited
  usedInOutputId: integer("used_in_output_id"),      // FK to agent output
  wasHelpful: boolean("was_helpful"),                // Feedback loop
  feedback: text("feedback"),                        // Optional explanation
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiFactCitationSchema = createInsertSchema(aiFactCitations).omit({
  id: true,
  createdAt: true,
});
export type InsertAiFactCitation = z.infer<typeof insertAiFactCitationSchema>;
export type AiFactCitation = typeof aiFactCitations.$inferSelect;
