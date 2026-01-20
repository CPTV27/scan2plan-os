/**
 * FY26 Business Goals & Governance Constants
 * 
 * These values are derived from the CEO's strategic objectives and
 * Hockey Stick forecast. They govern pricing decisions, capacity
 * planning, and SLA commitments across the Scan2Plan OS.
 */

export const FY26_GOALS = {
  // Revenue Targets
  REVENUE_TARGET: 2200000,         // $2.2M annual target
  
  // Margin Governance (The "GM Hard Gate")
  MARGIN_FLOOR: 0.40,              // 40% GM Gate - blocks proposal if below
  MARGIN_STRETCH: 0.45,            // 45% GM Target - ideal margin
  
  // Tier Classification
  TIER_A_FLOOR: 50000,             // 50k sqft defines "Tier A" projects
  
  // SLA Commitments
  SLA_MOBILIZATION: 7,             // 7 days max mobilization time
  
  // Resource Capacity Rules ("Two Ledger" System)
  // Tier A (>= 50k sqft): Outsourced to NavVis (infinite capacity)
  // Tier B (< 50k sqft): In-house capacity (limited)
  TIER_B_MAX_MONTHLY_CAPACITY: 150000, // 150k sqft in-house monthly cap
} as const;

/**
 * Margin status classification for UI display
 */
export function getMarginStatus(marginPercent: number): {
  status: 'blocked' | 'warning' | 'healthy' | 'excellent';
  label: string;
  color: string;
} {
  const margin = marginPercent / 100; // Convert percentage to decimal
  
  if (margin < FY26_GOALS.MARGIN_FLOOR) {
    return {
      status: 'blocked',
      label: 'Below Gate',
      color: 'red',
    };
  }
  
  if (margin < FY26_GOALS.MARGIN_STRETCH) {
    return {
      status: 'warning',
      label: 'At Floor',
      color: 'yellow',
    };
  }
  
  if (margin >= FY26_GOALS.MARGIN_STRETCH) {
    return {
      status: 'excellent',
      label: 'Above Target',
      color: 'green',
    };
  }
  
  return {
    status: 'healthy',
    label: 'On Target',
    color: 'green',
  };
}

/**
 * Determine project tier based on square footage
 */
export function getProjectTier(sqft: number): 'A' | 'B' {
  return sqft >= FY26_GOALS.TIER_A_FLOOR ? 'A' : 'B';
}

/**
 * Get resource assignment based on project tier
 */
export function getResourceAssignment(sqft: number): {
  tier: 'A' | 'B';
  resource: 'outsourced_navvis' | 'in_house';
  capacityType: 'infinite' | 'limited';
} {
  const tier = getProjectTier(sqft);
  
  if (tier === 'A') {
    return {
      tier: 'A',
      resource: 'outsourced_navvis',
      capacityType: 'infinite',
    };
  }
  
  return {
    tier: 'B',
    resource: 'in_house',
    capacityType: 'limited',
  };
}

/**
 * Validate margin against the GM Hard Gate
 * Returns an error message if blocked, null if allowed
 */
export function validateMarginGate(marginPercent: number): string | null {
  const margin = marginPercent / 100;
  
  if (margin < FY26_GOALS.MARGIN_FLOOR) {
    const requiredMargin = (FY26_GOALS.MARGIN_FLOOR * 100).toFixed(0);
    const currentMargin = marginPercent.toFixed(1);
    return `Margin below ${requiredMargin}% Governance Gate. Current margin: ${currentMargin}%. Adjust pricing to meet minimum margin requirements.`;
  }
  
  return null;
}
