import { db } from "./db";
import {
  qbCustomers,
  type InsertLead, type InsertProject, type InsertFieldNote, type InsertLeadResearch,
  type Lead, type Project, type FieldNote, type Setting, type LeadResearch, type User, type UserRole,
  type Account, type InsertAccount, type Invoice, type InsertInvoice,
  type InternalLoan, type InsertInternalLoan, type VendorPayable, type InsertVendorPayable,
  type QuoteVersion, type InsertQuoteVersion,
  type Scantech, type InsertScantech,
  type ProjectAttachment, type InsertProjectAttachment,
  type CpqPricingMatrix, type CpqUpteamPricingMatrix, type CpqCadPricingMatrix, type CpqPricingParameter,
  type CpqQuote, type InsertCpqQuote,
  type CaseStudy, type InsertCaseStudy,
  type Notification, type InsertNotification,
  type DealAttribution, type InsertDealAttribution,
  type Event, type InsertEvent, type EventRegistration, type InsertEventRegistration,
  type QbCustomer, type InsertQbCustomer,
  type LeadDocument, type InsertLeadDocument,
  type ProposalEmailEvent, type InsertProposalEmailEvent
} from "@shared/schema";
import { eq, ilike } from "drizzle-orm";
import { leadRepo, leadResearchRepo, leadDocumentRepo } from "./storage/leads";
import { cpqQuoteRepo, quoteVersionRepo, cpqPricingRepo } from "./storage/quotes";
import { accountRepo, invoiceRepo, internalLoanRepo, vendorPayableRepo } from "./storage/financial";
import { 
  caseStudyRepo, eventRepo, eventRegistrationRepo, dealAttributionRepo, 
  notificationRepo, proposalEmailRepo, abmAnalyticsRepo 
} from "./storage/marketing";
import { projectRepo, projectAttachmentRepo } from "./storage/projects";
import { userRepo } from "./storage/users";
import { settingsRepo } from "./storage/settings";
import { scantechRepo } from "./storage/scantechs";
import { fieldNoteRepo } from "./storage/notes";

export interface IStorage {
  // Leads
  getLeads(): Promise<Lead[]>;
  getDeletedLeads(): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  getLeadByQboInvoiceId(qboInvoiceId: string): Promise<Lead | undefined>;
  getLeadByQboEstimateId(qboEstimateId: string): Promise<Lead | undefined>;
  getLeadByClientName(clientName: string): Promise<Lead | undefined>;
  getLeadsByClientName(clientName: string): Promise<Lead[]>;
  getLeadsByQboCustomerId(qboCustomerId: string): Promise<Lead[]>;
  getLeadsByImportSource(importSource: string): Promise<Lead[]>;
  getLeadByClientToken(token: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead>;
  softDeleteLead(id: number, deletedBy?: string): Promise<Lead>;
  restoreLead(id: number): Promise<Lead>;
  deleteLead(id: number): Promise<void>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectByLeadId(leadId: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project>;

  // Field Notes
  getFieldNotes(): Promise<FieldNote[]>;
  getFieldNote(id: number): Promise<FieldNote | undefined>;
  createFieldNote(note: InsertFieldNote): Promise<FieldNote>;
  updateFieldNote(id: number, updates: Partial<FieldNote>): Promise<FieldNote>;

  // Settings
  getAllSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: unknown): Promise<Setting>;

  // Lead Research
  getLeadResearch(leadId: number): Promise<LeadResearch[]>;
  createLeadResearch(research: InsertLeadResearch): Promise<LeadResearch>;

  // User Management
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, role: UserRole): Promise<User | undefined>;

  // Financial Module - Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: number, updates: Partial<InsertAccount>): Promise<Account>;

  // Financial Module - Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoicesByLead(leadId: number): Promise<Invoice[]>;
  getOverdueInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice>;

