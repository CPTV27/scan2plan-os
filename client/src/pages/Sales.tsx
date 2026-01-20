import { useLeads } from "@/hooks/use-leads";
import { useLocation } from "wouter";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, AlertCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight, DollarSign, Building2, Ruler, FileText, Trash2, Target, Phone, FileCheck, Handshake, Trophy, XCircle, ExternalLink, Link2, Brain, Star, Upload, FileSpreadsheet, Calculator, Briefcase, ShieldCheck, ShieldAlert, ShieldX, ShieldOff, Send, Users, FileDown } from "lucide-react";
import { AIAssistant } from "@/components/AIAssistant";
import { AIActions } from "@/components/AIActions";
import { ResearchButton, IntelligenceBadges } from "@/components/ResearchButton";
import { QuickResearchButtons } from "@/components/QuickResearchButtons";
import { LeadForm } from "@/components/LeadForm";
import { PDFImportDrawer } from "@/components/PDFImportDrawer";
import { CommunicationCenter } from "@/components/CommunicationCenter";
import { GHLImport } from "@/components/GHLImport";
import { PersonaSelect } from "@/components/PersonaSelect";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { clsx } from "clsx";
import type { Lead } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const STAGES = ["Leads", "Contacted", "Proposal", "Negotiation", "On Hold", "Closed Won", "Closed Lost"] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<Stage, string> = {
  "Leads": "border-l-blue-500",
  "Contacted": "border-l-cyan-500",
  "Proposal": "border-l-yellow-500",
  "Negotiation": "border-l-orange-500",
  "On Hold": "border-l-purple-500",
  "Closed Won": "border-l-green-500",
  "Closed Lost": "border-l-red-500",
};

function IntegrityAuditBadge({ lead }: { lead: Lead }) {
  const status = (lead as any).integrityStatus;
  const overrideApproved = (lead as any).overrideApproved;

  if (!status) return null;

  if (status === 'pass') {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1"
        data-testid={`badge-audit-${lead.id}`}
        title="Quote audit passed"
      >
        <ShieldCheck className="w-3 h-3" />
        Audit OK
      </Badge>
    );
  }

  if (status === 'warning') {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1"
        data-testid={`badge-audit-${lead.id}`}
        title="Quote has audit warnings"
      >
        <ShieldAlert className="w-3 h-3" />
        Warnings
      </Badge>
    );
  }

  if (status === 'blocked') {
    if (overrideApproved) {
      return (
        <Badge
          variant="outline"
          className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1"
          data-testid={`badge-audit-${lead.id}`}
          title="CEO override approved"
        >
          <ShieldCheck className="w-3 h-3" />
          Override OK
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs bg-red-500/20 text-red-400 border-red-500/30 gap-1"
        data-testid={`badge-audit-${lead.id}`}
        title="Quote blocked - requires CEO override"
      >
        <ShieldX className="w-3 h-3" />
        Blocked
      </Badge>
    );
  }

  return null;
}

function QBOImportBadge({ lead }: { lead: Lead }) {
  const importSource = (lead as any).importSource;
  const qboEstimateStatus = (lead as any).qboEstimateStatus;
  const qboHasLinkedInvoice = (lead as any).qboHasLinkedInvoice;

  if (importSource !== 'qbo_sync') return null;

  return (
    <div className="flex gap-1 flex-shrink-0">
      <Badge
        variant="outline"
        className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30"
        data-testid={`badge-qbo-import-${lead.id}`}
        title="Imported from QuickBooks"
      >
        QBO
      </Badge>
      {qboEstimateStatus && (
        <Badge
          variant="outline"
          className={clsx(
            "text-xs",
            qboEstimateStatus === 'Accepted' && "bg-green-500/20 text-green-400 border-green-500/30",
            qboEstimateStatus === 'Rejected' && "bg-red-500/20 text-red-400 border-red-500/30",
            qboEstimateStatus === 'Pending' && "bg-amber-500/20 text-amber-400 border-amber-500/30",
            qboEstimateStatus === 'Closed' && "bg-gray-500/20 text-gray-400 border-gray-500/30"
          )}
          data-testid={`badge-qbo-status-${lead.id}`}
          title={`QBO Status: ${qboEstimateStatus}`}
        >
          {qboEstimateStatus}
        </Badge>
      )}
      {qboHasLinkedInvoice && (
        <Badge
          variant="outline"
          className="text-xs bg-green-500/20 text-green-400 border-green-500/30"
          data-testid={`badge-qbo-invoiced-${lead.id}`}
          title="Has linked invoice in QuickBooks"
        >
          Invoiced
        </Badge>
      )}
    </div>
  );
}

