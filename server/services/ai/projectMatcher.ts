import { aiClient } from "./aiClient";
import { log } from "../../lib/logger";
import type { Lead, CaseStudy } from "@shared/schema";
import { db } from "../../db";
import { caseStudies } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface SimilarProject {
  leadId: number;
  projectName: string;
  clientName: string | null;
  buildingType: string | null;
  sqft: number | null;
  value: string | null;
  outcome: string;
  similarityScore: number;
  matchReasons: string[];
}

export interface ProjectMatchResult {
  similarProjects: SimilarProject[];
  recommendedCaseStudies: {
    projectId: number;
    projectName: string;
    relevanceScore: number;
    reason: string;
  }[];
  pricingBenchmarks: {
    averageValue: number;
    minValue: number;
    maxValue: number;
    sampleSize: number;
  } | null;
  analysisTime: number;
  error?: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function createProjectSummary(lead: Lead): string {
  const parts: string[] = [];

  if (lead.projectName) parts.push(`Project: ${lead.projectName}`);
  if (lead.buildingType) parts.push(`Building type: ${lead.buildingType}`);
  if (lead.sqft) parts.push(`Size: ${lead.sqft} sqft`);
  if (lead.scope) parts.push(`Scope: ${lead.scope}`);
  if (lead.disciplines) parts.push(`Disciplines: ${lead.disciplines}`);
  if (lead.projectAddress) {
    const state = extractState(lead.projectAddress);
    if (state) parts.push(`Location: ${state}`);
  }
  if (lead.notes) parts.push(`Notes: ${lead.notes.slice(0, 200)}`);

  return parts.join(". ");
}

function extractState(address: string): string | null {
  const stateMatch = address.match(/\b([A-Z]{2})\s*\d{5}/);
  return stateMatch ? stateMatch[1] : null;
}

export async function findSimilarProjects(
  targetLead: Lead,
  allLeads: Lead[],
  options: {
    useEmbeddings?: boolean;
    maxResults?: number;
  } = {}
): Promise<ProjectMatchResult> {
  const startTime = Date.now();
  const maxResults = options.maxResults || 5;

  const completedDeals = allLeads.filter(
    (l) => l.id !== targetLead.id && (l.dealStage === "Closed Won" || l.dealStage === "Closed Lost")
  );

  if (completedDeals.length === 0) {
    return {
      similarProjects: [],
      recommendedCaseStudies: [],
      pricingBenchmarks: null,
      analysisTime: Date.now() - startTime,
    };
  }

  let scoredProjects: SimilarProject[];

  if (options.useEmbeddings && aiClient.isConfigured()) {
    try {
      const targetSummary = createProjectSummary(targetLead);
      const targetEmbedding = await aiClient.embed(targetSummary);

      if (targetEmbedding) {
        const projectsWithScores: SimilarProject[] = [];

        for (const lead of completedDeals.slice(0, 50)) {
          const summary = createProjectSummary(lead);
          const embedding = await aiClient.embed(summary);

          if (embedding) {
            const similarity = cosineSimilarity(targetEmbedding.embedding, embedding.embedding);
            const matchReasons = getMatchReasons(targetLead, lead);

            projectsWithScores.push({
              leadId: lead.id,
              projectName: lead.projectName || "Untitled",
              clientName: lead.clientName,
              buildingType: lead.buildingType,
              sqft: lead.sqft ? Number(lead.sqft) : null,
              value: lead.value,
              outcome: lead.dealStage === "Closed Won" ? "won" : "lost",
              similarityScore: Math.round(similarity * 100),
              matchReasons,
            });
          }
        }

        scoredProjects = projectsWithScores
          .sort((a, b) => b.similarityScore - a.similarityScore)
          .slice(0, maxResults);
      } else {
        scoredProjects = fallbackMatching(targetLead, completedDeals, maxResults);
      }
    } catch (error: any) {
      log(`WARN: [Project Matcher] Embedding failed, using fallback: ${error?.message}`);
      scoredProjects = fallbackMatching(targetLead, completedDeals, maxResults);
    }
  } else {
    scoredProjects = fallbackMatching(targetLead, completedDeals, maxResults);
  }

  const wonProjects = completedDeals.filter((l) => l.dealStage === "Closed Won");
  const recommendedCaseStudies = scoredProjects
    .filter((p) => p.outcome === "won")
    .slice(0, 3)
    .map((p) => ({
      projectId: p.leadId,
      projectName: p.projectName,
      relevanceScore: p.similarityScore,
      reason: p.matchReasons[0] || "Similar project profile",
    }));

  const similarTypeProjects = wonProjects.filter(
    (l) => l.buildingType === targetLead.buildingType ||
      (targetLead.sqft && l.sqft && Math.abs(Number(l.sqft) - Number(targetLead.sqft)) < 20000)
  );

  const pricingBenchmarks = similarTypeProjects.length >= 3
    ? {
      averageValue: Math.round(
        similarTypeProjects.reduce((sum, l) => sum + Number(l.value || 0), 0) / similarTypeProjects.length
      ),
      minValue: Math.min(...similarTypeProjects.map((l) => Number(l.value || 0))),
      maxValue: Math.max(...similarTypeProjects.map((l) => Number(l.value || 0))),
      sampleSize: similarTypeProjects.length,
    }
    : null;

  log(`[Project Matcher] Found ${scoredProjects.length} similar projects, ${recommendedCaseStudies.length} case studies`);

  return {
    similarProjects: scoredProjects,
    recommendedCaseStudies,
    pricingBenchmarks,
    analysisTime: Date.now() - startTime,
  };
}

function fallbackMatching(target: Lead, candidates: Lead[], maxResults: number): SimilarProject[] {
  return candidates
    .map((lead) => {
      let score = 0;
      const matchReasons: string[] = [];

      if (lead.buildingType === target.buildingType && lead.buildingType) {
        score += 30;
        matchReasons.push(`Same building type: ${lead.buildingType}`);
      }

      if (target.sqft && lead.sqft) {
        const sqftDiff = Math.abs(Number(lead.sqft) - Number(target.sqft));
        const sqftScore = Math.max(0, 25 - (sqftDiff / 1000));
        score += sqftScore;
        if (sqftScore > 15) matchReasons.push("Similar size");
      }

      if (lead.scope === target.scope && lead.scope) {
        score += 20;
        matchReasons.push("Same scope");
      }

      if (lead.disciplines === target.disciplines) {
        score += 15;
        matchReasons.push("Same disciplines");
      }

      const targetState = target.projectAddress ? extractState(target.projectAddress) : null;
      const leadState = lead.projectAddress ? extractState(lead.projectAddress) : null;
      if (targetState && leadState && targetState === leadState) {
        score += 10;
        matchReasons.push("Same state");
      }

      return {
        leadId: lead.id,
        projectName: lead.projectName || "Untitled",
        clientName: lead.clientName,
        buildingType: lead.buildingType,
        sqft: lead.sqft ? Number(lead.sqft) : null,
        value: lead.value,
        outcome: lead.dealStage === "Closed Won" ? "won" : "lost",
        similarityScore: Math.min(100, Math.round(score)),
        matchReasons,
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, maxResults);
}

function getMatchReasons(target: Lead, candidate: Lead): string[] {
  const reasons: string[] = [];

  if (candidate.buildingType === target.buildingType && target.buildingType) {
    reasons.push(`Same building type: ${target.buildingType}`);
  }
  if (target.sqft && candidate.sqft) {
    const diff = Math.abs(Number(candidate.sqft) - Number(target.sqft));
    if (diff < 10000) reasons.push("Similar size");
  }
  if (candidate.scope === target.scope) {
    reasons.push("Same scope");
  }

  return reasons.length > 0 ? reasons : ["Similar project profile"];
}

export async function findMatchingCaseStudies(
  targetLead: Lead,
  maxResults: number = 3
): Promise<{ recommendations: CaseStudy[], pricingBenchmarks: any }> {
  // 1. Fetch all active case studies
  const allCaseStudies = await db.select().from(caseStudies).where(eq(caseStudies.isActive, true));

  if (allCaseStudies.length === 0) {
    return { recommendations: [], pricingBenchmarks: null };
  }

  // 2. Embed Target Lead
  let rankedStudies: { study: CaseStudy; score: number }[] = [];

  if (aiClient.isConfigured()) {
    try {
      const targetSummary = createProjectSummary(targetLead);
      const targetEmbedding = await aiClient.embed(targetSummary);

      if (targetEmbedding) {
        // Embed & Compare each Case Study
        // Note: In production, we should cache embeddings for Case Studies
        for (const study of allCaseStudies) {
          const studyContent = `${study.title}. ${study.blurb}. Tags: ${study.tags?.join(", ")}. Client: ${study.clientName}`;
          const studyEmbedding = await aiClient.embed(studyContent);

          if (studyEmbedding) {
            const score = cosineSimilarity(targetEmbedding.embedding, studyEmbedding.embedding);
            rankedStudies.push({ study, score });
          }
        }

        rankedStudies.sort((a, b) => b.score - a.score);
      }
    } catch (e) {
      log(`WARN: [Case Study Matcher] Embedding failed: ${(e as Error).message}`);
    }
  }

  // Fallback: Tag Matching if AI fails or returns no results
  if (rankedStudies.length === 0) {
    rankedStudies = allCaseStudies.map(study => {
      let score = 0;
      if (study.tags?.some(tag => targetLead.buildingType?.toLowerCase().includes(tag.toLowerCase()))) score += 30;
      if (study.tags?.some(tag => targetLead.scope?.toLowerCase().includes(tag.toLowerCase()))) score += 20;
      return { study, score };
    }).sort((a, b) => b.score - a.score);
  }

  const recommendations = rankedStudies.slice(0, maxResults).map(r => r.study);

  // Benchmarks (placeholder logic for now, as CaseStudy doesn't natively hold raw pricing data like Projects)
  const pricingBenchmarks = null;

  return { recommendations, pricingBenchmarks };
}