  // Financial Module - Internal Loans
  getInternalLoans(): Promise<InternalLoan[]>;
  getActiveLoan(): Promise<InternalLoan | undefined>;
  createInternalLoan(loan: InsertInternalLoan): Promise<InternalLoan>;
  updateInternalLoan(id: number, updates: Partial<InternalLoan>): Promise<InternalLoan>;

  // Financial Module - Vendor Payables
  getVendorPayables(): Promise<VendorPayable[]>;
  getUnpaidPayables(): Promise<VendorPayable[]>;
  createVendorPayable(payable: InsertVendorPayable): Promise<VendorPayable>;
  updateVendorPayable(id: number, updates: Partial<VendorPayable>): Promise<VendorPayable>;

  // Quote Versions (CPQ History)
  getQuoteVersions(leadId: number): Promise<QuoteVersion[]>;
  getQuoteVersion(id: number): Promise<QuoteVersion | undefined>;
  createQuoteVersion(version: InsertQuoteVersion): Promise<QuoteVersion>;
  updateQuoteVersion(id: number, updates: Partial<QuoteVersion>): Promise<QuoteVersion>;
  getNextVersionNumber(leadId: number): Promise<number>;

  // ScanTechs (Field Technicians)
  getScantechs(): Promise<Scantech[]>;
  getScantech(id: number): Promise<Scantech | undefined>;
  createScantech(scantech: InsertScantech): Promise<Scantech>;
  updateScantech(id: number, updates: Partial<InsertScantech>): Promise<Scantech>;

  // Project Attachments (Visual Scoping - Drive Sync)
  getProjectAttachments(projectId: number): Promise<ProjectAttachment[]>;
  getLeadAttachments(leadId: number): Promise<ProjectAttachment[]>;
  getAttachment(id: number): Promise<ProjectAttachment | undefined>;
  createAttachment(attachment: InsertProjectAttachment): Promise<ProjectAttachment>;
  deleteAttachment(id: number): Promise<void>;
  countProjectAttachments(projectId: number): Promise<number>;

  // CPQ Internal Pricing & Quotes
  getCpqPricingMatrix(): Promise<CpqPricingMatrix[]>;
  getCpqUpteamPricingMatrix(): Promise<CpqUpteamPricingMatrix[]>;
  getCpqCadPricingMatrix(): Promise<CpqCadPricingMatrix[]>;
  getCpqPricingParameters(): Promise<CpqPricingParameter[]>;
  getCpqQuote(id: number): Promise<CpqQuote | undefined>;
  getCpqQuoteByToken(token: string): Promise<CpqQuote | undefined>;
  getCpqQuoteByPandadocId(documentId: string): Promise<CpqQuote | undefined>;
  getCpqQuotesByLead(leadId: number): Promise<CpqQuote[]>;
  getLatestCpqQuoteForLead(leadId: number): Promise<CpqQuote | undefined>;
  createCpqQuote(quote: InsertCpqQuote): Promise<CpqQuote>;
  updateCpqQuote(id: number, updates: Partial<InsertCpqQuote>): Promise<CpqQuote | undefined>;
  deleteCpqQuote(id: number): Promise<void>;
  createCpqQuoteVersion(sourceQuoteId: number, versionName: string | undefined, createdBy: string): Promise<CpqQuote>;

  // Case Studies (Proof Vault)
  getCaseStudies(): Promise<CaseStudy[]>;
  getCaseStudiesByTags(tags: string[]): Promise<CaseStudy[]>;
  getCaseStudy(id: number): Promise<CaseStudy | undefined>;
  createCaseStudy(study: InsertCaseStudy): Promise<CaseStudy>;
  updateCaseStudy(id: number, updates: Partial<InsertCaseStudy>): Promise<CaseStudy | undefined>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsForUser(userId: string): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<void>;

  // Proposal Email Tracking
  createProposalEmailEvent(event: InsertProposalEmailEvent): Promise<ProposalEmailEvent>;
  getProposalEmailEventByToken(token: string): Promise<ProposalEmailEvent | undefined>;
  getProposalEmailEventsByLead(leadId: number): Promise<ProposalEmailEvent[]>;
  recordProposalOpen(token: string): Promise<ProposalEmailEvent | undefined>;
  recordProposalClick(token: string): Promise<ProposalEmailEvent | undefined>;

