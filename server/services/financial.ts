import { db } from "../db";
import { projects, leads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { calculateProjectMargin } from "./marginCalculator";

export async function calculateProjectProfitability(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) throw new Error("Project not found");

    const marginData = await calculateProjectMargin(projectId);

    // Basic profitability structure
    return {
        projectId,
        projectName: project.name,
        quotedPrice: project.quotedPrice ? parseFloat(project.quotedPrice) : 0,
        actualCost: marginData?.vendorCostActual || 0,
        grossProfit: marginData?.marginActual || 0,
        marginPercent: marginData?.marginPercent || 0,
        status: project.status,
        sqft: project.actualSqft || project.estimatedSqft || 0,
        sqftVariance: project.sqftVariance ? parseFloat(project.sqftVariance) : 0,
        isAuditRequired: !project.sqftAuditComplete && Math.abs(parseFloat(project.sqftVariance || "0")) > 10
    };
}
