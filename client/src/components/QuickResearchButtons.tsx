import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, Building2, Loader2, Sword, Scale, TrendingUp, Archive } from "lucide-react";
import type { Lead } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

type ResearchType = "client" | "property" | "competitor" | "regulatory" | "expansion" | "vault";

interface QuickResearchButtonsProps {
  lead: Lead;
}

export function QuickResearchButtons({ lead }: QuickResearchButtonsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeResearch, setActiveResearch] = useState<ResearchType | null>(null);

  const researchMutation = useMutation({
    mutationFn: async (researchType: ResearchType) => {
      setActiveResearch(researchType);
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
    onSuccess: (_, researchType) => {
      setActiveResearch(null);
      queryClient.invalidateQueries({ queryKey: ['/api/leads', lead.id, 'research'] });
      const labels: Record<ResearchType, string> = {
        client: 'Client Intel',
        property: 'Site Analysis',
        competitor: 'Competitor Analysis',
        regulatory: 'Regulatory Intel',
        expansion: 'Expansion Opportunities',
        vault: 'Evidence Vault Generated'
      };
      toast({ 
        title: `${labels[researchType]} Complete`, 
        description: "Intelligence gathered. Click the search icon to view results." 
      });
    },
    onError: (error: Error) => {
      setActiveResearch(null);
      toast({ 
        title: "Research Failed", 
        description: error.message || "Could not complete research",
        variant: "destructive" 
      });
    },
  });

  const isAnyPending = activeResearch !== null;

  return (
    <div className="flex items-center gap-0.5">
      {/* Client Intelligence */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => researchMutation.mutate('client')}
            disabled={isAnyPending}
            data-testid={`button-quick-client-${lead.id}`}
          >
            {activeResearch === 'client' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Users className="w-3 h-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Client Intelligence</p>
        </TooltipContent>
      </Tooltip>

      {/* Property/Site Intelligence */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => researchMutation.mutate('property')}
            disabled={isAnyPending || !lead.projectAddress}
            data-testid={`button-quick-site-${lead.id}`}
          >
            {activeResearch === 'property' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Building2 className="w-3 h-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Property Intelligence (MEP Analysis)</p>
        </TooltipContent>
      </Tooltip>

      {/* Competitor Intelligence */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => researchMutation.mutate('competitor')}
            disabled={isAnyPending}
            data-testid={`button-quick-competitor-${lead.id}`}
          >
            {activeResearch === 'competitor' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sword className="w-3 h-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Competitor Intelligence</p>
        </TooltipContent>
      </Tooltip>

      {/* Regulatory Intelligence */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => researchMutation.mutate('regulatory')}
            disabled={isAnyPending || !lead.projectAddress}
            data-testid={`button-quick-regulatory-${lead.id}`}
          >
            {activeResearch === 'regulatory' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Scale className="w-3 h-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Regulatory Intelligence (ADA, Codes)</p>
        </TooltipContent>
      </Tooltip>

      {/* Expansion Intelligence */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => researchMutation.mutate('expansion')}
            disabled={isAnyPending}
            data-testid={`button-quick-expansion-${lead.id}`}
          >
            {activeResearch === 'expansion' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Expansion Intelligence (Portfolio)</p>
        </TooltipContent>
      </Tooltip>

      {/* Evidence Vault Generator */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => researchMutation.mutate('vault')}
            disabled={isAnyPending}
            data-testid={`button-quick-vault-${lead.id}`}
          >
            {activeResearch === 'vault' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Archive className="w-3 h-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Generate Evidence Vault (Consolidated Intel)</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
