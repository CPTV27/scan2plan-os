// server/services/ai/scopingAssistant.ts
/**
 * Feature 1: Intelligent Project Scoping Assistant
 * Analyzes project descriptions and suggests CPQ configuration
 */

import { aiClient } from "./aiClient";
import type { BuildingType, LODLevel, DisciplineOption } from "@shared/schema";
import { CPQ_BUILDING_TYPES, CPQ_RISK_FACTORS } from "@shared/schema";

export interface ProjectInput {
    description: string;
    address?: string;
    photos?: string[];
    existingData?: {
        buildingType?: string;
        sqft?: number;
        scope?: string;
    };
}

export interface ScopingSuggestion {
    field: string;
    value: any;
    confidence: number; // 0-100
    reasoning: string;
}

export interface ScopingAnalysis {
    suggestions: ScopingSuggestion[];
    buildingType: string;
    estimatedSqft: number;
    recommendedLOD: string;
    disciplines: string[];
    riskFactors: string[];
    timeline: string;
    overallConfidence: number;
}

export async function analyzeProjec(input: ProjectInput): Promise<ScopingAnalysis> {
    const systemPrompt = `You are an expert at scoping laser scanning and BIM projects for Scan2Plan.

Your job is to analyze project descriptions and suggest optimal CPQ configuration.

Available Building Types:
${Object.entries(CPQ_BUILDING_TYPES).map(([id, name]) => `${id}: ${name}`).join('\n')}

Available Risk Factors:
${CPQ_RISK_FACTORS.join(', ')}

LOD Levels:
- LOD 200: Schematic/conceptual (lowest detail)
- LOD 300: Detailed design (standard)
- LOD 350: Enhanced detail with MEP coordination
- LOD 400: Fabrication level (highest detail)

Disciplines:
- arch: Architecture
- struct: Structural
- mech: Mechanical
- elec: Electrical
- plumb: Plumbing
- site: Site/Civil

Guidelines:
1. Historic buildings, museums, theaters, hotels = LOD 350+ (HBIM requirements)
2. Commercial/Industrial standard = LOD 300
3. Residential standard = LOD 200-300
4. Estimate square footage conservatively if not provided
5. Identify risk factors: remote locations, fast-track schedules, occupied buildings, hazardous conditions
6. Timeline: 1-2 weeks per 10,000 sqft for LOD 300
7. Provide confidence scores (0-100) and reasoning for each suggestion

Return valid JSON only.`;

    const userPrompt = `Analyze this laser scanning project:

Description: ${input.description}
${input.address ? `Address: ${input.address}` : ''}
${input.existingData?.buildingType ? `Current building type: ${input.existingData.buildingType}` : ''}
${input.existingData?.sqft ? `Current sqft estimate: ${input.existingData.sqft}` : ''}

Provide scoping recommendations in this JSON format:
{
  "buildingType": "building type ID from 1-16",
  "buildingTypeName": "name of building type",
  "estimatedSqft": number,
  "recommendedLOD": "200" | "300" | "350",
  "lodReasoning": "why this LOD level",
  "disciplines": ["arch", "struct", etc.],
  "disciplineReasoning": "why these disciplines",
  "riskFactors": ["remote", "fastTrack", etc.],
  "riskReasoning": "identified risks and why",
  "timeline": "estimated timeline as string",
  "confidence": number 0-100,
  "suggestions": [
    {
      "field": "Building Type",
      "value": "building type name",
      "confidence": number,
      "reasoning": "explanation"
    },
    // ... more suggestions for sqft, LOD, disciplines, etc.
  ]
}`;

    try {
        const messages: any[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ];

        // Add photos if provided (vision capability)
        if (input.photos && input.photos.length > 0) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: "Here are photos of the project site:" },
                    ...input.photos.slice(0, 3).map((url) => ({
                        type: "image_url",
                        image_url: { url },
                    })),
                ],
            });
        }

        const response = await aiClient.chatJSON<{
            buildingType: string;
            buildingTypeName: string;
            estimatedSqft: number;
            recommendedLOD: string;
            lodReasoning: string;
            disciplines: string[];
            disciplineReasoning: string;
            riskFactors: string[];
            riskReasoning: string;
            timeline: string;
            confidence: number;
            suggestions: ScopingSuggestion[];
        }>({
            messages,
            model: input.photos ? "gpt-4o" : "gpt-4o-mini", // Use vision model if photos provided
            temperature: 0.2, // Lower temp for more consistent suggestions
        });

        return {
            suggestions: response.suggestions,
            buildingType: response.buildingType,
            estimatedSqft: response.estimatedSqft,
            recommendedLOD: response.recommendedLOD,
            disciplines: response.disciplines,
            riskFactors: response.riskFactors,
            timeline: response.timeline,
            overallConfidence: response.confidence,
        };
    } catch (error: any) {
        console.error("[ScopingAssistant] Error:", error);

        // Graceful fallback
        return {
            suggestions: [
                {
                    field: "Error",
                    value: "AI analysis unavailable",
                    confidence: 0,
                    reasoning: error.message,
                },
            ],
            buildingType: input.existingData?.buildingType || "4", // Default to Commercial
            estimatedSqft: input.existingData?.sqft || 10000,
            recommendedLOD: "300",
            disciplines: ["arch"],
            riskFactors: [],
            timeline: "4 weeks",
            overallConfidence: 0,
        };
    }
}

/**
 * Quick validation of scoping suggestions
 */
export function validateScopingSuggestions(analysis: ScopingAnalysis): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // Validate building type
    if (!CPQ_BUILDING_TYPES[analysis.buildingType as keyof typeof CPQ_BUILDING_TYPES]) {
        errors.push(`Invalid building type: ${analysis.buildingType}`);
    }

    // Validate sqft
    if (analysis.estimatedSqft <= 0 || analysis.estimatedSqft > 10000000) {
        errors.push(`Unrealistic square footage: ${analysis.estimatedSqft}`);
    }

    // Validate LOD
    if (!["200", "300", "350"].includes(analysis.recommendedLOD)) {
        errors.push(`Invalid LOD level: ${analysis.recommendedLOD}`);
    }

    // Validate risk factors
    const invalidRisks = analysis.riskFactors.filter(
        (r) => !CPQ_RISK_FACTORS.includes(r as any)
    );
    if (invalidRisks.length > 0) {
        errors.push(`Invalid risk factors: ${invalidRisks.join(", ")}`);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
