import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import {
  Loader2,
  User,
  Building2,
  Shield,
  TrendingUp,
  Target,
  Briefcase,
  AlertTriangle,
  Clock,
  Calculator,
  Archive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Lead, LeadResearch } from "@shared/schema";

interface EvidenceVaultPanelProps {
  lead: Lead;
  defaultOpen?: boolean;
}

interface PersonaInsight {
  role: string;
  name: string | null;
  priorities: string[];
  concerns: string[];
  communicationStyle: string;
  decisionTimeframe: string;
}

function parsePersonaFromSummary(summary: string | null): PersonaInsight | null {
  if (!summary) return null;
  
  const insight: PersonaInsight = {
    role: "Decision Maker",
    name: null,
    priorities: [],
    concerns: [],
    communicationStyle: "Professional",
    decisionTimeframe: "Standard"
  };

  const lines = summary.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('role:') || lower.includes('title:')) {
      insight.role = line.split(':')[1]?.trim() || insight.role;
    }
    if (lower.includes('name:')) {
      insight.name = line.split(':')[1]?.trim() || null;
    }
    if (lower.includes('priorit') || lower.includes('focus') || lower.includes('objective')) {
      const priorities = line.split(/[,;:]/).slice(1).map(p => p.trim()).filter(p => p.length > 3 && p.length < 100);
      insight.priorities.push(...priorities);
    }
    if (lower.includes('concern') || lower.includes('challenge') || lower.includes('pain point')) {
      const concerns = line.split(/[,;:]/).slice(1).map(c => c.trim()).filter(c => c.length > 3 && c.length < 100);
      insight.concerns.push(...concerns);
    }
    if (lower.includes('fast') || lower.includes('quick') || lower.includes('urgent')) {
      insight.decisionTimeframe = "Fast-paced";
    }
    if (lower.includes('slow') || lower.includes('careful') || lower.includes('thorough')) {
      insight.decisionTimeframe = "Methodical";
    }
    if (lower.includes('data-driven') || lower.includes('analytical')) {
      insight.communicationStyle = "Analytical / Data-driven";
    }
    if (lower.includes('relationship') || lower.includes('collaborative')) {
      insight.communicationStyle = "Relationship-focused";
    }
  }

  if (insight.priorities.length === 0) {
    const keywords = ["cost", "timeline", "quality", "efficiency", "compliance", "safety", "ROI"];
    keywords.forEach(kw => {
      if (summary.toLowerCase().includes(kw)) {
        insight.priorities.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    });
  }

  return insight;
}

function PersonaCard({ research }: { research: LeadResearch | undefined }) {
  if (!research?.summary) {
    return (
      <div className="p-3 border border-dashed rounded-lg text-center text-muted-foreground">
        <User className="w-6 h-6 mx-auto mb-1 opacity-50" />
        <p className="text-xs">No persona research available</p>
      </div>
    );
  }

  const persona = parsePersonaFromSummary(research.summary);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Decision-Maker Blueprint</span>
        </div>
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
          {persona?.role || "Decision Maker"}
        </Badge>
      </div>

      {persona?.priorities && persona.priorities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {persona.priorities.slice(0, 4).map((p, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              <Target className="w-3 h-3 mr-1" />
              {p}
            </Badge>
          ))}
        </div>
      )}

      {persona?.concerns && persona.concerns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {persona.concerns.slice(0, 3).map((c, i) => (
            <Badge key={i} variant="outline" className="text-xs text-amber-500 border-amber-500/30">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {c}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ResearchSummaryCompact({ 
  research, 
  icon: Icon, 
  title, 
  color 
}: { 
  research: LeadResearch | undefined; 
  icon: typeof Building2;
  title: string;
  color: string;
}) {
  if (!research?.summary) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 pl-5">
        {research.summary}
      </p>
    </div>
  );
}

function IntelligenceOverviewCompact({ lead }: { lead: Lead }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">MEP:</span>
        <Badge 
          variant="outline"
          className={
            lead.complexityScore === "High" ? "text-red-400 border-red-500/30" :
            lead.complexityScore === "Medium" ? "text-amber-400 border-amber-500/30" :
            lead.complexityScore === "Low" ? "text-green-400 border-green-500/30" :
            ""
          }
        >
          {lead.complexityScore || "?"}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Tier:</span>
        <Badge 
          variant="outline"
          className={
            lead.clientTier === "Enterprise" ? "text-purple-400 border-purple-500/30" :
            lead.clientTier === "Mid-Market" ? "text-blue-400 border-blue-500/30" :
            "text-cyan-400 border-cyan-500/30"
          }
        >
          {lead.clientTier || "?"}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Risks:</span>
        <Badge variant="outline">
          {Array.isArray(lead.regulatoryRisks) ? lead.regulatoryRisks.length : 0}
        </Badge>
      </div>
    </div>
  );
}

function PhantomRevenueCompact({ lead }: { lead: Lead }) {
  const sqft = lead.sqft || 50000;
  const phantomSqft = Math.round(sqft * 0.035);
  const annualRevenue = phantomSqft * 35;
  
  return (
    <div className="flex items-center gap-2 text-xs bg-green-500/10 rounded px-2 py-1">
      <Calculator className="w-3 h-3 text-green-500" />
      <span className="text-muted-foreground">BOMA 2024 Phantom:</span>
      <span className="font-medium text-green-500">${annualRevenue.toLocaleString()}/yr potential</span>
    </div>
  );
}

export function EvidenceVaultPanel({ lead, defaultOpen = false }: EvidenceVaultPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { data: research, isLoading } = useQuery<LeadResearch[]>({
    queryKey: ['/api/leads', lead.id, 'research'],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${lead.id}/research`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  const personaResearch = research?.find(r => r.researchType === 'persona');
  const clientResearch = research?.find(r => r.researchType === 'client');
  const propertyResearch = research?.find(r => r.researchType === 'property');
  const competitorResearch = research?.find(r => r.researchType === 'competitor');
  const vaultResearch = research?.find(r => r.researchType === 'vault');

  const hasResearch = research && research.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                Evidence Vault
                {hasResearch && (
                  <Badge variant="secondary" className="text-xs">
                    {research.length} insights
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid="button-toggle-evidence-vault">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            {!isOpen && (
              <div className="pt-1">
                <IntelligenceOverviewCompact lead={lead} />
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <IntelligenceOverviewCompact lead={lead} />
                
                <Separator />

                <PersonaCard research={personaResearch} />

                {vaultResearch?.summary && (
                  <div className="bg-primary/5 rounded-md p-2">
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {vaultResearch.summary}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <ResearchSummaryCompact 
                    research={clientResearch}
                    icon={Building2}
                    title="Client Intelligence"
                    color="text-blue-500"
                  />
                  
                  <ResearchSummaryCompact 
                    research={propertyResearch}
                    icon={Building2}
                    title="Property / MEP Analysis"
                    color="text-cyan-500"
                  />
                  
                  <ResearchSummaryCompact 
                    research={competitorResearch}
                    icon={Briefcase}
                    title="Competitive Landscape"
                    color="text-orange-500"
                  />
                </div>

                <PhantomRevenueCompact lead={lead} />

                {lead.aiInsightsUpdatedAt && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Updated: {new Date(lead.aiInsightsUpdatedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