  // Deal Attributions (Marketing Influence Tracker)
  getDealAttributions(leadId: number): Promise<DealAttribution[]>;
  createDealAttribution(attribution: InsertDealAttribution): Promise<DealAttribution>;
  deleteDealAttribution(id: number): Promise<void>;

  // Events (Education-Led Sales)
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;

  // Event Registrations
  getEventRegistrations(eventId: number): Promise<EventRegistration[]>;
  getEventRegistrationsByLead(leadId: number): Promise<EventRegistration[]>;
  createEventRegistration(registration: InsertEventRegistration): Promise<EventRegistration>;
  updateEventRegistrationStatus(id: number, status: string, leadId: number): Promise<EventRegistration>;
  deleteEventRegistration(id: number): Promise<void>;

  // ABM Analytics
  getTierAAccountPenetration(): Promise<{ total: number; engaged: number; percentage: number }>;

  // QuickBooks Customers (Synced)
  getQbCustomers(): Promise<QbCustomer[]>;
  searchQbCustomers(query: string): Promise<QbCustomer[]>;
  getQbCustomerByQbId(qbId: string): Promise<QbCustomer | undefined>;
  upsertQbCustomer(customer: InsertQbCustomer): Promise<QbCustomer>;

  // Lead Documents (Files attached to deals)
  getLeadDocuments(leadId: number): Promise<LeadDocument[]>;
  getLeadDocument(id: number): Promise<LeadDocument | undefined>;
  createLeadDocument(doc: InsertLeadDocument): Promise<LeadDocument>;
  updateLeadDocument(id: number, updates: Partial<LeadDocument>): Promise<LeadDocument>;
  deleteLeadDocument(id: number): Promise<void>;
  getUnmigratedDocuments(leadId: number): Promise<LeadDocument[]>;
}

export class DatabaseStorage implements IStorage {
  // Leads - delegated to LeadRepository
  async getLeads(): Promise<Lead[]> {
    return leadRepo.getLeads();
  }

  async getDeletedLeads(): Promise<Lead[]> {
    return leadRepo.getDeletedLeads();
  }

  async getLead(id: number): Promise<Lead | undefined> {
    return leadRepo.getLead(id);
  }

  async getLeadByQboInvoiceId(qboInvoiceId: string): Promise<Lead | undefined> {
    return leadRepo.getLeadByQboInvoiceId(qboInvoiceId);
  }

  async getLeadByQboEstimateId(qboEstimateId: string): Promise<Lead | undefined> {
    return leadRepo.getLeadByQboEstimateId(qboEstimateId);
  }

  async getLeadByClientName(clientName: string): Promise<Lead | undefined> {
    return leadRepo.getLeadByClientName(clientName);
  }

  async getLeadsByClientName(clientName: string): Promise<Lead[]> {
    return leadRepo.getLeadsByClientName(clientName);
  }

  async getLeadsByQboCustomerId(qboCustomerId: string): Promise<Lead[]> {
    return leadRepo.getLeadsByQboCustomerId(qboCustomerId);
  }

  async getLeadsByImportSource(importSource: string): Promise<Lead[]> {
    return leadRepo.getLeadsByImportSource(importSource);
  }

  async getLeadByClientToken(token: string): Promise<Lead | undefined> {
    return leadRepo.getLeadByClientToken(token);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    return leadRepo.createLead(insertLead);
  }

  async updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead> {
    return leadRepo.updateLead(id, updates);
  }

  async softDeleteLead(id: number, deletedBy?: string): Promise<Lead> {
    return leadRepo.softDeleteLead(id, deletedBy);
  }

  async restoreLead(id: number): Promise<Lead> {
    return leadRepo.restoreLead(id);
  }

  async deleteLead(id: number): Promise<void> {
    return leadRepo.deleteLead(id);
  }

