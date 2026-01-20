import { db } from "../db";
import { eq } from "drizzle-orm";
import { projectEmbeddings, CPQ_BUILDING_TYPES } from "@shared/schema";
import { log } from "../lib/logger";
import { aiClient, createProjectSummary } from "./ai";

export const leadService = {
  generateScopeSummary(lead: any): string {
    const areas = lead.cpqAreas || [];
    if (areas.length === 0) return "No areas configured";

    const totalSqft = areas.reduce((sum: number, area: any) => sum + (parseInt(area.squareFeet) || 0), 0);
    const disciplines = Array.from(new Set(areas.flatMap((a: any) => a.disciplines || [])));
    const buildingTypes = Array.from(new Set(areas.map((a: any) => {
      const typeId = a.buildingType?.toString();
      return (CPQ_BUILDING_TYPES as any)[typeId] || `Type ${typeId}`;
    })));

    const parts: string[] = [];
    
    if (areas.length === 1) {
      parts.push(`${totalSqft.toLocaleString()} sqft ${buildingTypes[0] || 'building'}`);
    } else {
      parts.push(`${areas.length} areas totaling ${totalSqft.toLocaleString()} sqft`);
    }

    if (disciplines.length > 0) {
      const disciplineNames = (disciplines as string[]).map(d => {
        const map: Record<string, string> = {
          arch: 'Architecture',
          struct: 'Structure', 
          mech: 'Mechanical',
          elec: 'Electrical',
          plumb: 'Plumbing',
          site: 'Site'
        };
        return map[d] || d;
      });
      parts.push(disciplineNames.join(', '));
    }

    const allLods: number[] = [];
    for (const area of areas) {
      if (area.mixedInteriorLod) allLods.push(parseInt(area.mixedInteriorLod) || 200);
      if (area.mixedExteriorLod) allLods.push(parseInt(area.mixedExteriorLod) || 200);
      if (area.disciplineLods) {
        for (const lod of Object.values(area.disciplineLods)) {
          allLods.push(parseInt(lod as string) || 200);
        }
      }
    }
    if (allLods.length > 0) {
      const maxLod = Math.max(...allLods);
      parts.push(`LOD ${maxLod}`);
    }

    const risksArray = Array.isArray(lead.cpqRisks) ? lead.cpqRisks : [];
    if (risksArray.length > 0) {
      const riskNames = risksArray.map((r: string) => {
        const map: Record<string, string> = {
          remote: 'Remote',
          fastTrack: 'Fast Track',
          occupied: 'Occupied',
          hazardous: 'Hazardous',
          noPower: 'No Power/HVAC'
        };
        return map[r] || r;
      });
      parts.push(`Risk: ${riskNames.join(', ')}`);
    }

    if (lead.dispatchLocation) {
      parts.push(`Dispatch: ${lead.dispatchLocation}`);
      if (lead.distance) {
        parts.push(`${lead.distance} mi`);
      }
    }

    return parts.join(' • ');
  },

  async precomputeEmbedding(lead: any): Promise<void> {
    if (!aiClient.isConfigured()) return;
    
    try {
      const summary = createProjectSummary(lead);
      const embeddingResult = await aiClient.embed(summary);
      
      if (!embeddingResult) return;
      
      const [existing] = await db.select().from(projectEmbeddings).where(eq(projectEmbeddings.leadId, lead.id));
      
      if (existing) {
        await db.update(projectEmbeddings)
          .set({
            embedding: JSON.stringify(embeddingResult.embedding),
            projectSummary: summary,
            updatedAt: new Date(),
          })
          .where(eq(projectEmbeddings.id, existing.id));
      } else {
        await db.insert(projectEmbeddings).values({
          leadId: lead.id,
          embedding: JSON.stringify(embeddingResult.embedding),
          projectSummary: summary,
        });
      }
      
      log(`[Embedding] Pre-computed embedding for lead ${lead.id}`);
    } catch (err: any) {
      log(`[Embedding] Pre-computation failed for lead ${lead.id}: ${err.message}`);
    }
  },

  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },
};
