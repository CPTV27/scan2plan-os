interface ProjectData {
  lead: {
    buildingType?: string | null;
    projectAddress?: string | null;
    sqft?: number | null;
  };
  actualSqft: number;
}

interface GeneratedPost {
  category: "stat_bomb" | "process_tease";
  suggestedVisual: string;
  content: string;
}

interface VarianceContext {
  variancePercent: number;
  isOverrun: boolean;
  estimatedSqft: number;
  actualSqft: number;
  costPerSqft: number;
  impactAmount: number;
}

export function generateSocialContent(
  project: ProjectData, 
  context: VarianceContext
): GeneratedPost[] {
  const { variancePercent, isOverrun, estimatedSqft, actualSqft, impactAmount } = context;
  const variancePct = Math.abs(variancePercent).toFixed(1);
  const impactStr = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumSignificantDigits: 3 
  }).format(impactAmount);

  const type = project.lead.buildingType || "Commercial Renovation";
  
  const addressParts = project.lead.projectAddress?.split(',') || [];
  const city = addressParts.length >= 2 
    ? addressParts[addressParts.length - 2].trim() 
    : "the Metro Area";

  const CTA = "\n\nDM 'SHIELD' for a free Variance Risk Assessment on your next project.";

  if (isOverrun) {
    return [
      {
        category: "stat_bomb",
        suggestedVisual: "Bar Chart: Est vs Actual SQFT (Red Bar for Overrun)",
        content: `Audit Alert: ${variancePct}% OVERRUN Detected

We just audited a ${type} in ${city}.

The Data:
- Drawings: ${estimatedSqft.toLocaleString()} sqft
- Reality: ${actualSqft.toLocaleString()} sqft
- Variance: +${variancePct}% (more than expected)

Without the Scan2Plan Overrun Shield, this owner was exposed to approx ${impactStr} in change order risk.

Don't bid on 1980s PDFs. Bid on the Truth.${CTA}

#Construction #RiskManagement #OverrunShield`
      },
      {
        category: "process_tease",
        suggestedVisual: "Screenshot of S2P Audit Dashboard (Red Badge)",
        content: `This is what a "Hard Gate" looks like.

At Scan2Plan, we don't deliver the model until the math works. Today, our system flagged a ${variancePct}% overrun on a ${type}.

Most firms would just send the file. We stopped the line, flagged the risk, and protected the client from ${impactStr} in potential change orders.

Get the Overrun Shield before you break ground.${CTA}

#VDC #BIM #ProjectControls`
      }
    ];
  } else {
    return [
      {
        category: "stat_bomb",
        suggestedVisual: "Bar Chart: Est vs Actual SQFT (Green Bar for Under-target)",
        content: `Precision Pays: ${variancePct}% UNDER Estimate

We just audited a ${type} in ${city}.

The Data:
- Drawings: ${estimatedSqft.toLocaleString()} sqft
- Reality: ${actualSqft.toLocaleString()} sqft
- Variance: -${variancePct}% (less than expected)

This client may have room for scope expansion or cost savings of approx ${impactStr}.

Know your true square footage before you commit.${CTA}

#Construction #CostSavings #AccuracyMatters`
      },
      {
        category: "process_tease",
        suggestedVisual: "Screenshot of S2P Audit Dashboard (Green Badge)",
        content: `Good news travels too.

Our audit revealed the actual footprint is ${variancePct}% smaller than the drawings suggested on a ${type}.

That's ${impactStr} in potential savings - or room for scope enhancement.

Scan2Plan: Know the truth before you quote.${CTA}

#VDC #BIM #ValueEngineering`
      }
    ];
  }
}

export function generateCaseStudyHighlight(
  caseStudy: {
    title: string;
    blurb: string;
    heroStat?: string | null;
    tags: string[];
  }
): GeneratedPost[] {
  const tagString = caseStudy.tags.slice(0, 3).map(t => `#${t.replace(/\s+/g, '')}`).join(' ');
  
  return [
    {
      category: "stat_bomb" as const,
      suggestedVisual: "Case Study Hero Image",
      content: `${caseStudy.heroStat ? `${caseStudy.heroStat}\n\n` : ''}${caseStudy.title}

${caseStudy.blurb}

DM 'CASE' to see the full breakdown.

${tagString} #CaseStudy #Scan2Plan`
    }
  ];
}
