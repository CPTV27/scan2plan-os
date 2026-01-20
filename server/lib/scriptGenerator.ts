import type { Lead, CaseStudy } from '@shared/schema';
import { db } from '../db';
import { evidenceVault } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export async function hydrateScript(
  template: string,
  lead: { firstName?: string; contactName?: string },
  personaCode: string,
  trackingUrl: string
): Promise<string> {
  const evidence = await db.select().from(evidenceVault)
    .where(eq(evidenceVault.personaCode, personaCode))
    .orderBy(desc(evidenceVault.ewsScore))
    .limit(1);

  const hookText = evidence.length > 0
    ? `${evidence[0].hookContent} See proof here: ${evidence[0].sourceUrl || trackingUrl}`
    : `We helped a similar client cut coordination time by 20%. See how: ${trackingUrl}`;

  const firstName = lead.firstName || lead.contactName?.split(' ')[0] || 'there';

  return template
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{hook\}\}/g, hookText);
}

export function hydrateScriptSync(
  template: string, 
  lead: Partial<Lead>, 
  caseStudy: Partial<CaseStudy>, 
  trackingUrl: string
): string {
  const firstName = lead.contactName?.split(' ')[0] || 'there';
  
  return template
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{client\}\}/g, caseStudy.clientName || '[CLIENT]')
    .replace(/\{\{heroStat\}\}/g, caseStudy.heroStat || 'significant time savings')
    .replace(/\{\{caseStudyTitle\}\}/g, caseStudy.title || 'this case study')
    .replace(/\{\{caseStudyUrl\}\}/g, trackingUrl);
}

export function generateTrackingUrl(
  leadId: number, 
  destinationUrl: string,
  baseUrl?: string
): string {
  const appUrl = baseUrl || process.env.APP_URL || '';
  return `${appUrl}/api/track?leadId=${leadId}&dest=${encodeURIComponent(destinationUrl)}`;
}
