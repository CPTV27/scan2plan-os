/**
 * ProposalBuilder Page
 *
 * Main page for building and sending proposals.
 * Uses the new WYSIWYG editor for inline editing experience.
 *
 * Flow:
 * 1. Check if a proposal exists for this lead
 * 2. If not, show "Create Proposal" button
 * 3. If it does, show the ProposalWYSIWYG editor
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Lead, CpqQuote, GeneratedProposal } from "@shared/schema";
import {
  ProposalWYSIWYG,
  CreateProposalPrompt,
  type ProposalData,
} from "@/features/proposals/components/ProposalWYSIWYG";

export default function ProposalBuilder() {
  const params = useParams<{ leadId: string }>();
  const leadId = Number(params.leadId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local proposal state for optimistic updates
  const [localProposal, setLocalProposal] = useState<ProposalData | null>(null);

  // Fetch lead data
  const { data: lead, isLoading: leadLoading } = useQuery<Lead>({
    queryKey: ["/api/leads", leadId],
    enabled: !!leadId,
  });

  // Fetch quotes for this lead to build servicesLine
  const { data: quotes } = useQuery<CpqQuote[]>({
    queryKey: [`/api/leads/${leadId}/cpq-quotes`],
    enabled: !!leadId,
  });

  // Fetch existing proposals for this lead
  const { data: existingProposals, isLoading: proposalLoading } =
    useQuery<GeneratedProposal[]>({
      queryKey: [`/api/generated-proposals/lead/${leadId}`],
      enabled: !!leadId,
    });

  // Get the first (most recent) proposal
  const existingProposal = existingProposals?.[0] ?? null;

  // Create proposal mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/proposals/${leadId}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create proposal");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Transform to ProposalData format
      const proposalData: ProposalData = {
        id: data.id,
        leadId: data.leadId,
        coverData: data.coverData || {
          projectTitle: "",
          projectAddress: "",
          servicesLine: "",
          clientName: "",
          date: "",
        },
        projectData: data.projectData || {
          serviceType: "Commercial" as const,
          hasMatterport: false,
          overview: "",
          scopeItems: [],
          deliverables: [],
          timelineIntro: "",
          milestones: [],
        },
        lineItems: data.lineItems || [],
        paymentData: data.paymentData || {
          terms: [],
          paymentMethods: [],
          acknowledgementDate: "",
        },
        subtotal: Number(data.subtotal) || 0,
        total: Number(data.total) || 0,
      };
      setLocalProposal(proposalData);
      queryClient.invalidateQueries({
        queryKey: ["/api/generated-proposals", leadId],
      });
      toast({
        title: "Proposal Created",
        description: "Your proposal has been generated. Edit as needed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle proposal updates (optimistic)
  const handleUpdate = useCallback((data: Partial<ProposalData>) => {
    setLocalProposal((prev) => {
      if (!prev) return null;
      return { ...prev, ...data };
    });
  }, []);

  // Handle back navigation
  const handleBack = () => {
    setLocation(`/deals/${leadId}`);
  };

  // Loading state
  if (leadLoading || proposalLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  // Lead not found
  if (!lead) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Lead not found</p>
            <Button onClick={() => setLocation("/sales")} className="mt-4">
              Back to Sales
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transform existing proposal to ProposalData if available
  // Sync address from lead if it has changed
  const existingCoverData = (existingProposal as any)?.coverData || {};
  const leadAddress = lead?.projectAddress || "";

  // Build per-area scope lines for display on cover page
  const buildAreaScopeLines = (): string[] => {
    const quote = quotes?.[0];
    if (!quote?.areas) return existingCoverData.areaScopeLines || [];

    const areas = (quote as any).areas as any[] || [];
    if (areas.length === 0) return [];

    return areas.map((area: any, index: number) => {
      const areaName = area.name || `Area ${index + 1}`;
      const disciplines = Array.isArray(area.disciplines) ? area.disciplines : [];

      // Get LOD - check disciplineLods for architecture, or use gradeLod
      let lod = "300";
      if (area.disciplineLods && typeof area.disciplineLods === 'object') {
        const archLod = area.disciplineLods["architecture"]?.toString();
        if (archLod) {
          lod = archLod;
        } else {
          // Get first discipline's LOD
          const firstDiscipline = disciplines[0];
          if (firstDiscipline && area.disciplineLods[firstDiscipline]) {
            lod = area.disciplineLods[firstDiscipline].toString();
          }
        }
      } else if (area.gradeLod) {
        lod = area.gradeLod.toString();
      }

      // Normalize discipline names
      const normalizedDisciplines = disciplines
        .filter((d: string) => d && d.toLowerCase() !== "matterport")
        .map((d: string) => {
          const lower = d.toLowerCase();
          if (lower.includes("mep")) return "MEPF";
          if (lower.includes("struct")) return "Structure";
          if (lower.includes("site") || lower.includes("topo")) return "Site";
          if (lower.includes("arch")) return "Architecture";
          return d.charAt(0).toUpperCase() + d.slice(1);
        });

      // Check for Matterport
      const hasMatterport = disciplines.some((d: string) =>
        d.toLowerCase().includes("matterport")
      );

      // Build the scope string
      const parts: string[] = [`LoD ${lod}`];
      if (normalizedDisciplines.length > 0) {
        parts.push(normalizedDisciplines.join(" + "));
      }
      if (hasMatterport) {
        parts.push("Matterport");
      }

      return `${areaName}: ${parts.join(" + ")}`;
    });
  };

  // Build servicesLine from current quote data (single line summary)
  const buildServicesLine = (): string => {
    const quote = quotes?.[0];
    if (!quote?.areas) return existingCoverData.servicesLine || "";

    let highestLod = 0;
    const disciplines = new Set<string>();
    const services = new Set<string>();

    const areas = (quote as any).areas as any[] || [];
    areas.forEach((area: any) => {
      // Extract LoD from disciplineLods - use architecture LoD as the primary one
      if (area.disciplineLods && typeof area.disciplineLods === 'object') {
        // Prefer architecture LoD as the main display value
        const archLod = area.disciplineLods["architecture"];
        if (archLod) {
          const lodNum = parseInt(String(archLod), 10);
          if (!isNaN(lodNum) && lodNum > highestLod) {
            highestLod = lodNum;
          }
        } else {
          // Fall back to first non-matterport discipline LoD
          Object.entries(area.disciplineLods).forEach(([key, lod]: [string, any]) => {
            if (key !== 'matterport' && lod) {
              const lodNum = parseInt(String(lod), 10);
              if (!isNaN(lodNum) && lodNum > highestLod) {
                highestLod = lodNum;
              }
            }
          });
        }
      }
      // Also check gradeLod as fallback
      if (area.gradeLod && highestLod === 0) {
        const lodNum = parseInt(String(area.gradeLod), 10);
        if (!isNaN(lodNum) && lodNum > highestLod) {
          highestLod = lodNum;
        }
      }
      // Extract disciplines
      if (area.disciplines && Array.isArray(area.disciplines)) {
        area.disciplines.forEach((d: string) => {
          const lower = d.toLowerCase();
          if (lower === 'matterport') {
            services.add("Matterport 3D Tour");
          } else if (lower !== 'architecture') {
            const displayName = lower === 'mepf' ? 'MEPF' :
                                lower === 'structural' ? 'Structural' :
                                lower === 'structure' ? 'Structural' :
                                lower === 'site' ? 'Site' : d.toUpperCase();
            disciplines.add(displayName);
          }
        });
      }
    });

    const parts = [];
    if (highestLod > 0) parts.push(`LoD ${highestLod}`);
    if (disciplines.size > 0) parts.push([...disciplines].join(' + '));
    if (services.size > 0) parts.push([...services].join(' + '));
    return parts.join(' + ') || existingCoverData.servicesLine || "";
  };

  // Use lead's current address for the proposal title (syncs if lead address changed)
  // IMPORTANT: projectTitle contains the address for the estimate table display
  // Don't fall back to client name - keep address separate from name
  const areaScopeLines = buildAreaScopeLines();
  const syncedCoverData = existingProposal ? {
    projectTitle: leadAddress || "", // Use lead address, don't fall back to client name
    projectAddress: "", // Combined into projectTitle now
    servicesLine: buildServicesLine(),
    areaScopeLines: areaScopeLines.length > 0 ? areaScopeLines : existingCoverData.areaScopeLines,
    clientName: lead?.clientName || existingCoverData.clientName || "",
    date: existingCoverData.date || "",
  } : {
    projectTitle: "",
    projectAddress: "",
    servicesLine: "",
    areaScopeLines: [],
    clientName: "",
    date: "",
  };

  const proposal: ProposalData | null = localProposal ||
    (existingProposal
      ? {
          id: existingProposal.id,
          leadId: existingProposal.leadId,
          coverData: syncedCoverData,
          projectData: (existingProposal as any).projectData || {
            serviceType: "Commercial" as const,
            hasMatterport: false,
            overview: "",
            scopeItems: [],
            deliverables: [],
            timelineIntro: "",
            milestones: [],
          },
          lineItems: (existingProposal as any).lineItems || [],
          paymentData: (existingProposal as any).paymentData || {
            terms: [],
            paymentMethods: [],
            acknowledgementDate: "",
          },
          subtotal: Number((existingProposal as any).subtotal) || 0,
          total: Number((existingProposal as any).total) || 0,
        }
      : null);

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 bg-white shadow-sm">
        <Button variant="outline" size="sm" onClick={handleBack} className="text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{lead.clientName}</h1>
          <p className="text-sm text-gray-600">
            {lead.projectAddress || "No address"}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {proposal ? (
          <ProposalWYSIWYG
            proposal={proposal}
            onUpdate={handleUpdate}
          />
        ) : (
          <CreateProposalPrompt
            leadId={leadId}
            onCreate={() => createMutation.mutate()}
            isCreating={createMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}
