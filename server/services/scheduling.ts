/**
 * Scheduling & Resource Capacity Service
 * 
 * Implements the CEO's "Two Ledger" capacity management system:
 * - Tier A (>= 50k sqft): Outsourced to NavVis (infinite capacity)
 * - Tier B (< 50k sqft): In-house capacity (limited monthly cap)
 */

import { db } from "../db";
import { projects } from "@shared/schema";
import { and, eq, gte, lte, sql, ne } from "drizzle-orm";
import { FY26_GOALS, getProjectTier, getResourceAssignment } from "@shared/businessGoals";

export interface CapacityCheck {
  tier: 'A' | 'B';
  resource: 'outsourced_navvis' | 'in_house';
  capacityType: 'infinite' | 'limited';
  projectSqft: number;
  currentMonthlyUsage: number;
  remainingCapacity: number | null;
  canSchedule: boolean;
  message: string;
}

export interface MonthlyCapacityReport {
  month: string;
  year: number;
  tierAProjects: number;
  tierASqft: number;
  tierBProjects: number;
  tierBSqft: number;
  remainingTierBCapacity: number;
  capacityUtilization: number;
}

/**
 * Get the start and end dates for a given month
 */
function getMonthBoundaries(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Calculate current month's in-house (Tier B) capacity usage
 */
export async function getTierBUsageForMonth(date: Date = new Date()): Promise<number> {
  const { start, end } = getMonthBoundaries(date);
  
  const result = await db
    .select({
      totalSqft: sql<number>`COALESCE(SUM(${projects.estimatedSqft}), 0)`,
    })
    .from(projects)
    .where(
      and(
        gte(projects.scanDate, start),
        lte(projects.scanDate, end),
        // Only count in-house (Tier B) projects
        sql`${projects.estimatedSqft} < ${FY26_GOALS.TIER_A_FLOOR}`
      )
    );

  return Number(result[0]?.totalSqft || 0);
}

/**
 * Check if a project can be scheduled based on capacity rules
 */
export async function checkSchedulingCapacity(
  projectSqft: number,
  targetDate: Date = new Date()
): Promise<CapacityCheck> {
  const assignment = getResourceAssignment(projectSqft);
  
  // Tier A: Always can schedule (outsourced, infinite capacity)
  if (assignment.tier === 'A') {
    return {
      tier: 'A',
      resource: 'outsourced_navvis',
      capacityType: 'infinite',
      projectSqft,
      currentMonthlyUsage: 0,
      remainingCapacity: null,
      canSchedule: true,
      message: `Tier A project (${projectSqft.toLocaleString()} sqft) - Outsourced to NavVis. No capacity constraints.`,
    };
  }
  
  // Tier B: Check in-house capacity
  const currentUsage = await getTierBUsageForMonth(targetDate);
  const remainingCapacity = FY26_GOALS.TIER_B_MAX_MONTHLY_CAPACITY - currentUsage;
  const canSchedule = projectSqft <= remainingCapacity;
  
  return {
    tier: 'B',
    resource: 'in_house',
    capacityType: 'limited',
    projectSqft,
    currentMonthlyUsage: currentUsage,
    remainingCapacity,
    canSchedule,
    message: canSchedule
      ? `Tier B project (${projectSqft.toLocaleString()} sqft) - In-house capacity available. ${remainingCapacity.toLocaleString()} sqft remaining this month.`
      : `CAPACITY EXCEEDED: This ${projectSqft.toLocaleString()} sqft project exceeds remaining in-house capacity of ${remainingCapacity.toLocaleString()} sqft. Consider outsourcing or rescheduling.`,
  };
}

/**
 * Get monthly capacity report
 */
export async function getMonthlyCapacityReport(date: Date = new Date()): Promise<MonthlyCapacityReport> {
  const { start, end } = getMonthBoundaries(date);
  
  // Get Tier A (outsourced) metrics
  const tierAResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalSqft: sql<number>`COALESCE(SUM(${projects.estimatedSqft}), 0)`,
    })
    .from(projects)
    .where(
      and(
        gte(projects.scanDate, start),
        lte(projects.scanDate, end),
        sql`${projects.estimatedSqft} >= ${FY26_GOALS.TIER_A_FLOOR}`
      )
    );
  
  // Get Tier B (in-house) metrics
  const tierBResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalSqft: sql<number>`COALESCE(SUM(${projects.estimatedSqft}), 0)`,
    })
    .from(projects)
    .where(
      and(
        gte(projects.scanDate, start),
        lte(projects.scanDate, end),
        sql`${projects.estimatedSqft} < ${FY26_GOALS.TIER_A_FLOOR}`
      )
    );
  
  const tierASqft = Number(tierAResult[0]?.totalSqft || 0);
  const tierBSqft = Number(tierBResult[0]?.totalSqft || 0);
  const remainingTierBCapacity = Math.max(0, FY26_GOALS.TIER_B_MAX_MONTHLY_CAPACITY - tierBSqft);
  const capacityUtilization = (tierBSqft / FY26_GOALS.TIER_B_MAX_MONTHLY_CAPACITY) * 100;
  
  return {
    month: date.toLocaleString('default', { month: 'long' }),
    year: date.getFullYear(),
    tierAProjects: Number(tierAResult[0]?.count || 0),
    tierASqft,
    tierBProjects: Number(tierBResult[0]?.count || 0),
    tierBSqft,
    remainingTierBCapacity,
    capacityUtilization: Math.round(capacityUtilization * 10) / 10,
  };
}

/**
 * Get resource assignment recommendation for a project
 */
export function getResourceRecommendation(sqft: number): {
  tier: 'A' | 'B';
  resource: string;
  rationale: string;
} {
  const tier = getProjectTier(sqft);
  
  if (tier === 'A') {
    return {
      tier: 'A',
      resource: 'NavVis (Outsourced)',
      rationale: `Project exceeds ${FY26_GOALS.TIER_A_FLOOR.toLocaleString()} sqft threshold. Route to NavVis for outsourced scanning to maintain capacity for in-house Tier B work.`,
    };
  }
  
  return {
    tier: 'B',
    resource: 'In-House Team',
    rationale: `Project under ${FY26_GOALS.TIER_A_FLOOR.toLocaleString()} sqft. Handle with in-house resources for optimal margin capture.`,
  };
}
