/**
 * Marketing Storage Repository
 * 
 * Domain-specific repository for marketing module operations:
 * - Case Studies (Proof Vault)
 * - Case Study Snippets
 * - Events (Education-Led Sales)
 * - Event Registrations
 * - Deal Attributions (Marketing Influence Tracker)
 * - Notifications
 * - Proposal Email Tracking
 * - ABM Analytics
 */

import { db } from "../db";
import {
  caseStudies, caseStudySnippets, events, eventRegistrations, dealAttributions,
  notifications, proposalEmailEvents, leads,
  type CaseStudy, type InsertCaseStudy,
  type CaseStudySnippet, type InsertCaseStudySnippet,
  type Event, type InsertEvent,
  type EventRegistration, type InsertEventRegistration,
  type DealAttribution, type InsertDealAttribution,
  type Notification, type InsertNotification,
  type ProposalEmailEvent, type InsertProposalEmailEvent
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";

export interface CaseStudyWithSnippets extends CaseStudy {
  snippets: CaseStudySnippet[];
}

export class CaseStudyRepository {
  async getCaseStudies(): Promise<CaseStudy[]> {
    return await db.select().from(caseStudies)
      .where(eq(caseStudies.isActive, true))
      .orderBy(desc(caseStudies.createdAt));
  }

  async getCaseStudiesByTags(tags: string[]): Promise<CaseStudy[]> {
    if (!tags.length) return this.getCaseStudies();
    const allStudies = await this.getCaseStudies();
    return allStudies.filter(study =>
      study.tags.some(tag => tags.some(t =>
        tag.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(tag.toLowerCase())
      ))
    );
  }

  async getCaseStudy(id: number): Promise<CaseStudy | undefined> {
    const [study] = await db.select().from(caseStudies).where(eq(caseStudies.id, id));
    return study;
  }

  async getCaseStudyWithSnippets(id: number): Promise<CaseStudyWithSnippets | undefined> {
    const study = await this.getCaseStudy(id);
    if (!study) return undefined;

    const snippets = await db.select().from(caseStudySnippets)
      .where(eq(caseStudySnippets.caseStudyId, id))
      .orderBy(caseStudySnippets.createdAt);

    return { ...study, snippets };
  }

  async searchCaseStudies(query: string): Promise<CaseStudy[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(caseStudies)
      .where(and(
        eq(caseStudies.isActive, true),
        or(
          ilike(caseStudies.title, searchPattern),
          ilike(caseStudies.blurb, searchPattern),
          ilike(caseStudies.clientName, searchPattern),
          ilike(caseStudies.heroStat, searchPattern)
        )
      ))
      .orderBy(desc(caseStudies.createdAt));
  }

  async createCaseStudy(insertStudy: InsertCaseStudy): Promise<CaseStudy> {
    const [study] = await db.insert(caseStudies).values(insertStudy).returning();
    return study;
  }

  async updateCaseStudy(id: number, updates: Partial<InsertCaseStudy>): Promise<CaseStudy | undefined> {
    const [updated] = await db.update(caseStudies)
      .set(updates)
      .where(eq(caseStudies.id, id))
      .returning();
    return updated;
  }

  async deleteCaseStudy(id: number): Promise<void> {
    // Soft delete - set isActive to false
    await db.update(caseStudies)
      .set({ isActive: false })
      .where(eq(caseStudies.id, id));
  }

  // Snippet methods
  async getSnippets(caseStudyId: number): Promise<CaseStudySnippet[]> {
    return await db.select().from(caseStudySnippets)
      .where(eq(caseStudySnippets.caseStudyId, caseStudyId))
      .orderBy(caseStudySnippets.createdAt);
  }

  async createSnippet(snippet: InsertCaseStudySnippet): Promise<CaseStudySnippet> {
    const [created] = await db.insert(caseStudySnippets).values(snippet).returning();
    return created;
  }

  async updateSnippet(id: number, updates: Partial<InsertCaseStudySnippet>): Promise<CaseStudySnippet | undefined> {
    const [updated] = await db.update(caseStudySnippets)
      .set(updates)
      .where(eq(caseStudySnippets.id, id))
      .returning();
    return updated;
  }

  async deleteSnippet(id: number): Promise<void> {
    await db.delete(caseStudySnippets).where(eq(caseStudySnippets.id, id));
  }
}

export class EventRepository {
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.date));
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const dbValues = {
      ...insertEvent,
      ceuCredits: insertEvent.ceuCredits?.toString(),
    };
    const [event] = await db.insert(events).values(dbValues).returning();
    return event;
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event> {
    const dbUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (key === 'ceuCredits' && value !== null) {
        dbUpdates[key] = value.toString();
      } else {
        dbUpdates[key] = value;
      }
    }
    const [updated] = await db.update(events)
      .set(dbUpdates)
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }
}

