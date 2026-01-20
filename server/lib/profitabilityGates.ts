import { TIER_A_THRESHOLD } from "@shared/schema";
import type { Lead } from "@shared/schema";
import { FY26_GOALS } from "@shared/businessGoals";

export interface GateResult {
  passed: boolean;
  code?: string;
  message?: string;
  details?: Record<string, any>;
}

export interface ProposalGateResults {
  gmGate: GateResult;
  attributionGate: GateResult;
  estimatorCardGate: GateResult;
  allPassed: boolean;
  warnings: string[];
}

export function calculateMarginFromQuote(quote: {
  pricingBreakdown?: {
    totalClientPrice?: number;
    totalUpteamCost?: number;
  } | null;
}): number {
  const clientPrice = quote.pricingBreakdown?.totalClientPrice || 0;
  const upteamCost = quote.pricingBreakdown?.totalUpteamCost || 0;
  if (clientPrice <= 0) return 0;
  return ((clientPrice - upteamCost) / clientPrice) * 100;
}

export function checkGMGate(marginPercent: number): GateResult {
  const marginFloorPercent = FY26_GOALS.MARGIN_FLOOR * 100;
  if (marginPercent >= marginFloorPercent) {
    return { passed: true };
  }
  return {
    passed: false,
    code: "GM_GATE_BLOCKED",
    message: `Margin ${marginPercent.toFixed(1)}% is below ${marginFloorPercent}% floor`,
    details: { marginPercent, required: marginFloorPercent },
  };
}

export function checkAttributionGate(lead: Lead, isClosingWon: boolean): GateResult {
  const hasSource = !!lead.leadSource && lead.leadSource !== "";
  
  if (isClosingWon && !hasSource) {
    return {
      passed: false,
      code: "ATTRIBUTION_REQUIRED",
      message: "Lead source must be set before closing deal",
      details: { stage: "Closed Won" },
    };
  }
  
  return { passed: true };
}

export function checkEstimatorCardGate(lead: Lead): GateResult {
  const sqft = lead.sqft || 0;
  const isTierA = sqft >= TIER_A_THRESHOLD || lead.abmTier === "Tier A";
  
  if (!isTierA) {
    return { passed: true };
  }
  
  // Estimator card is recommended but not blocking for backwards compatibility
  // Legacy Tier A leads without cards should still be able to generate proposals
  if (!lead.estimatorCardId && !lead.estimatorCardUrl) {
    return {
      passed: true, // Soft gate - warning only
      code: "ESTIMATOR_CARD_RECOMMENDED",
      message: `Tier A project (${sqft.toLocaleString()} sqft) - estimator card recommended for better proposal accuracy`,
      details: { sqft, tierAThreshold: TIER_A_THRESHOLD, isWarning: true },
    };
  }
  
  return { passed: true };
}

export function checkProposalGates(
  lead: Lead,
  quote: { pricingBreakdown?: { totalClientPrice?: number; totalUpteamCost?: number } | null } | null
): ProposalGateResults {
  const warnings: string[] = [];
  
  const marginPercent = quote ? calculateMarginFromQuote(quote) : 0;
  const gmGate = checkGMGate(marginPercent);
  
  const attributionGate = checkAttributionGate(lead, false);
  if (!attributionGate.passed) {
    warnings.push("Lead source not tracked - add for reporting");
    attributionGate.passed = true;
  }
  
  const estimatorCardGate = checkEstimatorCardGate(lead);
  
  return {
    gmGate,
    attributionGate,
    estimatorCardGate,
    allPassed: gmGate.passed && attributionGate.passed && estimatorCardGate.passed,
    warnings,
  };
}

export function shouldAutoTierA(sqft: number | null | undefined): boolean {
  return (sqft || 0) >= TIER_A_THRESHOLD;
}

export function getAutoTierAUpdate(sqft: number | null | undefined): { abmTier: string; leadPriority: number } | null {
  if (shouldAutoTierA(sqft)) {
    return {
      abmTier: "Tier A",
      leadPriority: 5,
    };
  }
  return null;
}
