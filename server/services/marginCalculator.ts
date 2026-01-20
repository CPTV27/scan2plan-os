import { db } from "../db";
import { vendorRates, projects, leads } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface MarginResult {
  vendorCostActual: number;
  marginActual: number;
  marginPercent: number;
}

export interface VendorRateLookup {
  discipline: string;
  lod: string;
  tier?: string;
}

function extractLodNumber(lod: string): string {
  const match = lod.match(/\d{3}/);
  return match ? match[0] : "300";
}

function mapDisciplineToVendorKey(discipline: string): string | null {
  const d = discipline.toLowerCase();
  if (d.includes("arch")) return "arch";
  if (d.includes("mep") || d.includes("mech") || d.includes("elec") || d.includes("plumb")) return "mep";
  if (d.includes("struct")) return "structure";
  return null;
}

export async function getVendorRate(lookup: VendorRateLookup): Promise<number | null> {
  const tier = lookup.tier || "standard";
  const lodNum = extractLodNumber(lookup.lod);
  const disciplineKey = mapDisciplineToVendorKey(lookup.discipline);
  if (!disciplineKey) return null;

  const rate = await db.select()
    .from(vendorRates)
    .where(
      and(
        eq(vendorRates.discipline, disciplineKey),
        eq(vendorRates.lod, lodNum),
        eq(vendorRates.tier, tier)
      )
    )
    .limit(1);

  if (rate.length > 0 && rate[0].ratePerSqft) {
    return parseFloat(rate[0].ratePerSqft);
  }
  return null;
}

function parseDisciplinesFromLead(disciplines: string | null): string[] {
  if (!disciplines) return [];
  return disciplines.split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
}

export async function calculateProjectMargin(projectId: number): Promise<MarginResult | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const sqft = project.actualSqft || project.estimatedSqft;
  if (!sqft || sqft <= 0) return null;

  const lod = project.targetLoD || "LOD 300";
  const lodNum = extractLodNumber(lod);
  
  let revenue = 0;
  let projectDisciplines: string[] = [];

  if (project.leadId) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, project.leadId));
    if (lead?.value) {
      revenue = parseFloat(String(lead.value));
    }
    if (lead?.disciplines) {
      projectDisciplines = parseDisciplinesFromLead(lead.disciplines);
    }
  }

  if (revenue <= 0) return null;

  const rates = await db.select().from(vendorRates)
    .where(and(
      eq(vendorRates.lod, lodNum),
      eq(vendorRates.tier, "standard")
    ));

  let totalVendorCost = 0;
  const vendorDisciplineKeys = new Set<string>();

  for (const disc of projectDisciplines) {
    const vendorKey = mapDisciplineToVendorKey(disc);
    if (vendorKey) {
      vendorDisciplineKeys.add(vendorKey);
    }
  }

  if (vendorDisciplineKeys.size === 0) {
    vendorDisciplineKeys.add("arch");
  }

  const disciplineCount = vendorDisciplineKeys.size;
  const weightPerDiscipline = 1 / disciplineCount;

  for (const vendorKey of Array.from(vendorDisciplineKeys)) {
    const rate = rates.find(r => r.discipline === vendorKey);
    if (rate && rate.ratePerSqft) {
      totalVendorCost += sqft * parseFloat(rate.ratePerSqft) * weightPerDiscipline;
    }
  }

  const marginActual = revenue - totalVendorCost;
  const marginPercent = (marginActual / revenue) * 100;

  return {
    vendorCostActual: Math.round(totalVendorCost * 100) / 100,
    marginActual: Math.round(marginActual * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
  };
}

export async function updateProjectMargin(projectId: number): Promise<MarginResult | null> {
  const result = await calculateProjectMargin(projectId);
  if (!result) {
    await db.update(projects)
      .set({
        vendorCostActual: null,
        marginActual: null,
        marginPercent: null,
      })
      .where(eq(projects.id, projectId));
    return null;
  }

  await db.update(projects)
    .set({
      vendorCostActual: String(result.vendorCostActual),
      marginActual: String(result.marginActual),
      marginPercent: String(result.marginPercent),
    })
    .where(eq(projects.id, projectId));

  return result;
}

export async function recalculateAllProjectMargins(): Promise<number> {
  const allProjects = await db.select({ id: projects.id }).from(projects);
  let updated = 0;
  
  for (const project of allProjects) {
    const result = await updateProjectMargin(project.id);
    if (result) updated++;
  }
  
  return updated;
}
