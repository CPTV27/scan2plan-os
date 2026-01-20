import { db } from '../db';
import { buyerPersonas, brandVoices, solutionMappings, negotiationPlaybook, intelligenceGeneratedContent } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

export interface TargetingContext {
  buyerCode: string;
  projectContext?: {
    projectName?: string;
    projectType?: string;
    squareFootage?: string;
    timeline?: string;
    specialConditions?: string[];
  };
  contentType: 'proposal' | 'negotiation_brief' | 'email' | 'ad_copy' | 'case_study' | 'social';
  specificRequest?: string;
}

export interface ProposalContext {
  buyerCode: string;
  projectName: string;
  projectType: string;
  squareFootage: string;
  timeline: string;
  specialConditions?: string[];
  scopeNotes?: string;
}

export interface NegotiationContext {
  buyerCode: string;
  objectionRaised: string;
  projectContext?: string;
  relationshipHistory?: string;
}

export interface MarketingContext {
  buyerCode: string;
  contentFormat: 'email_sequence' | 'ad_copy' | 'social_post' | 'case_study' | 'landing_page';
  campaignTheme?: string;
  specificAngle?: string;
}

function selectVoice(contentType: string): string {
  const voiceMap: Record<string, string> = {
    'proposal': 'Executive Signal Mapper',
    'negotiation_brief': 'Negotiation Strategist',
    'email': 'Executive Signal Mapper',
    'ad_copy': 'Campaign Architect',
    'case_study': 'Executive Signal Mapper',
    'social': 'Campaign Architect',
  };
  return voiceMap[contentType] || 'Executive Signal Mapper';
}

function buildTargetingPrompt(
  buyer: typeof buyerPersonas.$inferSelect,
  solutions: (typeof solutionMappings.$inferSelect)[],
  voice: typeof brandVoices.$inferSelect,
  context: TargetingContext
): string {
  return `
${voice.baseInstruction}

TARGET PERSONA: ${buyer.roleTitle} (${buyer.code})

THEIR WORLD:
- Primary Pain: ${buyer.primaryPain}
- Secondary Pain: ${buyer.secondaryPain || 'N/A'}
- Hidden Fear: ${buyer.hiddenFear || 'N/A'}
- What They Value: ${buyer.valueDriver}

COMMUNICATION CONSTRAINTS:
- Tone: ${buyer.tonePreference}
- Style: ${buyer.communicationStyle}
- Attention Span: ${buyer.attentionSpan}

VOCABULARY REQUIREMENTS:
- USE these technical terms: ${JSON.stringify(buyer.technicalTriggers)}
- USE these emotional triggers: ${JSON.stringify(buyer.emotionalTriggers)}
- AVOID these words: ${JSON.stringify(buyer.avoidWords)}

SOLUTION MAPPINGS (reference these, don't copy verbatim):
${solutions.map(s => `
- Pain: ${s.painPoint}
  Solution: ${s.solutionMechanism}
  Proof: ${s.proofPoint}
  Frame: ${s.argumentFrame}
`).join('\n')}

PROJECT CONTEXT:
${context.projectContext ? `
- Project Name: ${context.projectContext.projectName || 'Not specified'}
- Project Type: ${context.projectContext.projectType || 'Not specified'}
- Square Footage: ${context.projectContext.squareFootage || 'Not specified'}
- Timeline: ${context.projectContext.timeline || 'Not specified'}
- Special Conditions: ${context.projectContext.specialConditions?.join(', ') || 'None specified'}
` : 'No specific project context provided.'}

CONTENT REQUEST:
Type: ${context.contentType}
Specific Request: ${context.specificRequest || 'Generate appropriate content for this persona and content type.'}

PROHIBITIONS (from voice guidelines):
${voice.prohibitions ? JSON.stringify(voice.prohibitions) : 'None specified'}

Generate the requested content now. Be specific. Be targeted. Earn every word.
`;
}

export async function generateTargetedContent(context: TargetingContext): Promise<string> {
  const openai = getOpenAI();
  
  const buyerResults = await db.select()
    .from(buyerPersonas)
    .where(eq(buyerPersonas.code, context.buyerCode))
    .limit(1);
  
  if (!buyerResults.length) {
    throw new Error(`Persona ${context.buyerCode} not found`);
  }
  const buyer = buyerResults[0];

  const solutions = await db.select()
    .from(solutionMappings)
    .where(eq(solutionMappings.buyerCode, context.buyerCode));

  const voiceName = selectVoice(context.contentType);
  const voiceResults = await db.select()
    .from(brandVoices)
    .where(eq(brandVoices.name, voiceName))
    .limit(1);
  
  if (!voiceResults.length) {
    throw new Error(`Voice ${voiceName} not found`);
  }
  const voice = voiceResults[0];

  const systemPrompt = buildTargetingPrompt(buyer, solutions, voice, context);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context.specificRequest || 'Generate the content.' }
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const generatedText = response.choices[0]?.message?.content || '';

  await db.insert(intelligenceGeneratedContent).values({
    contentType: context.contentType,
    targetPersona: context.buyerCode,
    projectContext: context.projectContext,
    inputPrompt: context.specificRequest,
    generatedOutput: generatedText,
    voiceUsed: voiceName,
  });

  return generatedText;
}