function ProbabilityBadge({ lead }: { lead: Lead }) {
  const probability = lead.probability ?? 0;

  const getColorClass = () => {
    if (probability >= 60) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (probability >= 40) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (probability >= 20) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  if (lead.dealStage === 'Closed Won') {
    return <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 flex-shrink-0">Won</Badge>;
  }
  if (lead.dealStage === 'Closed Lost') {
    return <Badge variant="outline" className="text-xs bg-red-500/20 text-red-400 flex-shrink-0">Lost</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className={clsx("text-xs flex-shrink-0", getColorClass())}
      data-testid={`badge-probability-${lead.id}`}
      title={`Win probability: ${probability}%`}
    >
      {probability}%
    </Badge>
  );
}

function DealCard({
  lead,
  onEdit,
  onMove,
  onDelete,
  onOpenCPQ,
  isMoving,
  isDeleting,
  isSelected,
  onToggleSelect
}: {
  lead: Lead;
  onEdit: () => void;
  onMove: (direction: 'prev' | 'next') => void;
  onDelete: () => void;
  onOpenCPQ: () => void;
  isMoving: boolean;
  isDeleting: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const isStale = lead.lastContactDate && differenceInDays(new Date(), new Date(lead.lastContactDate)) > 14;
  const isHighValue = Number(lead.value) >= 10000;
  const stageIndex = STAGES.indexOf(lead.dealStage as Stage);
  const canMoveLeft = stageIndex > 0 && lead.dealStage !== "Closed Won" && lead.dealStage !== "Closed Lost";
  const canMoveRight = stageIndex < STAGES.length - 1 && lead.dealStage !== "Closed Won" && lead.dealStage !== "Closed Lost";

  return (
    <Card
      className={clsx(
        "mb-3 border-l-4 transition-all overflow-hidden",
        STAGE_COLORS[lead.dealStage as Stage] || "border-l-muted",
        isHighValue && "ring-1 ring-yellow-500/50"
      )}
      data-testid={`card-deal-${lead.id}`}
    >
      <CardContent className="p-3 space-y-2 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          {onToggleSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="mt-0.5"
              data-testid={`checkbox-select-${lead.id}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate" data-testid={`text-client-${lead.id}`}>
              {lead.clientName}
            </p>
            {lead.projectName && (
              <p className="text-xs font-medium text-muted-foreground truncate">
                {lead.projectName}
              </p>
            )}
            <p className="text-xs text-muted-foreground truncate">
              {lead.projectAddress}
            </p>
            <IntelligenceBadges leadId={lead.id} />
          </div>
          {isStale && (
            <span title="Stale (>14 days)">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
          <div className="flex items-center gap-1 flex-shrink-0">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className={clsx(
              "text-sm font-mono",
              isHighValue && "text-yellow-500 font-semibold"
            )} data-testid={`text-value-${lead.id}`}>
              {Number(lead.value).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0" title={`Priority: ${lead.leadPriority || 3}/5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={clsx(
                "w-3 h-3",
                i < (lead.leadPriority || 3)
                  ? (lead.leadPriority || 3) >= 4
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground fill-muted-foreground"
                  : "text-muted-foreground/30"
              )} />
            ))}
          </div>
          {lead.leadSource && (
            <Badge
              variant="secondary"
              className="text-xs flex-shrink-0 max-w-[80px] truncate"
              data-testid={`badge-source-${lead.id}`}
            >
              {lead.leadSource}
            </Badge>
          )}
          <ProbabilityBadge lead={lead} />
        </div>

        {(lead.sqft || lead.buildingType || lead.scope) && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground overflow-hidden">
            {lead.sqft && (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <Ruler className="w-3 h-3" />
                {lead.sqft.toLocaleString()} sqft
              </span>
            )}
            {lead.buildingType && (
              <span className="flex items-center gap-0.5 flex-shrink-0 max-w-[100px] truncate">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{lead.buildingType.split(' / ')[0]}</span>
              </span>
            )}
            {lead.scope && (
              <Badge variant="secondary" className="text-xs px-1 py-0 flex-shrink-0">
                {lead.scope}
              </Badge>
            )}
          </div>
        )}

        {lead.quoteNumber && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="w-3 h-3" />
            <span className="font-mono">{lead.quoteNumber}</span>
          </div>
        )}

        {lead.quoteUrl && (
          <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
            <a
              href={lead.quoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
              data-testid={`link-quote-${lead.id}`}
            >
              <Link2 className="w-3 h-3" />
              <span>View Quote</span>
            </a>
            {lead.quoteVersion && (
              <Badge
                variant="outline"
                className="text-xs font-mono flex-shrink-0"
                data-testid={`badge-version-${lead.id}`}
              >
                V{lead.quoteVersion}
              </Badge>
            )}
            <IntegrityAuditBadge lead={lead} />
            <QBOImportBadge lead={lead} />
          </div>
        )}

        {lead.lastContactDate && (
          <p className={clsx(
            "text-xs",
            isStale ? "text-destructive" : "text-muted-foreground"
          )}>
            Last contact: {format(new Date(lead.lastContactDate), "MMM d")}
          </p>
        )}

        <div className="flex items-center justify-between gap-1 pt-1 border-t border-border overflow-hidden">
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <PersonaSelect leadId={lead.id} currentPersona={lead.buyerPersona} />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMove('prev')}
              disabled={!canMoveLeft || isMoving}
              data-testid={`button-move-prev-${lead.id}`}
              title="Move to previous stage"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMove('next')}
              disabled={!canMoveRight || isMoving}
              data-testid={`button-move-next-${lead.id}`}
              title="Move to next stage"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {(lead as any).qboEstimateId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => window.open(`/api/quickbooks/estimate/${(lead as any).qboEstimateId}/pdf`, '_blank')}
                data-testid={`button-download-pdf-${lead.id}`}
                title="Download Estimate PDF"
              >
                <FileDown className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                window.location.href = `/deals/${lead.id}?tab=quote`;
              }}
              data-testid={`button-cpq-quote-${lead.id}`}
              title="Open Quote Builder"
            >
              <Calculator className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3 flex-shrink-0"
              onClick={onOpenCPQ}
              data-testid={`button-open-deal-${lead.id}`}
            >
              Open
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STAGE_ICONS: Record<Stage, typeof Target> = {
  "Leads": Target,
  "Contacted": Phone,
  "Proposal": FileCheck,
  "Negotiation": Handshake,
  "On Hold": AlertCircle,
  "Closed Won": Trophy,
  "Closed Lost": XCircle,
};

