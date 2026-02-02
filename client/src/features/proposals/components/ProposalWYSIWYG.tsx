/**
 * ProposalWYSIWYG Component
 *
 * Main WYSIWYG proposal editor that combines all page components.
 * Supports inline editing, auto-save, and PDF export.
 */

import { useCallback, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  ProposalDisplaySettings,
} from "@shared/schema/types";

// Full proposal data structure
export interface ProposalData {
  id: number;
  leadId: number;
  coverData: ProposalCoverData;
  projectData: ProposalProjectData;
  lineItems: ProposalLineItem[];
  paymentData: ProposalPaymentData;
  displaySettings?: ProposalDisplaySettings;
  subtotal: number;
  total: number;
}

/**
 * Roll up line items by discipline, calculating average rate per sqft
 * Groups items by discipline (Architecture, MEP/F, Structure, Site, etc.)
 */
function rollupLineItemsByDiscipline(lineItems: ProposalLineItem[]): ProposalLineItem[] {
  // Map of discipline keywords to normalized names
  const disciplineKeywords: Record<string, string> = {
    architecture: "Architecture",
    arch: "Architecture",
    mep: "MEP/F",
    mepf: "MEP/F",
    "mep/f": "MEP/F",
    mechanical: "MEP/F",
    electrical: "MEP/F",
    plumbing: "MEP/F",
    structure: "Structure",
    structural: "Structure",
    site: "Site/Grade",
    grade: "Site/Grade",
    landscape: "Landscape",
    cad: "CAD Deliverable",
    matterport: "Matterport",
    travel: "Travel",
    risk: "Risk Premium",
  };

  // Detect discipline from item name
  const detectDiscipline = (itemName: string): string => {
    const nameLower = itemName.toLowerCase();
    for (const [keyword, discipline] of Object.entries(disciplineKeywords)) {
      if (nameLower.includes(keyword)) {
        return discipline;
      }
    }
    return "Other Services";
  };

  // Group items by discipline
  const groups: Record<string, { totalQty: number; totalAmount: number; items: ProposalLineItem[] }> = {};

  lineItems.forEach((item) => {
    const discipline = detectDiscipline(item.itemName);
    if (!groups[discipline]) {
      groups[discipline] = { totalQty: 0, totalAmount: 0, items: [] };
    }
    groups[discipline].totalQty += item.qty || 0;
    groups[discipline].totalAmount += item.amount || 0;
    groups[discipline].items.push(item);
  });

  // Create consolidated line items
  const consolidated: ProposalLineItem[] = [];

  // Define preferred order
  const disciplineOrder = ["Architecture", "MEP/F", "Structure", "Site/Grade", "Landscape", "CAD Deliverable", "Matterport", "Travel", "Risk Premium", "Other Services"];

  disciplineOrder.forEach((discipline) => {
    const group = groups[discipline];
    if (group && group.items.length > 0) {
      const avgRate = group.totalQty > 0 ? group.totalAmount / group.totalQty : 0;

      // Build description from area names
      const areaNames = group.items.map((item) => {
        // Extract area name from item name (e.g., "Area 1 - Architecture" -> "Area 1")
        const match = item.itemName.match(/^(.+?)\s*-\s*/);
        return match ? match[1] : item.itemName;
      });
      const uniqueAreas = [...new Set(areaNames)];

      consolidated.push({
        id: `rollup-${discipline.toLowerCase().replace(/[^a-z]/g, "-")}`,
        itemName: `Scan2Plan ${discipline}`,
        description: `${discipline} modeling services for ${uniqueAreas.length > 1 ? `${uniqueAreas.length} areas` : uniqueAreas[0] || "project"}. Total ${group.totalQty.toLocaleString()} sqft at avg $${avgRate.toFixed(2)}/sqft.`,
        qty: group.totalQty,
        rate: Math.round(avgRate * 100) / 100,
        amount: Math.round(group.totalAmount * 100) / 100,
      });
    }
  });

  return consolidated;
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

  const handleRollupToggle = useCallback(
    (checked: boolean) => {
      const newSettings: ProposalDisplaySettings = {
        ...proposal.displaySettings,
        rollupByDiscipline: checked,
      };
      onUpdate({ displaySettings: newSettings });
    },
    [proposal.displaySettings, onUpdate]
  );

  // Get display line items (rolled up or original based on setting)
  const displayLineItems = useMemo(() => {
    if (proposal.displaySettings?.rollupByDiscipline) {
      return rollupLineItemsByDiscipline(proposal.lineItems);
    }
    return proposal.lineItems;
  }, [proposal.lineItems, proposal.displaySettings?.rollupByDiscipline]);

  // Trigger save on blur
  const handleBlur = useCallback(() => {
    debouncedSave({
      coverData: proposal.coverData,
      projectData: proposal.projectData,
      lineItems: proposal.lineItems,
      paymentData: proposal.paymentData,
      displaySettings: proposal.displaySettings,
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
      displaySettings: proposal.displaySettings,
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
        <div className="flex items-center gap-4">
          {/* Rollup Toggle */}
          <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
            <Switch
              id="rollup-toggle"
              checked={proposal.displaySettings?.rollupByDiscipline ?? false}
              onCheckedChange={handleRollupToggle}
              disabled={disabled}
            />
            <Label htmlFor="rollup-toggle" className="text-sm text-gray-600 cursor-pointer">
              Rollup by Discipline
            </Label>
          </div>
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
            size="sm"
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending || disabled}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md"
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

          {/* Pages 4-5: Estimate Table */}
          <div className="shadow-lg">
            <ProposalEstimateTable
              lineItems={displayLineItems}
              onChange={handleLineItemsChange}
              onBlur={handleBlur}
              clientName={proposal.coverData.clientName}
              projectAddress={proposal.coverData.projectTitle}
              estimateNumber={`EST-${proposal.leadId}`}
              estimateDate={proposal.coverData.date}
              disabled={disabled || proposal.displaySettings?.rollupByDiscipline}
            />
            {proposal.displaySettings?.rollupByDiscipline && (
              <div className="bg-blue-50 border-t border-blue-200 p-3 text-sm text-blue-700">
                <strong>Rollup Mode:</strong> Line items are consolidated by discipline. Disable rollup to edit individual items.
              </div>
            )}
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
