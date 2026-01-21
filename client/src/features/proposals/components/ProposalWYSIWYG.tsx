/**
 * ProposalWYSIWYG Component
 *
 * Main WYSIWYG proposal editor that combines all page components.
 * Supports inline editing, auto-save, and PDF export.
 */

import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { ProposalCoverPage } from "./ProposalCoverPage";
import { ProposalAboutPage } from "./ProposalAboutPage";
import { ProposalProjectPage } from "./ProposalProjectPage";
import { ProposalEstimateTable } from "./ProposalEstimateTable";
import { ProposalPaymentPage } from "./ProposalPaymentPage";
import { ProposalCapabilitiesPage } from "./ProposalCapabilitiesPage";
import { ProposalDifferencePage } from "./ProposalDifferencePage";
import { ProposalBIMStandards } from "./ProposalBIMStandards";

import type {
  ProposalCoverData,
  ProposalProjectData,
  ProposalPaymentData,
  ProposalLineItem,
} from "@shared/schema/types";

// Full proposal data structure
export interface ProposalData {
  id: number;
  leadId: number;
  coverData: ProposalCoverData;
  projectData: ProposalProjectData;
  lineItems: ProposalLineItem[];
  paymentData: ProposalPaymentData;
  subtotal: number;
  total: number;
}

interface ProposalWYSIWYGProps {
  proposal: ProposalData;
  onUpdate: (data: Partial<ProposalData>) => void;
  disabled?: boolean;
}

export function ProposalWYSIWYG({
  proposal,
  onUpdate,
  disabled = false,
}: ProposalWYSIWYGProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProposalData>) => {
      const response = await fetch(`/api/generated-proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to save proposal");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/generated-proposals", proposal.leadId],
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Debounced auto-save
  const debouncedSave = useCallback(
    (data: Partial<ProposalData>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveMutation.mutate(data);
      }, 1000);
    },
    [saveMutation]
  );

  // Download PDF mutation
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/proposals/${proposal.leadId}/generate-pdf`,
        {
          method: "POST",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposal-${proposal.leadId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "PDF Downloaded",
        description: "Your proposal has been downloaded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update handlers
  const handleCoverChange = useCallback(
    (field: keyof ProposalCoverData, value: string) => {
      const newCoverData = { ...proposal.coverData, [field]: value };
      onUpdate({ coverData: newCoverData });
    },
    [proposal.coverData, onUpdate]
  );

  const handleProjectChange = useCallback(
    (field: keyof ProposalProjectData, value: any) => {
      const newProjectData = { ...proposal.projectData, [field]: value };
      onUpdate({ projectData: newProjectData });
    },
    [proposal.projectData, onUpdate]
  );

  const handleLineItemsChange = useCallback(
    (items: ProposalLineItem[]) => {
      const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
      onUpdate({ lineItems: items, subtotal: total, total });
    },
    [onUpdate]
  );

  const handlePaymentChange = useCallback(
    (field: keyof ProposalPaymentData, value: any) => {
      const newPaymentData = { ...proposal.paymentData, [field]: value };
      onUpdate({ paymentData: newPaymentData });
    },
    [proposal.paymentData, onUpdate]
  );

  // Trigger save on blur
  const handleBlur = useCallback(() => {
    debouncedSave({
      coverData: proposal.coverData,
      projectData: proposal.projectData,
      lineItems: proposal.lineItems,
      paymentData: proposal.paymentData,
      subtotal: proposal.subtotal,
      total: proposal.total,
    });
  }, [proposal, debouncedSave]);

  // Manual save
  const handleManualSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveMutation.mutate({
      coverData: proposal.coverData,
      projectData: proposal.projectData,
      lineItems: proposal.lineItems,
      paymentData: proposal.paymentData,
      subtotal: proposal.subtotal,
      total: proposal.total,
    });
  }, [proposal, saveMutation]);

  return (
    <div className="proposal-wysiwyg flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Proposal Editor</h2>
          {saveMutation.isPending && (
            <span className="text-sm text-blue-600 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSave}
            disabled={saveMutation.isPending || disabled}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending || disabled}
          >
            {downloadMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Scrollable page container */}
      <div className="flex-1 overflow-auto bg-gray-100 p-8">
        <div className="max-w-[8.5in] mx-auto space-y-8">
          {/* Page 1: Cover */}
          <div className="shadow-lg">
            <ProposalCoverPage
              data={proposal.coverData}
              onChange={handleCoverChange}
              onBlur={handleBlur}
              disabled={disabled}
            />
          </div>

          {/* Page 2: About + Why */}
          <div className="shadow-lg">
            <ProposalAboutPage disabled={disabled} />
          </div>

          {/* Page 3: The Project */}
          <div className="shadow-lg">
            <ProposalProjectPage
              data={proposal.projectData}
              onChange={handleProjectChange}
              onBlur={handleBlur}
              disabled={disabled}
            />
          </div>

          {/* Page 4: Spacer (optional, for print layout) */}
          <div className="proposal-page min-h-[11in] p-16 bg-white shadow-lg flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-lg">This page intentionally left blank</p>
              <p className="text-sm">(Ensures estimate starts on odd page)</p>
            </div>
          </div>

          {/* Pages 5-6: Estimate Table */}
          <div className="shadow-lg">
            <ProposalEstimateTable
              lineItems={proposal.lineItems}
              onChange={handleLineItemsChange}
              onBlur={handleBlur}
              clientName={proposal.coverData.clientName}
              clientCompany=""
              estimateNumber={`EST-${proposal.leadId}`}
              estimateDate={proposal.coverData.date}
              disabled={disabled}
            />
          </div>

          {/* Page 7: Payment Terms */}
          <div className="shadow-lg">
            <ProposalPaymentPage
              data={proposal.paymentData}
              onChange={handlePaymentChange}
              onBlur={handleBlur}
              disabled={disabled}
            />
          </div>

          {/* Page 8: Capabilities */}
          <div className="shadow-lg">
            <ProposalCapabilitiesPage disabled={disabled} />
          </div>

          {/* Page 9: The Difference */}
          <div className="shadow-lg">
            <ProposalDifferencePage disabled={disabled} />
          </div>

          {/* Pages 10-12: BIM Standards */}
          <div className="shadow-lg">
            <ProposalBIMStandards disabled={disabled} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component for when no proposal exists yet
 */
interface CreateProposalPromptProps {
  leadId: number;
  onCreate: () => void;
  isCreating: boolean;
}

export function CreateProposalPrompt({
  leadId,
  onCreate,
  isCreating,
}: CreateProposalPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Ready to Create a Proposal?
        </h2>
        <p className="text-gray-600 mb-6">
          Generate a professional proposal using data from the Quote Builder.
          You'll be able to edit all content inline before downloading the final
          PDF.
        </p>
        <Button
          size="lg"
          onClick={onCreate}
          disabled={isCreating}
          className="min-w-[200px]"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Proposal"
          )}
        </Button>
      </div>
    </div>
  );
}