export class EventRegistrationRepository {
  async getEventRegistrations(eventId: number): Promise<EventRegistration[]> {
    return await db.select().from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId))
      .orderBy(desc(eventRegistrations.registeredAt));
  }

  async getEventRegistrationsByLead(leadId: number): Promise<EventRegistration[]> {
    return await db.select().from(eventRegistrations)
      .where(eq(eventRegistrations.leadId, leadId))
      .orderBy(desc(eventRegistrations.registeredAt));
  }

  async createEventRegistration(registration: InsertEventRegistration): Promise<EventRegistration> {
    const [created] = await db.insert(eventRegistrations).values(registration).returning();
    return created;
  }

  async updateEventRegistrationStatus(id: number, status: string, leadId: number): Promise<EventRegistration> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'attended') {
      updateData.attendedAt = new Date();
      await db.update(leads)
        .set({ leadScore: sql`COALESCE(lead_score, 0) + 10` })
        .where(eq(leads.id, leadId));
    } else if (status === 'certificate_sent') {
      updateData.certificateSentAt = new Date();
    }

    const [updated] = await db.update(eventRegistrations)
      .set(updateData)
      .where(eq(eventRegistrations.id, id))
      .returning();
    return updated;
  }

  async deleteEventRegistration(id: number): Promise<void> {
    await db.delete(eventRegistrations).where(eq(eventRegistrations.id, id));
  }
}

export class DealAttributionRepository {
  async getDealAttributions(leadId: number): Promise<DealAttribution[]> {
    return await db.select().from(dealAttributions)
      .where(eq(dealAttributions.leadId, leadId))
      .orderBy(desc(dealAttributions.recordedAt));
  }

  async createDealAttribution(attribution: InsertDealAttribution): Promise<DealAttribution> {
    const [created] = await db.insert(dealAttributions).values(attribution).returning();
    return created;
  }

  async deleteDealAttribution(id: number): Promise<void> {
    await db.delete(dealAttributions).where(eq(dealAttributions.id, id));
  }
}

export class NotificationRepository {
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }
}

export class ProposalEmailRepository {
  async createProposalEmailEvent(event: InsertProposalEmailEvent): Promise<ProposalEmailEvent> {
    const [created] = await db.insert(proposalEmailEvents).values(event).returning();
    return created;
  }

  async getProposalEmailEventByToken(token: string): Promise<ProposalEmailEvent | undefined> {
    const [event] = await db.select().from(proposalEmailEvents)
      .where(eq(proposalEmailEvents.token, token));
    return event;
  }

  async getProposalEmailEventsByLead(leadId: number): Promise<ProposalEmailEvent[]> {
    return await db.select().from(proposalEmailEvents)
      .where(eq(proposalEmailEvents.leadId, leadId))
      .orderBy(desc(proposalEmailEvents.sentAt));
  }

  async recordProposalOpen(token: string): Promise<ProposalEmailEvent | undefined> {
    const [updated] = await db.update(proposalEmailEvents)
      .set({
        openCount: sql`${proposalEmailEvents.openCount} + 1`,
        lastOpenedAt: new Date(),
        firstOpenedAt: sql`COALESCE(${proposalEmailEvents.firstOpenedAt}, NOW())`,
      })
      .where(eq(proposalEmailEvents.token, token))
      .returning();
    return updated;
  }

  async recordProposalClick(token: string): Promise<ProposalEmailEvent | undefined> {
    const [updated] = await db.update(proposalEmailEvents)
      .set({
        clickCount: sql`${proposalEmailEvents.clickCount} + 1`,
        lastOpenedAt: new Date(),
        firstOpenedAt: sql`COALESCE(${proposalEmailEvents.firstOpenedAt}, NOW())`,
      })
      .where(eq(proposalEmailEvents.token, token))
      .returning();
    return updated;
  }
}

export class AbmAnalyticsRepository {
  async getTierAAccountPenetration(): Promise<{ total: number; engaged: number; percentage: number }> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(eq(leads.abmTier, 'Tier A'));
    const total = Number(totalResult?.count || 0);

    const [engagedResult] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(and(
        eq(leads.abmTier, 'Tier A'),
        sql`(deal_stage IN ('Proposal', 'Negotiation', 'Closed Won') OR last_contact_date >= ${ninetyDaysAgo})`
      ));
    const engaged = Number(engagedResult?.count || 0);

    const percentage = total > 0 ? Math.round((engaged / total) * 100) : 0;

    return { total, engaged, percentage };
  }
}

