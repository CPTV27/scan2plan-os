
import { db } from "../../db";
import { leads, leadResearch, buyerPersonas, caseStudies } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { findSimilarProjects, findMatchingCaseStudies } from "./projectMatcher";
import type { Lead, LeadResearch, BuyerPersona, CaseStudy } from "@shared/schema";

export interface AIContext {
    lead: Lead;
    research: LeadResearch[];
    persona: BuyerPersona | null;
    similarProjects: any[];
    relevantCaseStudies: CaseStudy[];
}

export async function getAIContext(leadId: number): Promise<AIContext> {
    // 1. Fetch Lead
    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
    });

    if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
    }

    // 2. Fetch Lead Research (if any)
    const research = await db.query.leadResearch.findMany({
        where: eq(leadResearch.leadId, leadId),
        orderBy: [desc(leadResearch.createdAt)],
        limit: 5,
    });

    // 3. Fetch Persona (if assigned)
    let persona: BuyerPersona | null = null;
    if (lead.buyerPersona) {
        persona = await db.query.buyerPersonas.findFirst({
            where: eq(buyerPersonas.code, lead.buyerPersona),
        }) || null;
    }

    // 4. Fetch Similar Projects (Internal Knowledge)
    // We need all leads for this function
    // In a real optimized system, we wouldn't fetch all leads every time, but for now/MVP:
    const allLeads = await db.query.leads.findMany();
    const similarProjectsResult = await findSimilarProjects(lead, allLeads, { maxResults: 3 });

    // 5. Fetch Relevant Case Studies (External Proof)
    const caseStudiesResult = await findMatchingCaseStudies(lead, 3);

    return {
        lead,
        research,
        persona,
        similarProjects: similarProjectsResult.similarProjects,
        relevantCaseStudies: caseStudiesResult.recommendations,
    };
}

export function formatContextForPrompt(context: AIContext): string {
    let output = `PROJECT CONTEXT:\n`;
    output += `Client: ${context.lead.clientName}\n`;
    output += `Project: ${context.lead.projectName}\n`;
    output += `Scope: ${context.lead.scope}\n`;
    output += `Building: ${context.lead.buildingType}, ${context.lead.sqft} sqft\n`;
    output += `Location: ${context.lead.projectAddress}\n`;
    output += `Values: ${context.lead.value}\n`;

    if (context.persona) {
        output += `\nBUYER PERSONA (${context.persona.name}):\n`;
        output += `Role: ${context.persona.roleTitle}\n`;
        output += `Pain Points: ${context.persona.primaryPain}\n`;
        output += `Value Drivers: ${context.persona.valueDriver}\n`;
    }

    if (context.research.length > 0) {
        output += `\nRESEARCH INSIGHTS:\n`;
        context.research.forEach(r => {
            output += `- ${r.summary}\n`;
        });
    }

    if (context.similarProjects.length > 0) {
        output += `\nSIMILAR COMPLETED PROJECTS:\n`;
        context.similarProjects.forEach(p => {
            output += `- ${p.projectName}: ${p.similarityScore}% match. Outcome: ${p.outcome}\n`;
        });
    }

    if (context.relevantCaseStudies.length > 0) {
        output += `\nRELEVANT CASE STUDIES:\n`;
        context.relevantCaseStudies.forEach(cs => {
            output += `- ${cs.title}: ${cs.blurb}\n`;
        });
    }

    return output;
}
