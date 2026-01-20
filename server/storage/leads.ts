/**
 * Lead Storage Repository
 * 
 * Domain-specific repository for lead-related database operations.
 * Contains the actual Drizzle ORM logic for leads, lead research, and lead documents.
 */

import { db } from "../db";
import { 
  leads, leadResearch, leadDocuments, projects, fieldNotes, dealAttributions, quoteVersions, cpqQuotes, pandaDocDocuments,
  type Lead, type InsertLead, 
  type LeadResearch, type InsertLeadResearch,
  type LeadDocument, type InsertLeadDocument
} from "@shared/schema";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";

export class LeadRepository {
  async getLeads(): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(isNull(leads.deletedAt))
      .orderBy(desc(leads.lastContactDate));
  }

  async getDeletedLeads(): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(isNotNull(leads.deletedAt))
      .orderBy(desc(leads.deletedAt));
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadByQboInvoiceId(qboInvoiceId: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.qboInvoiceId, qboInvoiceId));
    return lead;
  }

  async getLeadByQboEstimateId(qboEstimateId: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.qboEstimateId, qboEstimateId));
    return lead;
  }

  async getLeadByClientName(clientName: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.clientName, clientName));
    return lead;
  }

  async getLeadsByClientName(clientName: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.clientName, clientName)).orderBy(desc(leads.lastContactDate));
  }

  async getLeadsByQboCustomerId(qboCustomerId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.qboCustomerId, qboCustomerId)).orderBy(desc(leads.lastContactDate));
  }

  async getLeadsByImportSource(importSource: string): Promise<Lead[]> {
    return await db.select().from(leads).where(
      and(
        eq(leads.importSource, importSource),
        isNull(leads.deletedAt)
      )
    ).orderBy(desc(leads.lastContactDate));
  }

  async getLeadByClientToken(token: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.clientToken, token)).limit(1);
    return lead;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const dbValues = {
      ...insertLead,
      value: insertLead.value?.toString(),
      travelRate: insertLead.travelRate?.toString(),
    };
    const [lead] = await db.insert(leads).values(dbValues).returning();
    return lead;
  }

  async updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead> {
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };
    
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      
      if (key === 'value' && value !== null) {
        dbUpdates[key] = value.toString();
      } else if (key === 'travelRate' && value !== null) {
        dbUpdates[key] = value.toString();
      } else {
        dbUpdates[key] = value;
      }
    }
    
    const [updated] = await db.update(leads)
      .set(dbUpdates)
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async softDeleteLead(id: number, deletedBy?: string): Promise<Lead> {
    const [deleted] = await db.update(leads)
      .set({ deletedAt: new Date(), deletedBy: deletedBy || null })
      .where(eq(leads.id, id))
      .returning();
    return deleted;
  }

  async restoreLead(id: number): Promise<Lead> {
    const [restored] = await db.update(leads)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(leads.id, id))
      .returning();
    return restored;
  }

  async deleteLead(id: number): Promise<void> {
    const leadQuotes = await db.select().from(cpqQuotes).where(eq(cpqQuotes.leadId, id));
    for (const quote of leadQuotes) {
      await db.delete(pandaDocDocuments).where(eq(pandaDocDocuments.cpqQuoteId, quote.id));
      await db.delete(cpqQuotes).where(eq(cpqQuotes.id, quote.id));
    }
    
    await db.delete(leadResearch).where(eq(leadResearch.leadId, id));
    await db.delete(projects).where(eq(projects.leadId, id));
    await db.delete(fieldNotes).where(eq(fieldNotes.leadId, id));
    await db.delete(dealAttributions).where(eq(dealAttributions.leadId, id));
    await db.delete(quoteVersions).where(eq(quoteVersions.leadId, id));
    await db.delete(leadDocuments).where(eq(leadDocuments.leadId, id));
    
    await db.delete(leads).where(eq(leads.id, id));
  }
}

export class LeadResearchRepository {
  async getLeadResearch(leadId: number): Promise<LeadResearch[]> {
    return await db.select().from(leadResearch)
      .where(eq(leadResearch.leadId, leadId))
      .orderBy(desc(leadResearch.createdAt));
  }

  async getAllResearch(): Promise<LeadResearch[]> {
    return await db.select().from(leadResearch)
      .orderBy(desc(leadResearch.createdAt));
  }

  async createLeadResearch(research: InsertLeadResearch): Promise<LeadResearch> {
    const [created] = await db.insert(leadResearch).values(research).returning();
    return created;
  }
}

