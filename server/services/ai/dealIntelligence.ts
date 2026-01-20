import { aiClient } from "./aiClient";
import { log } from "../../lib/logger";
import type { Lead } from "@shared/schema";

export interface DealRisk {
  factor: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface PricingStrategy {
  recommendation: string;
  justification: string;
  competitivePosition: string;
}

export interface SimilarDeal {
  projectType: string;
  value: number;
  outcome: "won" | "lost";
  closurePattern: string;
  relevanceScore: number;
}

export interface DealIntelligenceResult {
  winProbability: number;
  nextActions: string[];
  risks: DealRisk[];
  pricingStrategy: PricingStrategy;
  similarDeals: SimilarDeal[];
  expectedTimeline: string;
  analysisTime: number;
  error?: string;
}

const DEAL_INTELLIGENCE_PROMPT = `You are a sales intelligence expert for Scan2Plan, a laser scanning and BIM services company.

Analyze the provided lead/deal information and provide:
1. Win probability (0-100%) based on deal characteristics
2. Recommended next actions (prioritized list of 3-5 actions)
3. Risk factors that could derail the deal
4. Pricing strategy recommendations
5. Expected timeline to close

Consider factors like:
- Deal stage and progression speed
- Client responsiveness (last contact date)
- Budget alignment and deal value
- Industry/vertical fit
- Competition signals
- Decision-maker engagement`;

export async function analyzeDeal(lead: Lead, historicalDeals?: Lead[]): Promise<DealIntelligenceResult> {
  const startTime = Date.now();

  if (!aiClient.isConfigured()) {
    return {
      winProbability: lead.probability || 20,
      nextActions: ["Follow up with client", "Schedule discovery call"],
      risks: [],
      pricingStrategy: {
        recommendation: "Standard pricing",
        justification: "No AI analysis available",
        competitivePosition: "Unknown",
      },
      similarDeals: [],
      expectedTimeline: "4-6 weeks",
      analysisTime: 0,
      error: "AI service not configured",
    };
  }

  try {
    const dealContext = {
      projectName: lead.projectName,
      clientName: lead.clientName,
      value: lead.value,
      dealStage: lead.dealStage,
      probability: lead.probability,
      lastContactDate: lead.lastContactDate,
      notes: lead.notes,
      buildingType: lead.buildingType,
      sqft: lead.sqft ? Number(lead.sqft) : null,
      scope: lead.scope,
    };

    const historicalContext = historicalDeals
      ? historicalDeals.slice(0, 10).map((d) => ({
          dealStage: d.dealStage,
          value: d.value,
          buildingType: d.buildingType,
          sqft: d.sqft,
        }))
      : [];

    const result = await aiClient.chatJSON<{
      winProbability: number;
      nextActions: string[];
      risks: { factor: string; severity: string; mitigation: string }[];
      pricingStrategy: { recommendation: string; justification: string; competitivePosition: string };
      similarDeals: { projectType: string; value: number; outcome: string; closurePattern: string; relevanceScore: number }[];
      expectedTimeline: string;
    }>({
      messages: [
        { role: "system", content: DEAL_INTELLIGENCE_PROMPT },
        {
          role: "user",
          content: `Analyze this deal and provide intelligence in JSON format:

Current Deal:
${JSON.stringify(dealContext, null, 2)}

${historicalContext.length > 0 ? `Historical Deals for Context:\n${JSON.stringify(historicalContext, null, 2)}` : ""}

Return JSON with this structure:
{
  "winProbability": 65,
  "nextActions": ["Send proposal", "Schedule site visit", "Connect with decision maker"],
  "risks": [{ "factor": "Long silence since last contact", "severity": "medium", "mitigation": "Send follow-up email with value proposition" }],
  "pricingStrategy": { "recommendation": "Premium pricing justified", "justification": "High-complexity project with specialized requirements", "competitivePosition": "Strong" },
  "similarDeals": [{ "projectType": "Office renovation", "value": 15000, "outcome": "won", "closurePattern": "Closed after site visit", "relevanceScore": 85 }],
  "expectedTimeline": "3-4 weeks"
}`,
        },
      ],
      temperature: 0.4,
    });

    if (!result) {
      return {
        winProbability: lead.probability || 20,
        nextActions: ["Follow up with client"],
        risks: [],
        pricingStrategy: {
          recommendation: "Standard pricing",
          justification: "Analysis unavailable",
          competitivePosition: "Unknown",
        },
        similarDeals: [],
        expectedTimeline: "Unknown",
        analysisTime: Date.now() - startTime,
        error: "AI returned no results",
      };
    }

    log(`[AI Deal Intelligence] Analysis complete: ${result.winProbability}% win probability`);

    return {
      winProbability: result.winProbability,
      nextActions: result.nextActions,
      risks: result.risks.map((r) => ({
        factor: r.factor,
        severity: r.severity as "low" | "medium" | "high",
        mitigation: r.mitigation,
      })),
      pricingStrategy: result.pricingStrategy,
      similarDeals: result.similarDeals.map((d) => ({
        ...d,
        outcome: d.outcome as "won" | "lost",
      })),
      expectedTimeline: result.expectedTimeline,
      analysisTime: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`ERROR: [AI Deal Intelligence] Analysis failed: ${error?.message || error}`);
    return {
      winProbability: lead.probability || 20,
      nextActions: ["Follow up with client"],
      risks: [],
      pricingStrategy: {
        recommendation: "Standard pricing",
        justification: "Analysis failed",
        competitivePosition: "Unknown",
      },
      similarDeals: [],
      expectedTimeline: "Unknown",
      analysisTime: Date.now() - startTime,
      error: error?.message || "Analysis failed",
    };
  }
}
