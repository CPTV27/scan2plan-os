import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, User, Building2, Shield, TrendingUp, Target, Briefcase, AlertTriangle, CheckCircle, Clock, DollarSign, Calculator, Archive } from "lucide-react";
import type { Lead, LeadResearch } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface EvidenceVaultProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-muted-foreground">
          <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No persona research available</p>
          <p className="text-xs mt-1">Run Persona research to generate decision-maker blueprint</p>
        </CardContent>
      </Card>
    );
  }

  const persona = parsePersonaFromSummary(research.summary);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-purple-500" />
          Decision-Maker Blueprint
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            {persona?.role || "Decision Maker"}
          </Badge>
          {persona?.name && (
            <span className="text-sm font-medium">{persona.name}</span>
          )}
        </div>

        {persona?.priorities && persona.priorities.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Key Priorities</p>
            <div className="flex flex-wrap gap-1">
              {persona.priorities.slice(0, 5).map((p, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <Target className="w-3 h-3 mr-1" />
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {persona?.concerns && persona.concerns.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Concerns / Pain Points</p>
            <div className="flex flex-wrap gap-1">
              {persona.concerns.slice(0, 5).map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs text-amber-500 border-amber-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Communication</p>
            <p className="font-medium">{persona?.communicationStyle}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Decision Speed</p>
            <p className="font-medium">{persona?.decisionTimeframe}</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-md p-2">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
            {research.summary}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ResearchSummaryCard({ 
  research, 
  icon: Icon, 
  title, 
  emptyMessage,
  color 
}: { 
  research: LeadResearch | undefined; 
  icon: typeof Building2;
  title: string;
  emptyMessage: string;
  color: string;
}) {
  if (!research?.summary) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-3 flex items-center gap-3 text-muted-foreground">
          <Icon className="w-5 h-5 opacity-50 flex-shrink-0" />
          <p className="text-xs">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className={`w-4 h-4 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
          {research.summary}
        </p>
        {research.highlights && Array.isArray(research.highlights) && research.highlights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(research.highlights as string[]).slice(0, 4).map((h, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {h}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntelligenceOverview({ lead }: { lead: Lead }) {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">MEP Complexity</p>
            <Badge 
              className={
                lead.complexityScore === "High" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                lead.complexityScore === "Medium" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                lead.complexityScore === "Low" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                ""
              }
            >
              {lead.complexityScore || "Unknown"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Client Tier</p>
            <Badge 
              className={
                lead.clientTier === "Enterprise" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                lead.clientTier === "Mid-Market" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                lead.clientTier === "SMB" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" :
                ""
              }
            >
              {lead.clientTier || "Unknown"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Regulatory Risks</p>
            <Badge variant="outline">
              {Array.isArray(lead.regulatoryRisks) ? lead.regulatoryRisks.length : 0} identified
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PhantomRevenueCalculator({ lead }: { lead: Lead }) {
  const [rentPerSqft, setRentPerSqft] = useState<number>(35);
  const [phantomPercent, setPhantomPercent] = useState<number>(3.5);
  const [showDetails, setShowDetails] = useState(false);
  
  const sqft = lead.sqft || 50000;
  const phantomSqft = Math.round(sqft * (phantomPercent / 100));
  const annualPhantomRevenue = phantomSqft * rentPerSqft;
  const scanningCost = Math.round(sqft * 0.08);
  const savingsRatio = annualPhantomRevenue / scanningCost;
  const tenYearValue = annualPhantomRevenue * 10;
  const navIncrease = tenYearValue / 0.06;
  
  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calculator className="w-4 h-4 text-green-500" />
          Phantom Revenue Calculator (BOMA 2024)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          BOMA 2024 Office Standard converts previously &quot;free&quot; spaces (balconies, patios, rooftop terraces) into Rentable Area, 
          typically uncovering 2-5% more leasable space.
        </p>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full"
          data-testid="button-phantom-calculator-toggle"
        >
          {showDetails ? "Hide Calculator" : "Calculate ROI for This Property"}
        </Button>
        
        {showDetails && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Property Size (sqft)</Label>
                <div className="text-sm font-mono font-semibold">{sqft.toLocaleString()}</div>
              </div>
              <div>
                <Label htmlFor="phantom-percent" className="text-xs">Phantom Space %</Label>
                <Input 
                  id="phantom-percent"
                  type="number" 
                  value={phantomPercent} 
                  onChange={(e) => setPhantomPercent(Number(e.target.value))}
                  step="0.5"
                  min="1"
                  max="10"
                  className="h-8 text-xs"
                  data-testid="input-phantom-percent"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="rent-sqft" className="text-xs">Annual Rent ($/sqft)</Label>
              <Input 
                id="rent-sqft"
                type="number" 
                value={rentPerSqft} 
                onChange={(e) => setRentPerSqft(Number(e.target.value))}
                step="1"
                min="10"
                max="200"
                className="h-8 text-xs"
                data-testid="input-rent-sqft"
              />
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">Phantom Space Found</p>
                <p className="font-semibold text-green-500">{phantomSqft.toLocaleString()} sqft</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Annual Revenue Unlocked</p>
                <p className="font-semibold text-green-500">${annualPhantomRevenue.toLocaleString()}/yr</p>
              </div>
            </div>
            
            <div className="bg-green-500/10 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Estimated Scanning Cost</span>
                <span className="font-mono">${scanningCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">First-Year ROI</span>
                <Badge className="bg-green-500/20 text-green-400">
                  {Math.round(savingsRatio * 100)}% return
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">10-Year Cumulative Value</span>
                <span className="font-semibold text-green-400">${tenYearValue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">NAV Increase (6% cap rate)</span>
                <span className="font-semibold text-green-400">${Math.round(navIncrease).toLocaleString()}</span>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground text-center">
              Based on Marywilska adaptive reuse study: Savings Ratio of 1.93x for revitalization investments
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegulatoryRisksCard({ lead }: { lead: Lead }) {
  const risks = Array.isArray(lead.regulatoryRisks) ? lead.regulatoryRisks : [];
  
  if (risks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-3 flex items-center gap-3 text-muted-foreground">
          <Shield className="w-5 h-5 opacity-50 flex-shrink-0" />
          <p className="text-xs">No regulatory risks identified. Run Regulatory research.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="w-4 h-4 text-yellow-500" />
          Regulatory Risks ({risks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.map((r: { risk: string; severity: string; source?: string }, i: number) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <Badge 
              variant="outline"
              className={
                r.severity === "High" ? "text-red-500 border-red-500/30" :
                r.severity === "Medium" ? "text-amber-500 border-amber-500/30" :
                "text-green-500 border-green-500/30"
              }
            >
              {r.severity}
            </Badge>
            <span className="flex-1">{r.risk}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function EvidenceVault({ lead, open, onOpenChange }: EvidenceVaultProps) {
  const { data: research, isLoading } = useQuery<LeadResearch[]>({
    queryKey: ['/api/leads', lead.id, 'research'],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${lead.id}/research`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const personaResearch = research?.find(r => r.researchType === 'persona');
  const clientResearch = research?.find(r => r.researchType === 'client');
  const propertyResearch = research?.find(r => r.researchType === 'property');
  const competitorResearch = research?.find(r => r.researchType === 'competitor');
  const expansionResearch = research?.find(r => r.researchType === 'expansion');
  const vaultResearch = research?.find(r => r.researchType === 'vault');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Evidence Vault: {lead.clientName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-120px)] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <IntelligenceOverview lead={lead} />

              {vaultResearch && (
                <ResearchSummaryCard 
                  research={vaultResearch}
                  icon={Archive}
                  title="Consolidated Evidence Vault"
                  emptyMessage=""
                  color="text-primary"
                />
              )}
              
              <PersonaCard research={personaResearch} />

              <div className="grid gap-3">
                <ResearchSummaryCard 
                  research={clientResearch}
                  icon={Building2}
                  title="Client Intelligence"
                  emptyMessage="Run Client Intel research for business insights"
                  color="text-blue-500"
                />
                
                <ResearchSummaryCard 
                  research={propertyResearch}
                  icon={Building2}
                  title="Property / MEP Analysis"
                  emptyMessage="Run Property research for complexity analysis"
                  color="text-cyan-500"
                />
                
                <PhantomRevenueCalculator lead={lead} />
                
                <RegulatoryRisksCard lead={lead} />

                <ResearchSummaryCard 
                  research={competitorResearch}
                  icon={Briefcase}
                  title="Competitive Landscape"
                  emptyMessage="Run Competitor research for market insights"
                  color="text-orange-500"
                />
                
                <ResearchSummaryCard 
                  research={expansionResearch}
                  icon={TrendingUp}
                  title="Expansion Potential"
                  emptyMessage="Run Expansion research for growth opportunities"
                  color="text-green-500"
                />
              </div>

              {lead.aiInsightsUpdatedAt && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                  <Clock className="w-3 h-3" />
                  <span>AI insights last updated: {new Date(lead.aiInsightsUpdatedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
