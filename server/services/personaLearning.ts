import OpenAI from 'openai';
import { db } from '../db';
import { buyerPersonas, personaInsights, leads } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from '../lib/logger';

let openaiClient: OpenAI | null = null;

export function isAIConfigured(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export type DealOutcome = 'won' | 'lost' | 'stalled';

export interface DealContext {
  leadId: number;
  personaCode: string;
  buyingMode?: string;
  outcome: DealOutcome;
  dealValue?: number;
  cycleLengthDays?: number;
  stageAtClose: string;
  projectType?: string;
  clientIndustry?: string;
  notes?: string;
}

interface PersonaInsightResult {
  tacticalLessons: string[];
  languageWins: string[];
  languageFailures: string[];
  refinementSuggestions: string[];
  confidenceScore: number;
}

export async function analyzeOutcome(context: DealContext): Promise<PersonaInsightResult | null> {
  try {
    const [persona] = await db
      .select()
      .from(buyerPersonas)
      .where(eq(buyerPersonas.code, context.personaCode));

    if (!persona) {
      log(`Persona not found: ${context.personaCode}`, "persona-learning");
      return null;
    }

    // Always record the basic insight, even without AI analysis
    const basicInsight = {
      personaId: persona.id,
      leadId: context.leadId,
      buyingModeUsed: context.buyingMode,
      outcome: context.outcome,
      dealValue: context.dealValue?.toString(),
      cycleLengthDays: context.cycleLengthDays,
      strategyNotes: context.notes || `Stage: ${context.stageAtClose}`,
    };

    // If AI is not configured, just record the basic outcome
    if (!isAIConfigured()) {
      await db.insert(personaInsights).values(basicInsight);
      await recalculatePersonaStats(persona.id);
      log(`Recorded basic insight for lead ${context.leadId} (AI not configured)`, "persona-learning");
      return {
        tacticalLessons: [],
        languageWins: [],
        languageFailures: [],
        refinementSuggestions: [],
        confidenceScore: 0,
      };
    }

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, context.leadId));

    const prompt = buildAnalysisPrompt(persona, lead, context);
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a sales intelligence analyst for Scan2Plan, a laser scanning and BIM services company. 
Your job is to analyze deal outcomes and extract actionable lessons to improve future sales approaches for specific buyer personas.
Always respond with valid JSON matching the requested schema.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      // Record basic insight without AI analysis
      await db.insert(personaInsights).values(basicInsight);
      await recalculatePersonaStats(persona.id);
      log(`Recorded basic insight for lead ${context.leadId} (AI returned empty)`, "persona-learning");
      return null;
    }

    let result: PersonaInsightResult;
    try {
      result = JSON.parse(content) as PersonaInsightResult;
      // Validate expected fields exist
      if (!Array.isArray(result.tacticalLessons)) result.tacticalLessons = [];
      if (!Array.isArray(result.languageWins)) result.languageWins = [];
      if (!Array.isArray(result.languageFailures)) result.languageFailures = [];
      if (!Array.isArray(result.refinementSuggestions)) result.refinementSuggestions = [];
      if (typeof result.confidenceScore !== 'number') result.confidenceScore = 0.5;
    } catch (parseError) {
      log(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`, "persona-learning");
      // Still record basic insight
      await db.insert(personaInsights).values(basicInsight);
      await recalculatePersonaStats(persona.id);
      return null;
    }
    
    await db.insert(personaInsights).values({
      personaId: persona.id,
      leadId: context.leadId,
      buyingModeUsed: context.buyingMode,
      outcome: context.outcome,
      dealValue: context.dealValue?.toString(),
      cycleLengthDays: context.cycleLengthDays,
      strategyNotes: context.notes || `Stage: ${context.stageAtClose}`,
      aiAnalysis: JSON.stringify({
        tacticalLessons: result.tacticalLessons,
        languageWins: result.languageWins,
        languageFailures: result.languageFailures,
        confidenceScore: result.confidenceScore,
      }),
      suggestedRefinements: {
        languageToAdd: result.languageWins,
        languageToAvoid: result.languageFailures,
        otherNotes: result.refinementSuggestions.join('; '),
      },
      lossReason: context.outcome === 'lost' ? result.refinementSuggestions[0] : undefined,
    });

    await recalculatePersonaStats(persona.id);

    return result;
  } catch (error) {
    console.error('Error analyzing deal outcome:', error);
    return null;
  }
}

function buildAnalysisPrompt(persona: any, lead: any, context: DealContext): string {
  const outcomeLabel = context.outcome === 'won' ? 'WIN' : context.outcome === 'lost' ? 'LOSS' : 'STALLED';
  
  return `Analyze this ${outcomeLabel} deal for the "${persona.name}" buyer persona and extract sales intelligence.

PERSONA PROFILE:
- Code: ${persona.code}
- Title: ${persona.name}
- Primary Pain: ${persona.primaryPain}
- Value Driver: ${persona.valueDriver}
- Value Hook: ${persona.valueHook}
- Risk Level: ${persona.defaultRiskLevel}
- Veto Power: ${persona.vetoPower}
- Recommended Language: ${JSON.stringify(persona.exactLanguage || [])}
- Words to Avoid: ${JSON.stringify(persona.avoidWords || [])}

DEAL CONTEXT:
- Outcome: ${context.outcome.toUpperCase()}
- Buying Mode: ${context.buyingMode || 'Unknown'}
- Deal Value: ${context.dealValue ? `$${context.dealValue.toLocaleString()}` : 'Not specified'}
- Sales Cycle: ${context.cycleLengthDays ? `${context.cycleLengthDays} days` : 'Not specified'}
- Stage at Close: ${context.stageAtClose}
- Project Type: ${context.projectType || 'Unknown'}
${context.notes ? `- Notes: ${context.notes}` : ''}

${lead ? `
CLIENT INFO:
- Company: ${lead.clientName}
- Project: ${lead.projectName || 'N/A'}
- Industry Context: ${context.clientIndustry || lead.buildingType || 'Unknown'}
` : ''}

Based on this ${outcomeLabel} outcome, provide analysis in this JSON format:
{
  "tacticalLessons": ["3-5 specific, actionable lessons learned from this deal"],
  "languageWins": ["Phrases or approaches that likely resonated (even in losses, identify what worked)"],
  "languageFailures": ["Phrases or approaches that likely didn't work or should be avoided"],
  "refinementSuggestions": ["1-3 specific recommendations to improve the persona strategy"],
  "confidenceScore": 0.0 to 1.0 based on how confident you are in these insights given the available data
}

${context.outcome === 'won' ? 
  'Focus on what worked and should be replicated.' : 
  context.outcome === 'lost' ?
  'Focus on what went wrong and how to prevent similar losses.' :
  'Focus on what caused the deal to stall and how to maintain momentum.'
}`;
}

async function recalculatePersonaStats(personaId: number) {
  try {
    const insights = await db
      .select()
      .from(personaInsights)
      .where(eq(personaInsights.personaId, personaId));

    if (insights.length === 0) return;

    const totalDeals = insights.length;
    const wonDeals = insights.filter(i => i.outcome === 'won');
    const winRate = (wonDeals.length / totalDeals) * 100;
    
    const dealsWithValue = wonDeals.filter(i => i.dealValue);
    const avgDealSize = dealsWithValue.length > 0
      ? dealsWithValue.reduce((sum, i) => sum + Number(i.dealValue || 0), 0) / dealsWithValue.length
      : null;
    
    const dealsWithCycle = wonDeals.filter(i => i.cycleLengthDays);
    const avgSalesCycleDays = dealsWithCycle.length > 0
      ? Math.round(dealsWithCycle.reduce((sum, i) => sum + (i.cycleLengthDays || 0), 0) / dealsWithCycle.length)
      : null;

    await db
      .update(buyerPersonas)
      .set({
        totalDeals,
        winRate: winRate.toFixed(2),
        avgDealSize: avgDealSize?.toFixed(2) || null,
        avgSalesCycleDays,
        updatedAt: new Date(),
      })
      .where(eq(buyerPersonas.id, personaId));
  } catch (error) {
    console.error('Error recalculating persona stats:', error);
  }
}

export async function suggestPersonaForLead(leadData: {
  clientName: string;
  projectName?: string;
  projectType?: string;
  contactName?: string;
  contactTitle?: string;
  notes?: string;
}): Promise<{ suggestedCode: string; confidence: number; reasoning: string } | null> {
  try {
    const personas = await db
      .select({
        code: buyerPersonas.code,
        name: buyerPersonas.name,
        roleVariants: buyerPersonas.roleVariants,
        primaryPain: buyerPersonas.primaryPain,
        valueDriver: buyerPersonas.valueDriver,
      })
      .from(buyerPersonas)
      .where(eq(buyerPersonas.isActive, true));

    const prompt = `Given the following lead information, suggest the most appropriate buyer persona from our list.

LEAD INFO:
- Company: ${leadData.clientName}
- Project: ${leadData.projectName || 'N/A'}
- Project Type: ${leadData.projectType || 'N/A'}
- Contact Name: ${leadData.contactName || 'N/A'}
- Contact Title: ${leadData.contactTitle || 'N/A'}
${leadData.notes ? `- Notes: ${leadData.notes}` : ''}

AVAILABLE PERSONAS:
${personas.map(p => `
${p.code}: ${p.name}
- Role Variants: ${JSON.stringify(p.roleVariants || [])}
- Primary Pain: ${p.primaryPain}
- Value Driver: ${p.valueDriver}
`).join('\n')}

Respond with JSON:
{
  "suggestedCode": "BP1-BP7 code",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why this persona fits"
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a sales intelligence system for Scan2Plan, matching leads to buyer personas. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error('Error suggesting persona:', error);
    return null;
  }
}

export async function getBuyingModeGuidance(personaCode: string, mode: string): Promise<{
  strategy: string;
  keyPoints: string[];
  riskFactors: string[];
  closeAccelerators: string[];
} | null> {
  try {
    const [persona] = await db
      .select()
      .from(buyerPersonas)
      .where(eq(buyerPersonas.code, personaCode));

    if (!persona) return null;

    const strategies = persona.buyingModeStrategies as { firefighter?: string; optimizer?: string; innovator?: string } | null;
    const modeStrategy = strategies?.[mode as keyof typeof strategies] || '';

    const prompt = `Generate tactical sales guidance for the "${persona.name}" persona in "${mode}" buying mode.

PERSONA:
- Name: ${persona.name}
- Primary Pain: ${persona.primaryPain}
- Value Driver: ${persona.valueDriver}
- Value Hook: ${persona.valueHook}
- Risk Level: ${persona.defaultRiskLevel}
- Mode Strategy: ${modeStrategy}

BUYING MODE: ${mode.toUpperCase()}
${mode === 'firefighter' ? '- Urgent need, fast decision required, crisis mode' :
  mode === 'optimizer' ? '- Seeking value optimization, cost-conscious, efficiency-focused' :
  '- Future-oriented, innovation-seeking, willing to invest in new approaches'}

Provide tactical guidance in JSON:
{
  "strategy": "2-3 sentence overall approach",
  "keyPoints": ["3-4 key talking points"],
  "riskFactors": ["2-3 risks to watch for"],
  "closeAccelerators": ["2-3 tactics to speed up the close"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a sales coach for Scan2Plan, providing tactical guidance for laser scanning and BIM services sales. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error('Error getting buying mode guidance:', error);
    return null;
  }
}
