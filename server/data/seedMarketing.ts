import { db } from '../db';
import { evidenceVault } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from "../lib/logger";

// Note: Old PERSONA_SEED has been deprecated. 
// Buyer personas are now managed via buyerPersonas table and seeded from server/seed/personas.ts

export const EVIDENCE_SEED = [
  { personaCode: "BP1", hookContent: "Maine Penthouse: Captured complex rooftop MEP without a single climb. Zero safety risk, 100% clash detection ready.", ewsScore: 5, sourceUrl: "https://a360.co/3wXjC4e" },
  { personaCode: "BP2", hookContent: "Newark Terminal C: Scanned active high-security terminal with zero operational downtime. Schedule protected.", ewsScore: 5, sourceUrl: "" },
  { personaCode: "BP6", hookContent: "Deep Forest Property: Captured treacherous ravine terrain via drone/remote sensing. No boots on the ground, full topographic certainty.", ewsScore: 4, sourceUrl: "https://a360.co/3wW4z4e" },
  { personaCode: "BP5", hookContent: "Masonic Lodge (Troy): Modeled complex Pipe Organ and historic geometry to LOD 350. Preserved design intent where 2D drawings failed.", ewsScore: 5, sourceUrl: "https://a360.co/3wT5z4e" },
  { personaCode: "BP3", hookContent: "Stony Brook IACS: Verified massive campus facade materials. Created a single source of truth for complex institutional maintenance.", ewsScore: 4, sourceUrl: "https://a360.co/3wV5z4e" },
  { personaCode: "BP1", hookContent: "Fire House (1342 Central): Verified clearance tolerances for new fire apparatus. Guaranteed fit before construction.", ewsScore: 4, sourceUrl: "https://a360.co/3wY5z4e" },
  { personaCode: "BP6", hookContent: "BOMA 2024 Update: Unenclosed amenities (balconies) are now rentable. We found 5% more leasable space using LiDAR.", ewsScore: 5, sourceUrl: "https://www.boma.org/BOMA/Standards" },
  { personaCode: "BP5", hookContent: "LEED v5 Compliance: Reusing structure cuts embodied carbon by 50%. Our LoA 40 scan proves structural capacity for the LCA credits.", ewsScore: 5, sourceUrl: "https://www.usgbc.org/leed/v5" },
  { personaCode: "BP8", hookContent: "Automated QA logic. We analyzed 1M sqft of scan data and found a 68% failure rate in standard as-builts.", ewsScore: 5, sourceUrl: "https://scan2plan.io/research" },
  
  // CEO Strategic Hooks - FY26 Priority Messaging
  // TARGET: ARCHITECTS (BP5) - Strategy: "Design Freedom"
  { personaCode: "BP5", hookContent: "Design Freedom: We guarantee the canvas so you can design uninterrupted. More hours on design; zero hours re-measuring.", ewsScore: 5, sourceUrl: "https://scan2plan.io/castle-lod-explainer" },
  // TARGET: GCs (BP2) - Strategy: "BIM Without Blame"
  { personaCode: "BP2", hookContent: "BIM Without the Blame: Clash-checked, tolerance-verified models. We own the accuracy risk so you don't buy the rework.", ewsScore: 5, sourceUrl: "https://scan2plan.io/assurance-packet" },
  // TARGET: OWNERS / ENTERPRISE (BP6) - Strategy: "Standardize Certainty"
  { personaCode: "BP6", hookContent: "Portfolio Standardization: One vendor, one standard, guaranteed outcomes. Price-match guarantee at equal spec.", ewsScore: 5, sourceUrl: "https://scan2plan.io/program-offer" }
];

export async function seedMarketingData() {
  log('Seeding Marketing Engine...');

  // Seed evidence vault hooks
  for (const e of EVIDENCE_SEED) {
    const existing = await db.select().from(evidenceVault).where(eq(evidenceVault.hookContent, e.hookContent)).limit(1);
    if (existing.length === 0) {
      await db.insert(evidenceVault).values(e);
    }
  }
  
  log('Marketing Engine Seeded.');
}