function StageColumn({
  stage,
  leads,
  onEdit,
  onMove,
  onDelete,
  onOpenCPQ,
  movingLeadId,
  deletingLeadId,
  selectedLeads,
  onToggleSelect
}: {
  stage: Stage;
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onMove: (leadId: number, direction: 'prev' | 'next') => void;
  onDelete: (leadId: number) => void;
  onOpenCPQ: (lead: Lead) => void;
  movingLeadId: number | null;
  deletingLeadId: number | null;
  selectedLeads: number[];
  onToggleSelect: (leadId: number) => void;
}) {
  const StageIcon = STAGE_ICONS[stage];
  const columnValue = leads.reduce((sum, lead) => sum + Number(lead.value), 0);
  const isEmpty = leads.length === 0;

  return (
    <div className="flex-shrink-0 w-72 flex flex-col" data-testid={`column-${stage.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm">{stage}</h3>
          <Badge variant="secondary" className="text-xs">
            {leads.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          ${columnValue.toLocaleString()}
        </p>
      </div>

      <div className="flex-1 min-h-[200px]">
        {isEmpty ? (
          <div className="h-full min-h-[200px] border-2 border-dashed border-muted rounded-lg flex flex-col items-center justify-center gap-3 p-4">
            <StageIcon className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No deals in {stage}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {stage === "Leads" && "Add new leads to get started"}
                {stage === "Contacted" && "Move leads here after first contact"}
                {stage === "Proposal" && "Deals with active proposals"}
                {stage === "Negotiation" && "Deals in final negotiation"}
                {stage === "On Hold" && "Projects waiting on budget or timing"}
                {stage === "Closed Won" && "Celebrate your wins here"}
                {stage === "Closed Lost" && "Track lost opportunities"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {leads.map((lead) => (
              <DealCard
                key={lead.id}
                lead={lead}
                onEdit={() => onEdit(lead)}
                onMove={(dir) => onMove(lead.id, dir)}
                onDelete={() => onDelete(lead.id)}
                onOpenCPQ={() => onOpenCPQ(lead)}
                isMoving={movingLeadId === lead.id}
                isDeleting={deletingLeadId === lead.id}
                isSelected={selectedLeads.includes(lead.id)}
                onToggleSelect={() => onToggleSelect(lead.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sales() {
  const { data: leads, isLoading } = useLeads();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);
  const [isCpqImportOpen, setIsCpqImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<number | null>(null);
  const [commLead, setCommLead] = useState<Lead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  // QBO Filter State
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterQboStatus, setFilterQboStatus] = useState<string>("all");
  const [filterHasInvoice, setFilterHasInvoice] = useState<string>("all");
  const [filterHotLeads, setFilterHotLeads] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleOpenCPQ = (lead: Lead) => {
    setSelectedLead(null);
    navigate(`/deals/${lead.id}`);
  };


  const handleOpenCommunication = (lead: Lead) => {
    setCommLead(lead);
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/leads/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      setIsImportOpen(false);
      toast({
        title: "Import Complete",
        description: `${data.imported} leads imported successfully${data.totalErrors > 0 ? `. ${data.totalErrors} rows had errors.` : "."}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Could not import leads from CSV",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
  };

  const cpqImportMutation = useMutation({
    mutationFn: async (jsonContent: string) => {
      const res = await apiRequest("POST", "/api/leads/cpq-import", JSON.parse(jsonContent));
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      setIsCpqImportOpen(false);
      toast({
        title: "CPQ Import Complete",
        description: `Successfully imported deal from CPQ JSON.`,
      });
      if (data.leadId) {
        navigate(`/deals/${data.leadId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "CPQ Import Failed",
        description: error.message || "Could not import lead from CPQ JSON",
        variant: "destructive",
      });
    },
  });

  const handleCpqJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        cpqImportMutation.mutate(content);
      };
      reader.readAsText(file);
    }
  };

  const moveMutation = useMutation({
    mutationFn: async ({ lead, newStage }: { lead: Lead; newStage: string }) => {
      setMovingLeadId(lead.id);
      const res = await apiRequest("PATCH", `/api/leads/${lead.id}/stage`, {
        dealStage: newStage,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
    },
    onSettled: () => {
      setMovingLeadId(null);
    },
  });

  const batchSyncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/leads/batch-sync', { leadIds: selectedLeads });
    },
    onSuccess: (data: any) => {
      toast({
        title: "GoHighLevel Sync Complete",
        description: `Synced ${data.synced?.length || 0} leads. ${data.failed?.length || 0} failed.`,
      });
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync leads to GoHighLevel",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return leadId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      toast({ title: "Deal Deleted", description: "The deal has been removed from your pipeline." });
    },
    onError: () => {
      toast({ title: "Delete Failed", description: "Could not delete the deal.", variant: "destructive" });
    },
  });

  const bulkUpdateStageMutation = useMutation({
    mutationFn: async ({ leadIds, stage }: { leadIds: number[], stage: string }) => {
      const res = await apiRequest("POST", "/api/leads/bulk-update-stage", {
        leadIds,
        dealStage: stage,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      setSelectedLeads([]);
      toast({
        title: "Leads Updated",
        description: data.message || `Updated ${data.updated} leads`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update leads.",
        variant: "destructive"
      });
    },
  });

  const handleMove = (leadId: number, direction: 'prev' | 'next') => {
    const lead = leads?.find(l => l.id === leadId);
    if (!lead) return;

    const currentIndex = STAGES.indexOf(lead.dealStage as Stage);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < STAGES.length) {
      moveMutation.mutate({ lead, newStage: STAGES[newIndex] });
    }
  };

  const filteredLeads = leads?.filter(l => {
    const searchLower = search.toLowerCase();
    const matchesSearch = (
      l.clientName.toLowerCase().includes(searchLower) ||
      (l.projectAddress && l.projectAddress.toLowerCase().includes(searchLower)) ||
      (l.projectName && l.projectName.toLowerCase().includes(searchLower)) ||
      (l.contactName && l.contactName.toLowerCase().includes(searchLower)) ||
      (l.contactEmail && l.contactEmail.toLowerCase().includes(searchLower)) ||
      (l.contactPhone && l.contactPhone.toLowerCase().includes(searchLower))
    );

    // Import source filter
    const leadSource = (l as any).importSource || 'manual';
    const matchesSource = filterSource === 'all' || leadSource === filterSource;

    // QBO status filter (only applies when source filter is qbo_sync)
    const qboStatus = (l as any).qboEstimateStatus;
    const matchesQboStatus = filterSource !== 'qbo_sync' ||
      filterQboStatus === 'all' ||
      qboStatus === filterQboStatus;

    // Has invoice filter (only applies when source filter is qbo_sync)
    const hasInvoice = (l as any).qboHasLinkedInvoice;
    const matchesInvoice = filterSource !== 'qbo_sync' ||
      filterHasInvoice === 'all' ||
      (filterHasInvoice === 'yes' && hasInvoice) ||
      (filterHasInvoice === 'no' && !hasInvoice);

    // Hot leads filter: high value OR high priority, not closed
    const isHot = (Number(l.value) >= 10000 || (l.leadPriority || 0) >= 4) &&
      l.dealStage !== 'Closed Won' && l.dealStage !== 'Closed Lost';
    const matchesHot = !filterHotLeads || isHot;

    return matchesSearch && matchesSource && matchesQboStatus && matchesInvoice && matchesHot;
  });

  const totalValue = leads?.reduce((sum, lead) => sum + Number(lead.value), 0) || 0;
  const weightedValue = leads?.reduce((sum, lead) => sum + (Number(lead.value) * (lead.probability || 0) / 100), 0) || 0;

  const getLeadsByStage = (stage: Stage) => {
    const stageLeads = filteredLeads?.filter(l => l.dealStage === stage) || [];
    // Sort by priority (highest first), then by value (highest first)
    return stageLeads.sort((a, b) => {
      const priorityDiff = (b.leadPriority || 3) - (a.leadPriority || 3);
      if (priorityDiff !== 0) return priorityDiff;
      return Number(b.value) - Number(a.value);
    });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="p-4 md:p-6 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-display font-bold">Sales Pipeline</h2>
                  <p className="text-muted-foreground text-sm mt-1">Manage deals through your sales funnel</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={filterHotLeads ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterHotLeads(!filterHotLeads)}
                    data-testid="button-hot-leads"
                    className={filterHotLeads ? "bg-orange-500 hover:bg-orange-600" : ""}
                  >
                    🔥 Hot Leads
                    {filterHotLeads && leads && (
                      <Badge variant="secondary" className="ml-1 bg-white/20">
                        {leads.filter(l =>
                          (Number(l.value) >= 10000 || (l.leadPriority || 0) >= 4) &&
                          l.dealStage !== 'Closed Won' && l.dealStage !== 'Closed Lost'
                        ).length}
                      </Badge>
                    )}
                  </Button>
                  <NotificationBell />
                  <AIAssistant />
                  <Button
                    variant="outline"
                    onClick={() => batchSyncMutation.mutate()}
                    disabled={batchSyncMutation.isPending || selectedLeads.length === 0}
                    data-testid="button-batch-sync"
                    title={selectedLeads.length === 0 ? "Select leads to sync" : `Sync ${selectedLeads.length} lead(s) to GoHighLevel`}
                  >
                    {batchSyncMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Sync to GHL {selectedLeads.length > 0 && `(${selectedLeads.length})`}
                  </Button>
                  <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-import-leads">
                        <Upload className="w-4 h-4 mr-2" /> Import CSV
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Leads from Spreadsheet</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <FileSpreadsheet className="w-4 h-4" />
                            CSV Format Requirements
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Your CSV file must include these columns:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                            <li><strong>Client</strong> or <strong>Client Name</strong> (required)</li>
                            <li><strong>Address</strong> or <strong>Project Address</strong> (optional)</li>
                            <li><strong>Value</strong> or <strong>Amount</strong> (optional)</li>
                            <li><strong>Contact Name</strong>, <strong>Email</strong>, <strong>Phone</strong> (optional)</li>
                            <li><strong>Source</strong>, <strong>Priority</strong>, <strong>Notes</strong> (optional)</li>
                          </ul>
                        </div>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-lg p-8 gap-3">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Select a CSV file to import</p>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".csv"
                              className="hidden"
                              onChange={handleFileUpload}
                              disabled={importMutation.isPending}
                              data-testid="input-import-file"
                            />
                            <Button
                              variant="default"
                              className="pointer-events-none"
                              disabled={importMutation.isPending}
                            >
                              {importMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                <>Choose File</>
                              )}
                            </Button>
                          </label>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    onClick={() => setIsPdfImportOpen(true)}
                    data-testid="button-pdf-import"
                  >
                    <FileText className="w-4 h-4 mr-2" /> Import PDFs
                  </Button>
                  <GHLImport />
                  <Dialog open={isCpqImportOpen} onOpenChange={setIsCpqImportOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-cpq-import">
                        <Calculator className="w-4 h-4 mr-2" /> CPQ Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import from CPQ JSON</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Calculator className="w-4 h-4" />
                            CPQ JSON Format
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Upload a .json file exported from the CPQ tool to automatically create a new lead/client in the pipeline.
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-lg p-8 gap-3">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Select a CPQ JSON file to import</p>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".json"
                              className="hidden"
                              onChange={handleCpqJsonUpload}
                              disabled={cpqImportMutation.isPending}
                              data-testid="input-cpq-json-file"
                            />
                            <Button
                              variant="default"
                              className="pointer-events-none"
                              disabled={cpqImportMutation.isPending}
                            >
                              {cpqImportMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                <>Choose JSON File</>
                              )}
                            </Button>
                          </label>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/sales/trash")}
                    data-testid="button-view-trash"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Trash
                  </Button>
                  <Button
                    data-testid="button-new-lead"
                    onClick={() => navigate("/deals/new")}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Deal
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-card border-border"
                    placeholder="Search deals..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-search-deals"
                  />
                </div>

                {/* QBO Filters */}
                <Select value={filterSource} onValueChange={(val) => {
                  setFilterSource(val);
                  // Reset QBO-specific filters when switching away from QBO
                  if (val !== 'qbo_sync') {
                    setFilterQboStatus('all');
                    setFilterHasInvoice('all');
                  }
                }}>
                  <SelectTrigger className="w-[130px]" data-testid="select-filter-source">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="qbo_sync">QBO Import</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="hubspot">HubSpot</SelectItem>
                  </SelectContent>
                </Select>

                {filterSource === 'qbo_sync' && (
                  <>
                    <Select value={filterQboStatus} onValueChange={setFilterQboStatus}>
                      <SelectTrigger className="w-[120px]" data-testid="select-filter-qbo-status">
                        <SelectValue placeholder="QBO Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Accepted">Accepted</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterHasInvoice} onValueChange={setFilterHasInvoice}>
                      <SelectTrigger className="w-[110px]" data-testid="select-filter-has-invoice">
                        <SelectValue placeholder="Invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Has Invoice</SelectItem>
                        <SelectItem value="no">No Invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}

                {(filterSource !== 'all' || filterQboStatus !== 'all' || filterHasInvoice !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterSource('all');
                      setFilterQboStatus('all');
                      setFilterHasInvoice('all');
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                )}

                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Pipeline: </span>
                    <span className="font-mono font-semibold text-primary" data-testid="text-total-pipeline">
                      ${totalValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Forecast: </span>
                    <span className="font-mono font-semibold text-accent" data-testid="text-weighted-forecast">
                      ${Math.round(weightedValue).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Deals: </span>
                    <span className="font-mono font-semibold" data-testid="text-deal-count">
                      {leads?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Bulk Action Bar */}
          {selectedLeads.length > 0 && (
            <div className="bg-primary/10 border-b px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium" data-testid="text-selected-count">
                  {selectedLeads.length} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeads([])}
                  data-testid="button-clear-selection"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Move to:</span>
                {STAGES.map((stage) => (
                  <Button
                    key={stage}
                    variant="outline"
                    size="sm"
                    onClick={() => bulkUpdateStageMutation.mutate({ leadIds: selectedLeads, stage })}
                    disabled={bulkUpdateStageMutation.isPending}
                    data-testid={`button-bulk-move-${stage.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {stage}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="flex gap-4 pb-4 min-w-max">
                  {STAGES.map((stage) => (
                    <StageColumn
                      key={stage}
                      stage={stage}
                      leads={getLeadsByStage(stage)}
                      onEdit={setSelectedLead}
                      onMove={handleMove}
                      onDelete={(leadId) => deleteMutation.mutate(leadId)}
                      onOpenCPQ={handleOpenCPQ}
                      movingLeadId={movingLeadId}
                      deletingLeadId={deleteMutation.isPending ? (deleteMutation.variables as number) : null}
                      selectedLeads={selectedLeads}
                      onToggleSelect={(leadId) => {
                        setSelectedLeads(prev =>
                          prev.includes(leadId)
                            ? prev.filter(id => id !== leadId)
                            : [...prev, leadId]
                        );
                      }}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </div>
        </main>

        <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit Deal</DialogTitle>
            </DialogHeader>
            {selectedLead && (
              <LeadForm
                lead={selectedLead}
                onSuccess={() => setSelectedLead(null)}
                onOpenCPQ={() => {
                  setSelectedLead(null);
                  navigate(`/deals/${selectedLead.id}`);
                }}
                onOpenCommunication={() => {
                  setCommLead(selectedLead);
                }}
                onDelete={() => {
                  if (confirm("Are you sure you want to delete this deal?")) {
                    deleteMutation.mutate(selectedLead.id, {
                      onSuccess: () => setSelectedLead(null)
                    });
                  }
                }}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === selectedLead.id}
              />
            )}
          </DialogContent>
        </Dialog>

        <PDFImportDrawer
          open={isPdfImportOpen}
          onOpenChange={setIsPdfImportOpen}
        />


        {commLead && (
          <Dialog open={!!commLead} onOpenChange={(open) => !open && setCommLead(null)}>
            <DialogContent className="max-w-2xl max-h-[85vh] p-0">
              <CommunicationCenter
                lead={commLead}
                onClose={() => setCommLead(null)}
              />
            </DialogContent>
          </Dialog>
        )}

      </div>
    </div>
  );
}