export const caseStudyRepo = new CaseStudyRepository();
export const eventRepo = new EventRepository();
export const eventRegistrationRepo = new EventRegistrationRepository();
export const dealAttributionRepo = new DealAttributionRepository();
export const notificationRepo = new NotificationRepository();
export const proposalEmailRepo = new ProposalEmailRepository();
export const abmAnalyticsRepo = new AbmAnalyticsRepository();

export const caseStudyStorage = {
  getAll: (): Promise<CaseStudy[]> => caseStudyRepo.getCaseStudies(),
  getByTags: (tags: string[]): Promise<CaseStudy[]> => caseStudyRepo.getCaseStudiesByTags(tags),
  getById: (id: number): Promise<CaseStudy | undefined> => caseStudyRepo.getCaseStudy(id),
  getWithSnippets: (id: number): Promise<CaseStudyWithSnippets | undefined> => caseStudyRepo.getCaseStudyWithSnippets(id),
  search: (query: string): Promise<CaseStudy[]> => caseStudyRepo.searchCaseStudies(query),
  create: (study: InsertCaseStudy): Promise<CaseStudy> => caseStudyRepo.createCaseStudy(study),
  update: (id: number, updates: Partial<InsertCaseStudy>): Promise<CaseStudy | undefined> => caseStudyRepo.updateCaseStudy(id, updates),
  delete: (id: number): Promise<void> => caseStudyRepo.deleteCaseStudy(id),
  // Snippets
  getSnippets: (caseStudyId: number): Promise<CaseStudySnippet[]> => caseStudyRepo.getSnippets(caseStudyId),
  createSnippet: (snippet: InsertCaseStudySnippet): Promise<CaseStudySnippet> => caseStudyRepo.createSnippet(snippet),
  updateSnippet: (id: number, updates: Partial<InsertCaseStudySnippet>): Promise<CaseStudySnippet | undefined> => caseStudyRepo.updateSnippet(id, updates),
  deleteSnippet: (id: number): Promise<void> => caseStudyRepo.deleteSnippet(id),
};

export const eventStorage = {
  getAll: (): Promise<Event[]> => eventRepo.getEvents(),
  getById: (id: number): Promise<Event | undefined> => eventRepo.getEvent(id),
  create: (event: InsertEvent): Promise<Event> => eventRepo.createEvent(event),
  update: (id: number, updates: Partial<InsertEvent>): Promise<Event> => eventRepo.updateEvent(id, updates),
  delete: (id: number): Promise<void> => eventRepo.deleteEvent(id),
};

export const eventRegistrationStorage = {
  getByEventId: (eventId: number): Promise<EventRegistration[]> => eventRegistrationRepo.getEventRegistrations(eventId),
  getByLeadId: (leadId: number): Promise<EventRegistration[]> => eventRegistrationRepo.getEventRegistrationsByLead(leadId),
  create: (registration: InsertEventRegistration): Promise<EventRegistration> => eventRegistrationRepo.createEventRegistration(registration),
  updateStatus: (id: number, status: string, leadId: number): Promise<EventRegistration> =>
    eventRegistrationRepo.updateEventRegistrationStatus(id, status, leadId),
  delete: (id: number): Promise<void> => eventRegistrationRepo.deleteEventRegistration(id),
};

export const dealAttributionStorage = {
  getByLeadId: (leadId: number): Promise<DealAttribution[]> => dealAttributionRepo.getDealAttributions(leadId),
  create: (attribution: InsertDealAttribution): Promise<DealAttribution> => dealAttributionRepo.createDealAttribution(attribution),
  delete: (id: number): Promise<void> => dealAttributionRepo.deleteDealAttribution(id),
};

export const notificationStorage = {
  create: (notification: InsertNotification): Promise<Notification> => notificationRepo.createNotification(notification),
  getForUser: (userId: string): Promise<Notification[]> => notificationRepo.getNotificationsForUser(userId),
  markRead: (id: number): Promise<void> => notificationRepo.markNotificationRead(id),
};

export const proposalEmailStorage = {
  create: (event: InsertProposalEmailEvent): Promise<ProposalEmailEvent> => proposalEmailRepo.createProposalEmailEvent(event),
  getByToken: (token: string): Promise<ProposalEmailEvent | undefined> => proposalEmailRepo.getProposalEmailEventByToken(token),
  getByLeadId: (leadId: number): Promise<ProposalEmailEvent[]> => proposalEmailRepo.getProposalEmailEventsByLead(leadId),
  recordOpen: (token: string): Promise<ProposalEmailEvent | undefined> => proposalEmailRepo.recordProposalOpen(token),
  recordClick: (token: string): Promise<ProposalEmailEvent | undefined> => proposalEmailRepo.recordProposalClick(token),
};

export const abmAnalyticsStorage = {
  getTierAAccountPenetration: (): Promise<{ total: number; engaged: number; percentage: number }> =>
    abmAnalyticsRepo.getTierAAccountPenetration(),
};
