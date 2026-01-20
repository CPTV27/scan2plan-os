import { db } from "../db";
import { brandPersonas, governanceRedLines, standardDefinitions } from "@shared/schema";

async function seedBrandEngine() {
  console.log("Seeding Cognitive Brand Engine...");

  // === BRAND PERSONAS ===
  const personasData = [
    {
      name: "Executive Signal Mapper",
      coreIdentity: "Internal executive advisor. Peer-level, calm authority. Mechanism-first. Non-salesy. Variance is the enemy; consistency is the product.",
      voiceMode: {
        opener: "Dual-Mode Buyer Openers",
        structure: "Context → Mechanism → Boundary → Next Step",
        pillars: ["P1: Defined Input", "P2: Consistency", "P3: Speed + Control", "P5: Explicit Assurances"],
      },
      mantra: "Variance is the enemy; consistency is the product.",
      directives: "No hype. No comparisons. Mechanism-first. Boundary-clear.",
    },
    {
      name: "Master Author",
      coreIdentity: "Final-pass editor. Applies voice modes (Twain: concise; Fuller: systemic). Removes adjectives, tightens prose, ensures consistency.",
      voiceMode: {
        twain: "Short sentences. Kill adjectives. Dense and operational.",
        fuller: "Systems thinking. Infrastructure framing. Ecosystem language.",
      },
      mantra: "Strip the fat. Keep the bone.",
      directives: "Twain: max 15 words per sentence avg. Fuller: add systems framing.",
    },
  ];

  for (const persona of personasData) {
    await db.insert(brandPersonas).values(persona).onConflictDoNothing();
  }
  console.log(`✓ Inserted ${personasData.length} brand personas`);

  // === GOVERNANCE RED-LINES ===
  const redLinesData = [
    {
      ruleContent: "Never use quantified outcomes without documented case study reference",
      violationCategory: "V1-Unsupported",
      correctionInstruction: "Remove specific numbers or replace with mechanism language like 'reduces variance through defined standards'",
      severity: 2,
    },
    {
      ruleContent: "Never claim to be the best, only, or better than competitors",
      violationCategory: "V2-Comparison",
      correctionInstruction: "Convert to mechanism + boundary language. State what you do, not how you compare.",
      severity: 2,
    },
    {
      ruleContent: "Never use hype language: amazing, revolutionary, incredible, game-changing, world-class, cutting-edge, state-of-the-art",
      violationCategory: "V1-Hype",
      correctionInstruction: "Replace adjectives with mechanism-based descriptions. Describe the process, not the feeling.",
      severity: 1,
    },
    {
      ruleContent: "Never imply that scanning replaces licensed professional roles or stamps",
      violationCategory: "V4-Scope",
      correctionInstruction: "Clarify: Scan data is input for licensed professionals. It does not replace professional judgment or liability.",
      severity: 3,
    },
    {
      ruleContent: "Never guarantee zero defects, perfect accuracy, or elimination of all errors",
      violationCategory: "V3-Guarantee",
      correctionInstruction: "Use standards language: 'calibrated to LoA-30 tolerance (±1/2\")' instead of 'perfect accuracy'",
      severity: 3,
    },
    {
      ruleContent: "Never promise specific schedule savings without documented project reference",
      violationCategory: "V1-Unsupported",
      correctionInstruction: "Remove time claims or replace with process language: 'structured handoff reduces coordination iterations'",
      severity: 2,
    },
    {
      ruleContent: "Never use urgency or scarcity tactics",
      violationCategory: "V5-Pressure",
      correctionInstruction: "Remove urgency language. Focus on mechanism and value proposition, not artificial constraints.",
      severity: 2,
    },
  ];

  for (const redLine of redLinesData) {
    await db.insert(governanceRedLines).values(redLine).onConflictDoNothing();
  }
  console.log(`✓ Inserted ${redLinesData.length} governance red-lines`);

  // === STANDARD DEFINITIONS (The Hard Deck) ===
  const definitionsData = [
    {
      term: "LoA-10",
      definition: "Level of Accuracy 10: Point cloud tolerance > 1 inch. Survey-grade is not guaranteed.",
      category: "accuracy",
    },
    {
      term: "LoA-20",
      definition: "Level of Accuracy 20: Point cloud tolerance ≤ 1 inch. Suitable for general reference.",
      category: "accuracy",
    },
    {
      term: "LoA-30",
      definition: "Level of Accuracy 30: Point cloud tolerance ≤ 1/2 inch. Scan2Plan default for modeled deliverables.",
      guaranteeText: "calibrated to LoA-30 tolerance (±1/2 inch)",
      category: "accuracy",
    },
    {
      term: "LoA-40",
      definition: "Level of Accuracy 40: Point cloud tolerance ≤ 1/4 inch. Scan2Plan default for measured control points.",
      guaranteeText: "calibrated to LoA-40 tolerance (±1/4 inch)",
      category: "accuracy",
    },
    {
      term: "LoA-50",
      definition: "Level of Accuracy 50: Point cloud tolerance ≤ 1/8 inch. High-precision for specialty applications.",
      category: "accuracy",
    },
    {
      term: "LOD-100",
      definition: "Level of Development 100: Conceptual massing. Symbol-based representation only.",
      category: "development",
    },
    {
      term: "LOD-200",
      definition: "Level of Development 200: Generic placeholders. Approximate geometry with parametric editing.",
      category: "development",
    },
    {
      term: "LOD-300",
      definition: "Level of Development 300: Design-intent geometry. Quantity takeoffs and spatial coordination enabled.",
      category: "development",
    },
    {
      term: "LOD-350",
      definition: "Level of Development 350: Coordination-ready geometry. Clash detection and MEP routing enabled.",
      guaranteeText: "modeled to LOD-350 with clash-detection compatibility",
      category: "development",
    },
    {
      term: "LOD-400",
      definition: "Level of Development 400: Fabrication-ready geometry. Shop drawings and install sequences enabled.",
      category: "development",
    },
    {
      term: "Defined Input",
      definition: "Existing conditions treated as a defined, reviewable input—not assumptions. Downstream coordination is built on measured data.",
      guaranteeText: "existing conditions as defined, reviewable input",
      category: "pillar",
    },
    {
      term: "QA Governance",
      definition: "Defined standards, QA gates, and stable revision handling. Change control for each iteration.",
      guaranteeText: "QA governance with defined change control",
      category: "pillar",
    },
    {
      term: "Speed + Control",
      definition: "Timeline is scoped and repeatable. Speed without control becomes rework.",
      category: "pillar",
    },
    {
      term: "Explicit Assurances",
      definition: "Trust comes from explicit definitions, QA gates, and change control—not adjectives.",
      guaranteeText: "explicit definitions and change control protocols",
      category: "pillar",
    },
    {
      term: "Scan2Plan Standard Output",
      definition: "Point cloud registered to project coordinates, calibrated to LoA-30 minimum, with QA review gate before handoff.",
      guaranteeText: "point cloud calibrated to LoA-30 with QA gate",
      category: "output",
    },
  ];

  for (const def of definitionsData) {
    await db.insert(standardDefinitions).values(def).onConflictDoNothing();
  }
  console.log(`✓ Inserted ${definitionsData.length} standard definitions`);

  console.log("\n✓ Cognitive Brand Engine seeding complete!");
}

seedBrandEngine()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
