import { db } from "../db";
import { brandPersonas, governanceRedLines, standardDefinitions, generationAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

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

export type BuyerMode = "A_Principal" | "B_OwnerDev" | "C_Unknown";
export type Situation = "1_Pilot" | "2_NoProjectMeeting" | "3_PriorBadExperience";
export type PrimaryPain = "Rework_RFI" | "ScheduleVolatility" | "Inconsistency" | "Terms_Risk";
export type AuthorMode = "Twain" | "Fuller";

export interface BrandContext {
  buyerMode: BuyerMode;
  situation: Situation;
  primaryPain: PrimaryPain[];
  pillarLimit: number;
}

export interface ViolationResult {
  category: string;
  rule: string;
  correction: string;
}

export interface SelfCheckResult {
  score: number;
  violations: ViolationResult[];
  passed: boolean;
}

export interface GenerationResult {
  finalOutput: string;
  initialDraft: string;
  violationCount: number;
  violationsFound: ViolationResult[];
  rewriteAttempts: number;
  processingTimeMs: number;
}

export function constructContext(buyerMode: BuyerMode, situation: Situation): BrandContext {
  let primaryPain: PrimaryPain[] = [];
  
  if (buyerMode === "A_Principal") {
    primaryPain = ["Inconsistency", "Rework_RFI"];
  } else if (buyerMode === "B_OwnerDev") {
    primaryPain = ["ScheduleVolatility", "Terms_Risk"];
  } else {
    primaryPain = ["Rework_RFI", "ScheduleVolatility"];
  }

  if (situation === "3_PriorBadExperience") {
    if (!primaryPain.includes("Rework_RFI")) {
      primaryPain.unshift("Rework_RFI");
    }
  }

  return {
    buyerMode,
    situation,
    primaryPain,
    pillarLimit: 2,
  };
}

export function getDualModeOpener(buyerMode: BuyerMode): string {
  switch (buyerMode) {
    case "A_Principal":
      return "This is about firm-level standardization and reducing delivery variance across projects.";
    case "B_OwnerDev":
      return "This is about defensibility: reducing downstream variance that becomes schedule, cost, and escalation risk.";
    default:
      return "This is about firm-level standardization and reducing delivery variance across projects.";
  }
}

export function getPillarsForPain(pain: PrimaryPain[]): string[] {
  const pillars: string[] = [];
  
  if (pain.includes("Rework_RFI")) {
    pillars.push("P1: We treat existing conditions as a defined, reviewable input—so downstream coordination isn't built on assumptions.");
  }
  if (pain.includes("ScheduleVolatility")) {
    pillars.push("P3: Timeline only matters when it's scoped and repeatable; speed without control becomes rework.");
  }
  if (pain.includes("Inconsistency")) {
    pillars.push("P2: Consistency is the product: defined standards, QA governance, and stable revision handling across projects.");
  }
  if (pain.includes("Terms_Risk")) {
    pillars.push("P5: Trust comes from assurances: explicit definitions, QA gates, and change control—not adjectives.");
  }

  return pillars.slice(0, 2);
}

const HYPE_PATTERNS = [
  /\b(amazing|revolutionary|incredible|unbelievable|game-?changing|best-in-class|world-class|cutting-?edge|state-of-the-art)\b/gi,
  /\b(guaranteed? perfect|always right the first time|zero defects|flawless)\b/gi,
];

const OUTCOME_PATTERNS = [
  /\b(\d+%?\s*(reduction|improvement|savings?|faster|better))\b/gi,
  /\b(weeks? saved|days? saved|hours? saved)\b/gi,
  /\b(zero rework|no rework|eliminate RFIs|zero RFIs)\b/gi,
];

const COMPARISON_PATTERNS = [
  /\b(best|only company|better than|unlike others|competitors?|class of our own|only ones?)\b/gi,
  /\b(industry-leading|market-leading|unmatched|unparalleled)\b/gi,
];

const GUARANTEE_PATTERNS = [
  /\bguarantee[sd]?\b/gi,
];

export async function runSelfCheckV2(draftText: string): Promise<SelfCheckResult> {
  const violations: ViolationResult[] = [];
  
  const redLines = await db.select().from(governanceRedLines).where(eq(governanceRedLines.active, true));
  
  for (const pattern of HYPE_PATTERNS) {
    const matches = draftText.match(pattern);
    if (matches) {
      violations.push({
        category: "V1-Hype",
        rule: `Hype language detected: "${matches.join('", "')}"`,
        correction: "Remove adjectives and replace with mechanism-based language",
      });
    }
  }

  for (const pattern of OUTCOME_PATTERNS) {
    const matches = draftText.match(pattern);
    if (matches) {
      violations.push({
        category: "V1-Unsupported",
        rule: `Quantified outcomes without documented case: "${matches.join('", "')}"`,
        correction: "Remove specific numbers/outcomes or replace with mechanism language",
      });
    }
  }

  for (const pattern of COMPARISON_PATTERNS) {
    const matches = draftText.match(pattern);
    if (matches) {
      violations.push({
        category: "V2-Comparison",
        rule: `Competitor comparison or exclusivity claim: "${matches.join('", "')}"`,
        correction: "Convert to mechanism + boundary language, remove comparisons",
      });
    }
  }

  for (const pattern of GUARANTEE_PATTERNS) {
    const matches = draftText.match(pattern);
    if (matches) {
      const definitions = await db.select().from(standardDefinitions).where(eq(standardDefinitions.active, true));
      const allowedGuarantees = definitions
        .filter(d => d.guaranteeText !== null && d.guaranteeText !== undefined && d.guaranteeText.trim() !== "")
        .map(d => (d.guaranteeText as string).toLowerCase());
      
      const draftLower = draftText.toLowerCase();
      const hasApprovedGuarantee = allowedGuarantees.some(g => draftLower.includes(g));
      
      if (!hasApprovedGuarantee) {
        violations.push({
          category: "V3-Guarantee",
          rule: `Guarantee used outside of approved standard definitions`,
          correction: "Reframe as standards/process/change-control language or use exact canonical guarantee text",
        });
      }
    }
  }

  const score = Math.max(0, 5 - violations.length);
  
  return {
    score,
    violations,
    passed: violations.length === 0,
  };
}

export async function applyMasterAuthor(draftText: string, mode: AuthorMode): Promise<string> {
  if (mode === "Twain") {
    const sentences = draftText.split(/(?<=[.!?])\s+/);
    const shortened = sentences.map(s => {
      const words = s.split(/\s+/);
      const filtered = words.filter(w => {
        const adjectives = /\b(very|really|quite|extremely|highly|truly|absolutely|incredibly|remarkably)\b/i;
        return !adjectives.test(w);
      });
      return filtered.join(" ");
    });
    
    return shortened.join(" ").replace(/\s+/g, " ").trim();
  } else if (mode === "Fuller") {
    const systemFrame = "Scanning is not a service; it is infrastructure. Existing conditions documentation is a control layer for the entire project ecosystem.";
    
    if (!draftText.toLowerCase().includes("infrastructure") && 
        !draftText.toLowerCase().includes("control layer") &&
        !draftText.toLowerCase().includes("ecosystem")) {
      const paragraphs = draftText.split(/\n\n/);
      if (paragraphs.length > 1) {
        paragraphs.splice(1, 0, systemFrame);
        return paragraphs.join("\n\n");
      }
      return `${systemFrame}\n\n${draftText}`;
    }
    return draftText;
  }
  
  return draftText;
}

export async function generateExecutiveBrief(
  buyerType: BuyerMode,
  painPoint: PrimaryPain,
  projectContext: string,
  authorMode: AuthorMode = "Twain"
): Promise<GenerationResult> {
  const startTime = Date.now();
  const context = constructContext(buyerType, "2_NoProjectMeeting");
  const opener = getDualModeOpener(buyerType);
  const pillars = getPillarsForPain([painPoint, ...context.primaryPain]);
  
  const definitions = await db.select().from(standardDefinitions).where(eq(standardDefinitions.active, true));
  const personas = await db.select().from(brandPersonas).where(eq(brandPersonas.active, true));
  
  const executiveMapper = personas.find(p => p.name === "Executive Signal Mapper");
  
  const definitionsContext = definitions.map(d => `${d.term}: ${d.definition}`).join("\n");
  
  const systemPrompt = `You are the "Executive Signal Mapper" for Scan2Plan.

Core Identity: ${executiveMapper?.coreIdentity || "Internal executive advisor. Peer-level, calm authority. Mechanism-first. Non-salesy."}

Mantra: Variance is the enemy; consistency is the product.

HARD RED-LINES (NEVER violate):
- No quantified outcomes (weeks saved, % reduction, "zero rework") without documented case
- No comparative/exclusive claims ("best," "only," "better than")
- No implying replacement of licensed roles or stamps
- No guarantees unless explicitly defined in standards

STANDARD DEFINITIONS (The Truth - use exactly as written):
${definitionsContext}

OUTPUT STRUCTURE:
Context (their risk surface) → Mechanism (how variance is controlled) → Boundary (inclusions/exclusions) → Next step

TONE: Calm authority. Short, dense, operational. No hype.`;

  const userPrompt = `Generate an executive brief for:
- Buyer Type: ${buyerType === "A_Principal" ? "Architecture Principal / Firm Gatekeeper" : buyerType === "B_OwnerDev" ? "Owner / Developer Executive" : "Unknown"}
- Pain Point: ${painPoint}
- Project Context: ${projectContext}

Start with this opener: "${opener}"

Use these pillars (max 2):
${pillars.join("\n")}

Keep it under 200 words. No sales pressure. Mechanism-first.`;

  let initialDraft = "";
  let currentDraft = "";
  let rewriteAttempts = 0;
  let allViolations: ViolationResult[] = [];

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    initialDraft = response.choices[0]?.message?.content || "";
    currentDraft = initialDraft;

    let checkResult = await runSelfCheckV2(currentDraft);
    allViolations = [...checkResult.violations];

    while (!checkResult.passed && rewriteAttempts < 3) {
      rewriteAttempts++;
      
      const violationsFeedback = checkResult.violations
        .map(v => `- ${v.category}: ${v.rule}\n  Fix: ${v.correction}`)
        .join("\n");

      const rewritePrompt = `Your previous draft had these violations:
${violationsFeedback}

Please rewrite the following to fix these issues:
${currentDraft}

Remember: No hype, no numbers without cases, no comparisons, mechanism-first.`;

      const rewriteResponse = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rewritePrompt }
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      currentDraft = rewriteResponse.choices[0]?.message?.content || currentDraft;
      checkResult = await runSelfCheckV2(currentDraft);
      allViolations = [...allViolations, ...checkResult.violations];
    }

    currentDraft = await applyMasterAuthor(currentDraft, authorMode);

  } catch (error) {
    console.error("Error generating executive brief:", error);
    currentDraft = `[Generation error] ${opener}\n\nPlease try again or contact support.`;
  }

  const processingTimeMs = Date.now() - startTime;

  await db.insert(generationAuditLogs).values({
    promptContext: projectContext,
    buyerType,
    painPoint,
    situation: "2_NoProjectMeeting",
    initialDraft,
    violationCount: allViolations.length,
    violationsFound: allViolations,
    rewriteAttempts,
    finalOutput: currentDraft,
    personaUsed: "Executive Signal Mapper",
    authorMode,
    processingTimeMs,
  });

  return {
    finalOutput: currentDraft,
    initialDraft,
    violationCount: allViolations.length,
    violationsFound: allViolations,
    rewriteAttempts,
    processingTimeMs,
  };
}

export async function getAuditLogs(limit = 10) {
  return db.select().from(generationAuditLogs).orderBy(generationAuditLogs.createdAt).limit(limit);
}

export async function getStandardDefinitions() {
  return db.select().from(standardDefinitions).where(eq(standardDefinitions.active, true));
}

export async function getRedLines() {
  return db.select().from(governanceRedLines).where(eq(governanceRedLines.active, true));
}

export async function getPersonas() {
  return db.select().from(brandPersonas).where(eq(brandPersonas.active, true));
}
