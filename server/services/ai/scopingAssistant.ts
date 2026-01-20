import { aiClient } from "./aiClient";
import { log } from "../../lib/logger";

export interface ScopingSuggestion {
  field: string;
  value: string | number | string[];
  reasoning: string;
  confidence: number;
}

export interface ScopingResult {
  suggestions: ScopingSuggestion[];
  overallConfidence: number;
  analysisTime: number;
  error?: string;
}

const SCOPING_SYSTEM_PROMPT = `You are an expert laser scanning and BIM project estimator for Scan2Plan, a company that provides 3D laser scanning and Building Information Modeling services.

Your task is to analyze project details and provide intelligent suggestions for:
1. Building type (office, industrial, retail, healthcare, education, residential, hospitality, mixed-use, religious, warehouse, historic, data center, government, landscape)
2. Estimated square footage (be realistic based on building type and description)
3. Recommended Level of Development (LOD 200, 300, or 350) with justification
4. Required disciplines (architecture, MEP/F, structure, site)
5. Scope (full interior+exterior, interior only, exterior only, roof & facades)
6. Risk factors to consider (access issues, historic preservation, active construction, etc.)
7. Estimated project timeline

Provide confidence scores (0-100) for each suggestion based on available information.
When information is limited, use industry standards and conservative estimates.

## EXAMPLES

Example 1:
Input: "Downtown office building renovation, 4 floors, mechanical upgrades needed, 123 Main St"
Output:
- buildingType: "office" (90%) - Multi-story downtown location indicates commercial office
- estimatedSqft: 40000 (75%) - 4 floors × ~10,000 sqft average floor plate for downtown office
- recommendedLOD: "300" (85%) - Mechanical upgrades require accurate MEP documentation
- disciplines: ["architecture", "mepf"] (90%) - Renovation with MEP focus requires both
- scope: "full" (80%) - Renovation typically needs complete documentation
- risks: ["active operations", "limited access during business hours"] (70%)
- timeline: "3-4 weeks" (65%) - Medium complexity with MEP focus

Example 2:
Input: "New warehouse scan for as-built, ABC Manufacturing, Greenfield Industrial Park"
Output:
- buildingType: "warehouse" (95%) - Industrial park manufacturing facility
- estimatedSqft: 75000 (60%) - Industrial park warehouses typically 50k-100k sqft
- recommendedLOD: "200" (80%) - As-built documentation often needs basic LOD
- disciplines: ["architecture", "structure"] (85%) - Warehouse focus on shell and structure
- scope: "full" (75%) - As-built typically captures complete building
- risks: ["high ceilings", "active manufacturing", "heavy equipment"] (80%)
- timeline: "2-3 weeks" (70%) - Large open space, simpler geometry`;

export async function analyzeProjectScope(params: {
  description?: string;
  address?: string;
  clientName?: string;
  projectName?: string;
  notes?: string;
}): Promise<ScopingResult> {
  const startTime = Date.now();

  if (!aiClient.isConfigured()) {
    return {
      suggestions: [],
      overallConfidence: 0,
      analysisTime: 0,
      error: "AI service not configured",
    };
  }

  const { description, address, clientName, projectName, notes } = params;

  const contextParts: string[] = [];
  if (projectName) contextParts.push(`Project: ${projectName}`);
  if (clientName) contextParts.push(`Client: ${clientName}`);
  if (address) contextParts.push(`Address: ${address}`);
  if (description) contextParts.push(`Description: ${description}`);
  if (notes) contextParts.push(`Notes: ${notes}`);

  if (contextParts.length === 0) {
    return {
      suggestions: [],
      overallConfidence: 0,
      analysisTime: Date.now() - startTime,
      error: "No project information provided",
    };
  }

  try {
    const result = await aiClient.chatJSON<{
      buildingType: { value: string; confidence: number; reasoning: string };
      estimatedSqft: { value: number; confidence: number; reasoning: string };
      recommendedLOD: { value: string; confidence: number; reasoning: string };
      disciplines: { value: string[]; confidence: number; reasoning: string };
      scope: { value: string; confidence: number; reasoning: string };
      risks: { value: string[]; confidence: number; reasoning: string };
      timeline: { value: string; confidence: number; reasoning: string };
    }>({
      messages: [
        { role: "system", content: SCOPING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this project and provide scoping suggestions in JSON format:

${contextParts.join("\n")}

Return JSON with this structure:
{
  "buildingType": { "value": "office", "confidence": 85, "reasoning": "..." },
  "estimatedSqft": { "value": 25000, "confidence": 70, "reasoning": "..." },
  "recommendedLOD": { "value": "300", "confidence": 80, "reasoning": "..." },
  "disciplines": { "value": ["architecture", "mepf"], "confidence": 75, "reasoning": "..." },
  "scope": { "value": "full", "confidence": 90, "reasoning": "..." },
  "risks": { "value": ["historic facade", "limited access"], "confidence": 65, "reasoning": "..." },
  "timeline": { "value": "2-3 weeks", "confidence": 60, "reasoning": "..." }
}`,
        },
      ],
      temperature: 0.3,
    });

    if (!result) {
      return {
        suggestions: [],
        overallConfidence: 0,
        analysisTime: Date.now() - startTime,
        error: "AI analysis returned no results",
      };
    }

    const suggestions: ScopingSuggestion[] = [
      {
        field: "buildingType",
        value: result.buildingType.value,
        confidence: result.buildingType.confidence,
        reasoning: result.buildingType.reasoning,
      },
      {
        field: "estimatedSqft",
        value: result.estimatedSqft.value,
        confidence: result.estimatedSqft.confidence,
        reasoning: result.estimatedSqft.reasoning,
      },
      {
        field: "recommendedLOD",
        value: result.recommendedLOD.value,
        confidence: result.recommendedLOD.confidence,
        reasoning: result.recommendedLOD.reasoning,
      },
      {
        field: "disciplines",
        value: result.disciplines.value,
        confidence: result.disciplines.confidence,
        reasoning: result.disciplines.reasoning,
      },
      {
        field: "scope",
        value: result.scope.value,
        confidence: result.scope.confidence,
        reasoning: result.scope.reasoning,
      },
      {
        field: "risks",
        value: result.risks.value,
        confidence: result.risks.confidence,
        reasoning: result.risks.reasoning,
      },
      {
        field: "timeline",
        value: result.timeline.value,
        confidence: result.timeline.confidence,
        reasoning: result.timeline.reasoning,
      },
    ];

    const overallConfidence = Math.round(
      suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
    );

    log(`[AI Scoping] Analysis complete: ${suggestions.length} suggestions, ${overallConfidence}% confidence`);

    return {
      suggestions,
      overallConfidence,
      analysisTime: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`ERROR: [AI Scoping] Analysis failed: ${error?.message || error}`);
    return {
      suggestions: [],
      overallConfidence: 0,
      analysisTime: Date.now() - startTime,
      error: error?.message || "Analysis failed",
    };
  }
}
