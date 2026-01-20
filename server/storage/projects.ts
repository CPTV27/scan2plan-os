/**
 * Projects Storage Repository
 * 
 * Domain-specific repository for project-related database operations:
 * - Projects (CRUD)
 * - Project Attachments (Visual Scoping - Drive Sync)
 */

import { db } from "../db";
import { 
  projects, projectAttachments,
  type Project, type InsertProject,
  type ProjectAttachment, type InsertProjectAttachment
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export class ProjectRepository {
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectByLeadId(leadId: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.leadId, leadId));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject as any).returning();
    return project;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project> {
    const [updated] = await db.update(projects)
      .set(updates as any)
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }
}

export class ProjectAttachmentRepository {
  async getProjectAttachments(projectId: number): Promise<ProjectAttachment[]> {
    return await db.select().from(projectAttachments)
      .where(eq(projectAttachments.projectId, projectId))
      .orderBy(desc(projectAttachments.createdAt));
  }

  async getLeadAttachments(leadId: number): Promise<ProjectAttachment[]> {
    return await db.select().from(projectAttachments)
      .where(eq(projectAttachments.leadId, leadId))
      .orderBy(desc(projectAttachments.createdAt));
  }

  async getAttachment(id: number): Promise<ProjectAttachment | undefined> {
    const [attachment] = await db.select().from(projectAttachments).where(eq(projectAttachments.id, id));
    return attachment;
  }

  async createAttachment(insertAttachment: InsertProjectAttachment): Promise<ProjectAttachment> {
    const [attachment] = await db.insert(projectAttachments).values(insertAttachment).returning();
    return attachment;
  }

  async deleteAttachment(id: number): Promise<void> {
    await db.delete(projectAttachments).where(eq(projectAttachments.id, id));
  }

  async countProjectAttachments(projectId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(projectAttachments)
      .where(eq(projectAttachments.projectId, projectId));
    return result[0]?.count ?? 0;
  }
}

export const projectRepo = new ProjectRepository();
export const projectAttachmentRepo = new ProjectAttachmentRepository();

export const projectStorage = {
  getAll: (): Promise<Project[]> => projectRepo.getProjects(),
  getById: (id: number): Promise<Project | undefined> => projectRepo.getProject(id),
  getByLeadId: (leadId: number): Promise<Project | undefined> => projectRepo.getProjectByLeadId(leadId),
  create: (project: InsertProject): Promise<Project> => projectRepo.createProject(project),
  update: (id: number, updates: Partial<InsertProject>): Promise<Project> => projectRepo.updateProject(id, updates),
};

export const projectAttachmentStorage = {
  getByProjectId: (projectId: number): Promise<ProjectAttachment[]> => projectAttachmentRepo.getProjectAttachments(projectId),
  getByLeadId: (leadId: number): Promise<ProjectAttachment[]> => projectAttachmentRepo.getLeadAttachments(leadId),
  getById: (id: number): Promise<ProjectAttachment | undefined> => projectAttachmentRepo.getAttachment(id),
  create: (attachment: InsertProjectAttachment): Promise<ProjectAttachment> => projectAttachmentRepo.createAttachment(attachment),
  delete: (id: number): Promise<void> => projectAttachmentRepo.deleteAttachment(id),
  countByProjectId: (projectId: number): Promise<number> => projectAttachmentRepo.countProjectAttachments(projectId),
};
