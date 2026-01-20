/**
 * Storage Module - Domain-Organized Re-exports
 * 
 * This module provides backwards-compatible access to all storage operations
 * while organizing them by domain for cleaner imports in new code.
 * 
 * Usage:
 *   // Legacy (still works - preferred for existing code):
 *   import { storage } from "../storage";
 * 
 *   // Domain-specific (optional for new code):
 *   import { leadStorage, cpqQuoteStorage } from "../storage/index";
 * 
 * Domains:
 *   - leadStorage: Lead management (CRUD, search, soft delete)
 *   - cpqQuoteStorage: CPQ quotes
 *   - quoteVersionStorage: Quote version history
 *   - accountStorage, invoiceStorage, internalLoanStorage, vendorPayableStorage: Financial
 *   - caseStudyStorage, eventStorage, eventRegistrationStorage: Marketing
 *   - dealAttributionStorage, notificationStorage, proposalEmailStorage: Marketing
 *   - projectStorage, projectAttachmentStorage: Projects
 *   - userStorage: User management
 *   - settingsStorage: Application settings
 *   - scantechStorage: Field technicians
 *   - fieldNoteStorage: Field notes
 */

export { storage, IStorage, DatabaseStorage } from "../storage";

export * from "./leads";
export * from "./quotes";
export * from "./financial";
export * from "./marketing";
export * from "./projects";
export * from "./users";
export * from "./settings";
export * from "./scantechs";
export * from "./notes";