  // Projects - delegated to ProjectRepository
  async getProjects(): Promise<Project[]> {
    return projectRepo.getProjects();
  }

  async getProject(id: number): Promise<Project | undefined> {
    return projectRepo.getProject(id);
  }

  async getProjectByLeadId(leadId: number): Promise<Project | undefined> {
    return projectRepo.getProjectByLeadId(leadId);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    return projectRepo.createProject(insertProject);
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project> {
    return projectRepo.updateProject(id, updates);
  }

  // Field Notes - delegated to FieldNoteRepository
  async getFieldNotes(): Promise<FieldNote[]> {
    return fieldNoteRepo.getFieldNotes();
  }

  async getFieldNote(id: number): Promise<FieldNote | undefined> {
    return fieldNoteRepo.getFieldNote(id);
  }

  async createFieldNote(insertNote: InsertFieldNote): Promise<FieldNote> {
    return fieldNoteRepo.createFieldNote(insertNote);
  }

  async updateFieldNote(id: number, updates: Partial<FieldNote>): Promise<FieldNote> {
    return fieldNoteRepo.updateFieldNote(id, updates);
  }

  // Settings - delegated to SettingsRepository
  async getAllSettings(): Promise<Setting[]> {
    return settingsRepo.getAllSettings();
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    return settingsRepo.getSetting(key);
  }

  async setSetting(key: string, value: unknown): Promise<Setting> {
    return settingsRepo.setSetting(key, value);
  }

  async updateSetting(key: string, value: unknown): Promise<Setting> {
    return settingsRepo.updateSetting(key, value);
  }

  async getSettingValue<T>(key: string): Promise<T | null> {
    return settingsRepo.getSettingValue<T>(key);
  }

  // Lead Research - delegated to LeadResearchRepository
  async getLeadResearch(leadId: number): Promise<LeadResearch[]> {
    return leadResearchRepo.getLeadResearch(leadId);
  }

  async getAllResearch(): Promise<LeadResearch[]> {
    return leadResearchRepo.getAllResearch();
  }

  async createLeadResearch(research: InsertLeadResearch): Promise<LeadResearch> {
    return leadResearchRepo.createLeadResearch(research);
  }

  // User Management - delegated to UserRepository
  async getAllUsers(): Promise<User[]> {
    return userRepo.getAllUsers();
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    return userRepo.updateUserRole(userId, role);
  }

  // === FINANCIAL MODULE === (delegated to domain repositories)

  // Accounts (Profit First)
  async getAccounts(): Promise<Account[]> {
    return accountRepo.getAccounts();
  }

  async getAccount(id: number): Promise<Account | undefined> {
    return accountRepo.getAccount(id);
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    return accountRepo.createAccount(insertAccount);
  }

  async updateAccount(id: number, updates: Partial<InsertAccount>): Promise<Account> {
    return accountRepo.updateAccount(id, updates);
  }

  // Invoices (AR with Interest)
  async getInvoices(): Promise<Invoice[]> {
    return invoiceRepo.getInvoices();
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    return invoiceRepo.getInvoice(id);
  }

  async getInvoicesByLead(leadId: number): Promise<Invoice[]> {
    return invoiceRepo.getInvoicesByLead(leadId);
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    return invoiceRepo.getOverdueInvoices();
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    return invoiceRepo.createInvoice(insertInvoice);
  }

  async updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice> {
    return invoiceRepo.updateInvoice(id, updates);
  }

  // Internal Loans
  async getInternalLoans(): Promise<InternalLoan[]> {
    return internalLoanRepo.getInternalLoans();
  }

  async getActiveLoan(): Promise<InternalLoan | undefined> {
    return internalLoanRepo.getActiveLoan();
  }

  async createInternalLoan(insertLoan: InsertInternalLoan): Promise<InternalLoan> {
    return internalLoanRepo.createInternalLoan(insertLoan);
  }

  async updateInternalLoan(id: number, updates: Partial<InternalLoan>): Promise<InternalLoan> {
    return internalLoanRepo.updateInternalLoan(id, updates);
  }

  // Vendor Payables (AP)
  async getVendorPayables(): Promise<VendorPayable[]> {
    return vendorPayableRepo.getVendorPayables();
  }

  async getUnpaidPayables(): Promise<VendorPayable[]> {
    return vendorPayableRepo.getUnpaidPayables();
  }

  async createVendorPayable(insertPayable: InsertVendorPayable): Promise<VendorPayable> {
    return vendorPayableRepo.createVendorPayable(insertPayable);
  }

  async updateVendorPayable(id: number, updates: Partial<VendorPayable>): Promise<VendorPayable> {
    return vendorPayableRepo.updateVendorPayable(id, updates);
  }

  // Quote Versions - delegated to QuoteVersionRepository
  async getQuoteVersions(leadId: number): Promise<QuoteVersion[]> {
    return quoteVersionRepo.getQuoteVersions(leadId);
  }

  async getQuoteVersion(id: number): Promise<QuoteVersion | undefined> {
    return quoteVersionRepo.getQuoteVersion(id);
  }

  async createQuoteVersion(insertVersion: InsertQuoteVersion): Promise<QuoteVersion> {
    return quoteVersionRepo.createQuoteVersion(insertVersion);
  }

  async updateQuoteVersion(id: number, updates: Partial<QuoteVersion>): Promise<QuoteVersion> {
    return quoteVersionRepo.updateQuoteVersion(id, updates);
  }

  async getNextVersionNumber(leadId: number): Promise<number> {
    return quoteVersionRepo.getNextVersionNumber(leadId);
  }

  // ScanTechs (Field Technicians) - delegated to ScantechRepository
  async getScantechs(): Promise<Scantech[]> {
    return scantechRepo.getScantechs();
  }

  async getScantech(id: number): Promise<Scantech | undefined> {
    return scantechRepo.getScantech(id);
  }

  async createScantech(insertScantech: InsertScantech): Promise<Scantech> {
    return scantechRepo.createScantech(insertScantech);
  }

  async updateScantech(id: number, updates: Partial<InsertScantech>): Promise<Scantech> {
    return scantechRepo.updateScantech(id, updates);
  }

  // Project Attachments (Visual Scoping - Drive Sync) - delegated to ProjectAttachmentRepository
  async getProjectAttachments(projectId: number): Promise<ProjectAttachment[]> {
    return projectAttachmentRepo.getProjectAttachments(projectId);
  }

  async getLeadAttachments(leadId: number): Promise<ProjectAttachment[]> {
    return projectAttachmentRepo.getLeadAttachments(leadId);
  }

  async getAttachment(id: number): Promise<ProjectAttachment | undefined> {
    return projectAttachmentRepo.getAttachment(id);
  }

  async createAttachment(insertAttachment: InsertProjectAttachment): Promise<ProjectAttachment> {
    return projectAttachmentRepo.createAttachment(insertAttachment);
  }

  async deleteAttachment(id: number): Promise<void> {
    return projectAttachmentRepo.deleteAttachment(id);
  }

  async countProjectAttachments(projectId: number): Promise<number> {
    return projectAttachmentRepo.countProjectAttachments(projectId);
  }

  // CPQ Internal Pricing & Quotes - delegated to CpqQuoteRepository and CpqPricingRepository
  async getCpqPricingMatrix(): Promise<CpqPricingMatrix[]> {
    return cpqPricingRepo.getCpqPricingMatrix();
  }

  async getCpqUpteamPricingMatrix(): Promise<CpqUpteamPricingMatrix[]> {
    return cpqPricingRepo.getCpqUpteamPricingMatrix();
  }

  async getCpqCadPricingMatrix(): Promise<CpqCadPricingMatrix[]> {
    return cpqPricingRepo.getCpqCadPricingMatrix();
  }

  async getCpqPricingParameters(): Promise<CpqPricingParameter[]> {
    return cpqPricingRepo.getCpqPricingParameters();
  }

  async getCpqQuote(id: number): Promise<CpqQuote | undefined> {
    return cpqQuoteRepo.getCpqQuote(id);
  }

  async getCpqQuoteByToken(token: string): Promise<CpqQuote | undefined> {
    return cpqQuoteRepo.getCpqQuoteByToken(token);
  }

  async getCpqQuoteByPandadocId(documentId: string): Promise<CpqQuote | undefined> {
    return cpqQuoteRepo.getCpqQuoteByPandadocId(documentId);
  }

  async getCpqQuotesByLead(leadId: number): Promise<CpqQuote[]> {
    return cpqQuoteRepo.getCpqQuotesByLead(leadId);
  }

  async getLatestCpqQuoteForLead(leadId: number): Promise<CpqQuote | undefined> {
    return cpqQuoteRepo.getLatestCpqQuoteForLead(leadId);
  }

  async generateNextQuoteNumber(): Promise<string> {
    return cpqQuoteRepo.generateNextQuoteNumber();
  }

  async createCpqQuote(insertQuote: InsertCpqQuote): Promise<CpqQuote> {
    return cpqQuoteRepo.createCpqQuote(insertQuote);
  }

  async updateCpqQuote(id: number, updates: Partial<InsertCpqQuote>): Promise<CpqQuote | undefined> {
    return cpqQuoteRepo.updateCpqQuote(id, updates);
  }

  async deleteCpqQuote(id: number): Promise<void> {
    return cpqQuoteRepo.deleteCpqQuote(id);
  }

  async createCpqQuoteVersion(sourceQuoteId: number, versionName: string | undefined, createdBy: string): Promise<CpqQuote> {
    return cpqQuoteRepo.createCpqQuoteVersion(sourceQuoteId, versionName, createdBy);
  }

  // === MARKETING MODULE === (delegated to domain repositories)

  // Case Studies (Proof Vault)
  async getCaseStudies(): Promise<CaseStudy[]> {
    return caseStudyRepo.getCaseStudies();
  }

  async getCaseStudiesByTags(tags: string[]): Promise<CaseStudy[]> {
    return caseStudyRepo.getCaseStudiesByTags(tags);
  }

  async getCaseStudy(id: number): Promise<CaseStudy | undefined> {
    return caseStudyRepo.getCaseStudy(id);
  }

  async createCaseStudy(insertStudy: InsertCaseStudy): Promise<CaseStudy> {
    return caseStudyRepo.createCaseStudy(insertStudy);
  }

  async updateCaseStudy(id: number, updates: Partial<InsertCaseStudy>): Promise<CaseStudy | undefined> {
    return caseStudyRepo.updateCaseStudy(id, updates);
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    return notificationRepo.createNotification(notification);
  }

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return notificationRepo.getNotificationsForUser(userId);
  }

