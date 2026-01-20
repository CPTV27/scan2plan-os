/**
 * ProposalBuilder Page
 * 
 * Main page for building and sending proposals.
 * Uses the ProposalLayoutEditor component for the visual layout editing experience.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Lead, CpqQuote } from "@shared/schema";
import { ProposalLayoutEditor } from "@/features/proposals/components/ProposalLayoutEditor";

export default function ProposalBuilder() {
  const params = useParams<{ leadId: string }>();
  const leadId = Number(params.leadId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch lead data
  const { data: lead, isLoading: leadLoading } = useQuery<Lead>({
    queryKey: ["/api/leads", leadId],
    enabled: !!leadId,
  });

  // Fetch quotes for this lead
  const { data: quotes = [] } = useQuery<CpqQuote[]>({
    queryKey: ["/api/leads", leadId, "cpq-quotes"],
    enabled: !!leadId,
  });

  const latestQuote = quotes.find((q) => q.isLatest) || quotes[0] || null;

  // Handle back navigation
  const handleBack = () => {
    setLocation(`/deals/${leadId}`);
  };

  // Handle send proposal
  const handleSendProposal = async () => {
    try {
      const response = await fetch(`/api/proposals/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseStudyIds: [] }),
      });

      if (!response.ok) {
        throw new Error("Failed to send proposal");
      }

      const result = await response.json();

      toast({
        title: "Proposal Sent",
        description: `PDF generated (${Math.round(result.pdfSize / 1024)}KB). Lead status updated to "Proposal Sent".`,
      });

      // Invalidate lead query to refresh status
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      setLocation(`/deals/${leadId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send proposal",
        variant: "destructive",
      });
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/proposals/${leadId}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseStudyIds: [] }),
      });

      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Scan2Plan_Proposal_${lead?.clientName || "Client"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Downloaded",
        description: "Proposal PDF has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (leadLoading) {
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

  return (
    <div className="h-screen bg-background">
      <ProposalLayoutEditor
        lead={lead}
        quote={latestQuote}
        onBack={handleBack}
        onSend={handleSendProposal}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  );
}