export async function generateProposal(context: ProposalContext): Promise<string> {
  const result = await generateTargetedContent({
    buyerCode: context.buyerCode,
    contentType: 'proposal',
    projectContext: {
      projectName: context.projectName,
      projectType: context.projectType,
      squareFootage: context.squareFootage,
      timeline: context.timeline,
      specialConditions: context.specialConditions,
    },
    specificRequest: `
Generate a complete proposal for this project. Structure:

1. EXECUTIVE SUMMARY (2-3 sentences max - hook them immediately)
   - Name their specific pain
   - State what we deliver
   - Anchor the outcome

2. UNDERSTANDING (show we get their world)
   - Acknowledge the project challenge
   - Reference their specific concerns (based on persona)
   - Demonstrate technical credibility

3. APPROACH (methodology, not features)
   - How we work, not what equipment we use
   - Specific to their project type
   - Reference relevant proof points

4. DELIVERABLES (concrete, specific)
   - Exactly what they get
   - In what format
   - By when

5. INVESTMENT (never "pricing")
   - Frame as investment, not cost
   - Tie to value/risk mitigation
   - Include what's NOT included (scope boundaries)

Additional scope notes: ${context.scopeNotes || 'None'}
    `
  });
  
  return result;
}

export async function generateNegotiationBrief(context: NegotiationContext): Promise<string> {
  const plays = await db.select()
    .from(negotiationPlaybook)
    .where(eq(negotiationPlaybook.buyerCode, context.buyerCode));
  
  const relevantPlays = plays.filter(p => 
    context.objectionRaised.toLowerCase().includes(p.objectionPattern.toLowerCase())
  );

  const result = await generateTargetedContent({
    buyerCode: context.buyerCode,
    contentType: 'negotiation_brief',
    specificRequest: `
Generate a negotiation response brief.

OBJECTION RAISED: "${context.objectionRaised}"

PROJECT CONTEXT: ${context.projectContext || 'Not specified'}

RELATIONSHIP HISTORY: ${context.relationshipHistory || 'New relationship'}

PLAYBOOK REFERENCE (if relevant):
${relevantPlays.map(p => `
- Pattern: ${p.objectionPattern}
- Underlying Concern: ${p.underlyingConcern}
- Strategy: ${p.responseStrategy}
- Reframe Language: ${p.reframeLanguage}
- Walk Away If: ${p.walkAwaySignal}
`).join('\n')}

Provide:
1. DIAGNOSIS: What's really going on (1-2 sentences)
2. REFRAME: Exact language to pivot the conversation
3. ALTERNATIVES: 2-3 options to offer (not discounts)
4. WALK AWAY SIGNAL: What would indicate this isn't our client
5. NEXT STEP: Specific action to move forward
    `
  });
  
  return result;
}

export async function generateMarketingContent(context: MarketingContext): Promise<string> {
  const formatInstructions: Record<string, string> = {
    'email_sequence': `
Generate a 3-email sequence:
EMAIL 1 - Problem Awareness (Day 0)
- Subject line that names their pain
- 150 words max
- One clear next step

EMAIL 2 - Solution Education (Day 3)
- Subject line that hints at solution
- 200 words max
- Include one proof point
- Soft CTA

EMAIL 3 - Decision Catalyst (Day 7)
- Subject line with urgency (not fake urgency)
- 150 words max
- Direct CTA
- P.S. line with social proof
    `,
    'ad_copy': `
Generate ad copy variants:
1. HEADLINE (max 10 words) - name the pain
2. BODY (max 30 words) - bridge to solution
3. CTA (max 5 words) - clear action

Provide 3 variants with different angles.
    `,
    'social_post': `
Generate LinkedIn post:
- Hook in first line (pattern interrupt)
- 150 words max
- End with question or clear CTA
- No hashtag spam (max 3)
    `,
    'case_study': `
Generate case study structure:
1. HEADLINE: Result + Context (e.g., "73% Fewer RFIs: Hospital Renovation")
2. THE SITUATION: Client pain (3-4 sentences)
3. THE CHALLENGE: Why this was hard
4. THE APPROACH: What we did differently
5. THE OUTCOME: Specific results with numbers
6. CLIENT QUOTE: What they'd say (we'll verify/replace)
    `,
    'landing_page': `
Generate landing page copy:
1. HERO: Headline + subhead + CTA
2. PROBLEM SECTION: 3 pain points with headers
3. SOLUTION SECTION: How we're different (3 points)
4. PROOF SECTION: Stats or testimonial placeholders
5. CTA SECTION: Final push
    `
  };

  const result = await generateTargetedContent({
    buyerCode: context.buyerCode,
    contentType: context.contentFormat === 'email_sequence' ? 'email' : 
                 context.contentFormat === 'ad_copy' ? 'ad_copy' :
                 context.contentFormat === 'social_post' ? 'social' :
                 context.contentFormat === 'case_study' ? 'case_study' : 'ad_copy',
    specificRequest: `
CAMPAIGN THEME: ${context.campaignTheme || 'General awareness'}
SPECIFIC ANGLE: ${context.specificAngle || 'Core value proposition'}

${formatInstructions[context.contentFormat]}
    `
  });
  
  return result;
}

export async function getAllPersonas() {
  return db.select().from(buyerPersonas).where(eq(buyerPersonas.isActive, true));
}

export async function getPersonaByCode(code: string) {
  const results = await db.select()
    .from(buyerPersonas)
    .where(eq(buyerPersonas.code, code))
    .limit(1);
  return results[0] || null;
}

export async function getAllVoices() {
  return db.select().from(brandVoices).where(eq(brandVoices.isActive, true));
}

export async function getSolutionMappingsForPersona(buyerCode: string) {
  return db.select()
    .from(solutionMappings)
    .where(eq(solutionMappings.buyerCode, buyerCode));
}

export async function getNegotiationPlaysForPersona(buyerCode: string) {
  return db.select()
    .from(negotiationPlaybook)
    .where(eq(negotiationPlaybook.buyerCode, buyerCode));
}

export async function updateContentFeedback(contentId: number, qualityScore: number, wasUsed: boolean) {
  await db.update(intelligenceGeneratedContent)
    .set({ qualityScore, wasUsed })
    .where(eq(intelligenceGeneratedContent.id, contentId));
}