  async markNotificationRead(id: number): Promise<void> {
    return notificationRepo.markNotificationRead(id);
  }

  // Proposal Email Tracking
  async createProposalEmailEvent(event: InsertProposalEmailEvent): Promise<ProposalEmailEvent> {
    return proposalEmailRepo.createProposalEmailEvent(event);
  }

  async getProposalEmailEventByToken(token: string): Promise<ProposalEmailEvent | undefined> {
    return proposalEmailRepo.getProposalEmailEventByToken(token);
  }

  async getProposalEmailEventsByLead(leadId: number): Promise<ProposalEmailEvent[]> {
    return proposalEmailRepo.getProposalEmailEventsByLead(leadId);
  }

  async recordProposalOpen(token: string): Promise<ProposalEmailEvent | undefined> {
    return proposalEmailRepo.recordProposalOpen(token);
  }

  async recordProposalClick(token: string): Promise<ProposalEmailEvent | undefined> {
    return proposalEmailRepo.recordProposalClick(token);
  }

  // Deal Attributions (Marketing Influence Tracker)
  async getDealAttributions(leadId: number): Promise<DealAttribution[]> {
    return dealAttributionRepo.getDealAttributions(leadId);
  }

  async createDealAttribution(attribution: InsertDealAttribution): Promise<DealAttribution> {
    return dealAttributionRepo.createDealAttribution(attribution);
  }

