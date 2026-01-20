import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, Loader2 } from "lucide-react";
import type { Lead } from "@shared/schema";

interface QboEstimateBadgeProps {
  lead: Lead;
}

export function QboEstimateBadge({ lead }: QboEstimateBadgeProps) {
  const { data: estimateData, isLoading } = useQuery<{ 
    url: string | null; 
    connected: boolean; 
    estimateId?: string; 
    estimateNumber?: string;
  }>({
    queryKey: ["/api/quickbooks/estimate-url", lead.id],
    enabled: !!lead.id,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid="badge-qbo-loading">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading
      </Badge>
    );
  }

  if (estimateData && !estimateData.connected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid="badge-qbo-not-connected">
            <DollarSign className="w-3 h-3" />
            QBO Offline
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>QuickBooks is not connected</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!lead.qboEstimateId && !estimateData?.estimateId) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid="badge-qbo-not-synced">
        <DollarSign className="w-3 h-3" />
        Not Synced
      </Badge>
    );
  }

  if (!estimateData?.url) {
    return (
      <Badge variant="outline" className="gap-1 border-green-500 text-green-600 dark:text-green-400" data-testid="badge-qbo-synced">
        <DollarSign className="w-3 h-3" />
        {lead.qboEstimateNumber || estimateData?.estimateNumber || "Synced"}
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={estimateData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
          data-testid="link-qbo-estimate"
        >
          <Badge variant="outline" className="gap-1 cursor-pointer border-green-500 text-green-600 dark:text-green-400">
            <DollarSign className="w-3 h-3" />
            {lead.qboEstimateNumber || estimateData.estimateNumber || "QBO"}
          </Badge>
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <p>View estimate in QuickBooks Online</p>
      </TooltipContent>
    </Tooltip>
  );
}