export class LeadDocumentRepository {
  async getLeadDocuments(leadId: number): Promise<LeadDocument[]> {
    return await db.select().from(leadDocuments)
      .where(eq(leadDocuments.leadId, leadId))
      .orderBy(desc(leadDocuments.uploadedAt));
  }

  async getLeadDocument(id: number): Promise<LeadDocument | undefined> {
    const [doc] = await db.select().from(leadDocuments).where(eq(leadDocuments.id, id));
    return doc;
  }

  async createLeadDocument(doc: InsertLeadDocument): Promise<LeadDocument> {
    const [created] = await db.insert(leadDocuments).values(doc).returning();
    return created;
  }

  async updateLeadDocument(id: number, updates: Partial<LeadDocument>): Promise<LeadDocument> {
    const [updated] = await db.update(leadDocuments)
      .set(updates)
      .where(eq(leadDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteLeadDocument(id: number): Promise<void> {
    await db.delete(leadDocuments).where(eq(leadDocuments.id, id));
  }

  async getUnmigratedDocuments(leadId: number): Promise<LeadDocument[]> {
    return await db.select().from(leadDocuments)
      .where(and(
        eq(leadDocuments.leadId, leadId),
        isNull(leadDocuments.movedToDriveAt)
      ))
      .orderBy(leadDocuments.uploadedAt);
  }
}

export const leadRepo = new LeadRepository();
export const leadResearchRepo = new LeadResearchRepository();
export const leadDocumentRepo = new LeadDocumentRepository();

export const leadStorage = {
  getAll: (): Promise<Lead[]> => leadRepo.getLeads(),
  getDeleted: (): Promise<Lead[]> => leadRepo.getDeletedLeads(),
  getById: (id: number): Promise<Lead | undefined> => leadRepo.getLead(id),
  getByQboInvoiceId: (qboInvoiceId: string): Promise<Lead | undefined> => leadRepo.getLeadByQboInvoiceId(qboInvoiceId),
  getByQboEstimateId: (qboEstimateId: string): Promise<Lead | undefined> => leadRepo.getLeadByQboEstimateId(qboEstimateId),
  getByClientName: (clientName: string): Promise<Lead | undefined> => leadRepo.getLeadByClientName(clientName),
  getAllByClientName: (clientName: string): Promise<Lead[]> => leadRepo.getLeadsByClientName(clientName),
  getAllByQboCustomerId: (qboCustomerId: string): Promise<Lead[]> => leadRepo.getLeadsByQboCustomerId(qboCustomerId),
  getAllByImportSource: (importSource: string): Promise<Lead[]> => leadRepo.getLeadsByImportSource(importSource),
  getByClientToken: (token: string): Promise<Lead | undefined> => leadRepo.getLeadByClientToken(token),
  create: (lead: InsertLead): Promise<Lead> => leadRepo.createLead(lead),
  update: (id: number, updates: Partial<InsertLead>): Promise<Lead> => leadRepo.updateLead(id, updates),
  softDelete: (id: number, deletedBy?: string): Promise<Lead> => leadRepo.softDeleteLead(id, deletedBy),
  restore: (id: number): Promise<Lead> => leadRepo.restoreLead(id),
  hardDelete: (id: number): Promise<void> => leadRepo.deleteLead(id),
};

export const leadResearchStorage = {
  getByLeadId: (leadId: number) => leadResearchRepo.getLeadResearch(leadId),
  getAll: () => leadResearchRepo.getAllResearch(),
  create: (research: InsertLeadResearch) => leadResearchRepo.createLeadResearch(research),
};

export const leadDocumentStorage = {
  getByLeadId: (leadId: number): Promise<LeadDocument[]> => leadDocumentRepo.getLeadDocuments(leadId),
  getById: (id: number): Promise<LeadDocument | undefined> => leadDocumentRepo.getLeadDocument(id),
  create: (doc: InsertLeadDocument): Promise<LeadDocument> => leadDocumentRepo.createLeadDocument(doc),
  update: (id: number, updates: Partial<LeadDocument>): Promise<LeadDocument> => leadDocumentRepo.updateLeadDocument(id, updates),
  delete: (id: number): Promise<void> => leadDocumentRepo.deleteLeadDocument(id),
  getUnmigrated: (leadId: number): Promise<LeadDocument[]> => leadDocumentRepo.getUnmigratedDocuments(leadId),
};