  async deleteDealAttribution(id: number): Promise<void> {
    return dealAttributionRepo.deleteDealAttribution(id);
  }

  // Events (Education-Led Sales)
  async getEvents(): Promise<Event[]> {
    return eventRepo.getEvents();
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return eventRepo.getEvent(id);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    return eventRepo.createEvent(insertEvent);
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event> {
    return eventRepo.updateEvent(id, updates);
  }

  async deleteEvent(id: number): Promise<void> {
    return eventRepo.deleteEvent(id);
  }

  // Event Registrations
  async getEventRegistrations(eventId: number): Promise<EventRegistration[]> {
    return eventRegistrationRepo.getEventRegistrations(eventId);
  }

  async getEventRegistrationsByLead(leadId: number): Promise<EventRegistration[]> {
    return eventRegistrationRepo.getEventRegistrationsByLead(leadId);
  }

  async createEventRegistration(registration: InsertEventRegistration): Promise<EventRegistration> {
    return eventRegistrationRepo.createEventRegistration(registration);
  }

  async updateEventRegistrationStatus(id: number, status: string, leadId: number): Promise<EventRegistration> {
    return eventRegistrationRepo.updateEventRegistrationStatus(id, status, leadId);
  }

  async deleteEventRegistration(id: number): Promise<void> {
    return eventRegistrationRepo.deleteEventRegistration(id);
  }

  // ABM Analytics
  async getTierAAccountPenetration(): Promise<{ total: number; engaged: number; percentage: number }> {
    return abmAnalyticsRepo.getTierAAccountPenetration();
  }

  // QuickBooks Customers
  async getQbCustomers(): Promise<QbCustomer[]> {
    return await db.select().from(qbCustomers).orderBy(qbCustomers.displayName);
  }

  async searchQbCustomers(query: string): Promise<QbCustomer[]> {
    if (!query || query.length < 2) return [];
    const searchPattern = `%${query}%`;
    return await db.select().from(qbCustomers)
      .where(ilike(qbCustomers.displayName, searchPattern))
      .orderBy(qbCustomers.displayName)
      .limit(20);
  }

  async getQbCustomerByQbId(qbId: string): Promise<QbCustomer | undefined> {
    const [customer] = await db.select().from(qbCustomers).where(eq(qbCustomers.qbId, qbId));
    return customer;
  }

  async upsertQbCustomer(customer: InsertQbCustomer): Promise<QbCustomer> {
    const existing = await this.getQbCustomerByQbId(customer.qbId);
    if (existing) {
      const [updated] = await db.update(qbCustomers)
        .set({ ...customer, syncedAt: new Date() })
        .where(eq(qbCustomers.qbId, customer.qbId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(qbCustomers).values(customer).returning();
      return created;
    }
  }

  // Lead Documents - delegated to LeadDocumentRepository
  async getLeadDocuments(leadId: number): Promise<LeadDocument[]> {
    return leadDocumentRepo.getLeadDocuments(leadId);
  }

  async getLeadDocument(id: number): Promise<LeadDocument | undefined> {
    return leadDocumentRepo.getLeadDocument(id);
  }

  async createLeadDocument(doc: InsertLeadDocument): Promise<LeadDocument> {
    return leadDocumentRepo.createLeadDocument(doc);
  }

  async updateLeadDocument(id: number, updates: Partial<LeadDocument>): Promise<LeadDocument> {
    return leadDocumentRepo.updateLeadDocument(id, updates);
  }

  async deleteLeadDocument(id: number): Promise<void> {
    return leadDocumentRepo.deleteLeadDocument(id);
  }

  async getUnmigratedDocuments(leadId: number): Promise<LeadDocument[]> {
    return leadDocumentRepo.getUnmigratedDocuments(leadId);
  }
}

export const storage = new DatabaseStorage();
