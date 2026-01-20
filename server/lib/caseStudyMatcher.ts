import { db } from '../db';
import { caseStudies, buyerPersonas } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function rankCaseStudiesForPersona(personaCode: string) {
  const [persona] = await db
    .select()
    .from(buyerPersonas)
    .where(eq(buyerPersonas.code, personaCode))
    .limit(1);
  
  if (!persona) return [];

  // Use organization type and purchase triggers to match case studies
  const matchTerms = [
    persona.organizationType?.toLowerCase(),
    ...(persona.purchaseTriggers || []).map(t => t.toLowerCase()),
  ].filter(Boolean);

  const allCaseStudies = await db.query.caseStudies.findMany();
  
  return allCaseStudies
    .map(cs => ({ 
      ...cs, 
      score: (cs.tags || []).filter(t => 
        matchTerms.some(term => t.toLowerCase().includes(term!) || term!.includes(t.toLowerCase()))
      ).length 
    }))
    .filter(cs => cs.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function getBestCaseStudyForPersona(personaCode: string) {
  const ranked = await rankCaseStudiesForPersona(personaCode);
  return ranked[0] || null;
}
