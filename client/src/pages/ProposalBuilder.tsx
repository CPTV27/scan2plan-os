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

  // Fetch existing proposal for this lead
  const { data: existingProposal, isLoading: proposalLoading } =
    useQuery<GeneratedProposal[]>({
      queryKey: [`/api/generated-proposals/lead/${leadId}`],
      enabled: !!leadId,
      select: (data) => {
        // Get the first (most recent) proposal
        if (Array.isArray(data) && data.length > 0) {
          return data[0];
        }
        return null;
      },
    });

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
  const proposal: ProposalData | null = localProposal ||
    (existingProposal
      ? {
          id: existingProposal.id,
          leadId: existingProposal.leadId,
          coverData: (existingProposal as any).coverData || {
            projectTitle: "",
            projectAddress: "",
            servicesLine: "",
            clientName: "",
            date: "",
          },
          projectData: (existingProposal as any).projectData || {
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
