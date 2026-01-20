import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Building2, Users, Loader2, RefreshCw, Shield, TrendingUp, Briefcase, UserCheck } from "lucide-react";
import type { Lead, LeadResearch } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }
  return headers;
}

interface ResearchButtonProps {
  lead: Lead;
}

type ResearchType = "client" | "property" | "competitor" | "regulatory" | "expansion" | "persona";

const RESEARCH_TYPES: { value: ResearchType; label: string; icon: typeof Users; requiresAddress: boolean }[] = [
  { value: "client", label: "Client Intel", icon: Users, requiresAddress: false },
  { value: "property", label: "Property/MEP", icon: Building2, requiresAddress: true },
  { value: "competitor", label: "Competitors", icon: Briefcase, requiresAddress: false },
  { value: "regulatory", label: "Regulatory", icon: Shield, requiresAddress: true },
  { value: "expansion", label: "Expansion", icon: TrendingUp, requiresAddress: false },
  { value: "persona", label: "Persona", icon: UserCheck, requiresAddress: false },
];

export function ResearchButton({ lead }: ResearchButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: research, isLoading: isLoadingResearch } = useQuery<LeadResearch[]>({
    queryKey: ['/api/leads', lead.id, 'research'],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${lead.id}/research`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch research');
      return res.json();
    },
    enabled: open,
  });

  const researchMutation = useMutation({
    mutationFn: async (researchType: ResearchType) => {
      const res = await fetch(`/api/leads/${lead.id}/research`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ researchType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Research failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads', lead.id, 'research'] });
      toast({ title: "Research Complete", description: "New intelligence data has been gathered." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Research Failed", 
        description: error.message || "Could not complete research",
        variant: "destructive" 
      });
    },
  });

  const getResearchByType = (type: ResearchType) => {
    return research?.filter(r => r.researchType === type)?.[0];
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseHighlights = (highlights: string | null): string[] => {
    if (!highlights) return [];
    try {
      return JSON.parse(highlights);
    } catch {
      return [];
    }
  };

  // Get MEP complexity badge color
  const getMEPBadgeColor = (summary: string): string => {
    if (summary.includes("High")) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (summary.includes("Medium")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (summary.includes("Low")) return "bg-green-500/20 text-green-400 border-green-500/30";
    return "";
  };

  const propertyResearch = getResearchByType("property");
  const hasPropertyWarning = propertyResearch?.summary?.toLowerCase().includes("high");
  const hasExpansionOpportunity = getResearchByType("expansion")?.summary;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 relative"
        onClick={() => setOpen(true)}
        title="Deep Research"
        data-testid={`button-research-${lead.id}`}
      >
        <Search className="w-4 h-4" />
        {hasPropertyWarning && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
        {hasExpansionOpportunity && !hasPropertyWarning && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Intelligence Hub: {lead.clientName}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-6 gap-1">
              {RESEARCH_TYPES.map(({ value, label, icon: Icon, requiresAddress }) => (
                <TabsTrigger 
                  key={value}
                  value={value} 
                  className="flex items-center gap-1 text-xs px-2"
                  disabled={requiresAddress && !lead.projectAddress}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {RESEARCH_TYPES.map(({ value, label, icon: Icon, requiresAddress }) => {
              const researchData = getResearchByType(value);
              const isDisabled = requiresAddress && !lead.projectAddress;
              const highlights = parseHighlights(researchData?.highlights || null);

              return (
                <TabsContent key={value} value={value} className="mt-4 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      {value === "client" && (
                        <>Research business intelligence on <span className="font-medium text-foreground">{lead.clientName}</span></>
                      )}
                      {value === "property" && (
                        <>MEP complexity analysis for <span className="font-medium text-foreground">{lead.projectAddress || 'No address'}</span></>
                      )}
                      {value === "competitor" && (
                        <>Competitive landscape near <span className="font-medium text-foreground">{lead.projectAddress || lead.clientName}</span></>
                      )}
                      {value === "regulatory" && (
                        <>Compliance requirements for <span className="font-medium text-foreground">{lead.projectAddress || 'No address'}</span></>
                      )}
                      {value === "expansion" && (
                        <>Portfolio opportunities for <span className="font-medium text-foreground">{lead.clientName}</span></>
                      )}
                      {value === "persona" && (
                        <>Decision-maker blueprint for <span className="font-medium text-foreground">{lead.contactName || lead.clientName}</span></>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => researchMutation.mutate(value)}
                      disabled={researchMutation.isPending || isDisabled}
                      data-testid={`button-research-${value}`}
                    >
                      {researchMutation.isPending && researchMutation.variables === value ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      {researchData ? 'Refresh' : 'Research'}
                    </Button>
                  </div>

                  {isDisabled ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Icon className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No address available</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add a project address to enable this research
                      </p>
                    </div>
                  ) : isLoadingResearch ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : researchData ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          Updated: {formatDate(researchData.createdAt)}
                        </Badge>
                        {highlights.map((h, i) => (
                          <Badge 
                            key={i} 
                            className={`text-xs ${value === "property" ? getMEPBadgeColor(h) : ""}`}
                          >
                            {h}
                          </Badge>
                        ))}
                        {value === "property" && researchData.summary.toLowerCase().includes("high") && (
                          <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                            High MEP Complexity
                          </Badge>
                        )}
                        {value === "regulatory" && researchData.summary.toLowerCase().includes("ada") && (
                          <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            ADA Required
                          </Badge>
                        )}
                      </div>
                      <ScrollArea className="h-[300px] rounded-md border p-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                          {researchData.summary}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Icon className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No research yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click "Research" to gather {label.toLowerCase()} data
                      </p>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Intelligence badges to show on deal cards
export function IntelligenceBadges({ leadId }: { leadId: number }) {
  const { data: research } = useQuery<LeadResearch[]>({
    queryKey: ['/api/leads', leadId, 'research'],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/research`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  if (!research || research.length === 0) return null;

  const propertyResearch = research.find(r => r.researchType === "property");
  const regulatoryResearch = research.find(r => r.researchType === "regulatory");
  const expansionResearch = research.find(r => r.researchType === "expansion");
  const personaResearch = research.find(r => r.researchType === "persona");

  const hasMEPHigh = propertyResearch?.summary?.toLowerCase().includes("high");
  const hasADA = regulatoryResearch?.summary?.toLowerCase().includes("ada");
  const hasExpansion = expansionResearch?.summary;
  const hasPersona = personaResearch?.summary;

  if (!hasMEPHigh && !hasADA && !hasExpansion && !hasPersona) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {hasMEPHigh && (
        <Badge className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-400 border-red-500/30" title="High MEP Complexity - Increases Bid Price">
          MEP
        </Badge>
      )}
      {hasADA && (
        <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/30" title="ADA Compliance Required">
          ADA
        </Badge>
      )}
      {hasExpansion && (
        <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-400 border-green-500/30" title="Client Expansion Potential">
          Expand
        </Badge>
      )}
      {hasPersona && (
        <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30" title="Persona Blueprint Available">
          Persona
        </Badge>
      )}
    </div>
  );
}
