/**
 * Deal Workspace - Unified Lead + Quote Builder
 * 
 * Combines lead CRM fields with inline CPQ quote builder.
 * Lead Details shown first with consolidated form (no sub-tabs).
 * Supports quote versioning within the quote builder.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calculator,
  ChevronDown,
  Cloud,
  DollarSign,
  ExternalLink,
  FileText,
  Folder,
  FolderCheck,
  FolderOpen,
  HardDrive,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import type { Lead, CpqQuote, DealAttribution, CpqCalculateRequest, CpqCalculateResponse, CpqApiArea } from "@shared/schema";
import { TOUCHPOINT_OPTIONS, TIER_A_THRESHOLD, CPQ_BUILDING_TYPES, CPQ_API_DISCIPLINES, CPQ_API_LODS, CPQ_API_SCOPES, CPQ_API_RISKS, CPQ_API_DISPATCH_LOCATIONS, CPQ_PAYMENT_TERMS, CPQ_PAYMENT_TERMS_DISPLAY } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useCreateLead, useUpdateLead } from "@/hooks/use-leads";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Brain, Paperclip, Download, Eye, Link2, Copy, CheckCircle2, ChevronRight, Activity } from "lucide-react";
import type { LeadDocument } from "@shared/schema";
import { SendProposalDialog } from "@/components/SendProposalDialog";
import { Slider } from "@/components/ui/slider";
import {
  calculatePricing,
  type Area as PricingArea,
  type TravelConfig,
  type PricingResult
} from "@/features/cpq/pricing";
import { FY26_GOALS } from "@shared/businessGoals";
import { SITE_READINESS_QUESTIONS, type SiteReadinessQuestion } from "@shared/siteReadinessQuestions";
import { QboEstimateBadge, TierAEstimatorCard, MarketingInfluenceWidget, DocumentsTab, ProposalTab, LeadDetailsTab, QuoteBuilderTab } from "@/features/deals/components";
import { EngagementTab } from "@/features/deals/components/EngagementTab";

import { CpqImportModal } from "@/features/cpq/CpqImportModal";
import type { MappedConfiguratorData, CpqExportData } from "@/features/cpq/cpqImportUtils";
import { EnrollSequenceDialog } from "@/features/sequences/components/EnrollSequenceDialog";

import { leadFormSchema, type LeadFormData, BUYER_PERSONAS } from "@/features/deals/types";

// Shared state types for syncing between Simple and Advanced modes
export interface SharedArea {
  id: string;
  name: string;
  buildingType: string;
  squareFeet: string;
  lod: string;
  scope: string;
  disciplines: string[];
  expanded?: boolean;
}

export interface SharedLandscape {
  include: boolean;
  type: "built" | "natural";
  acres: string;
  lod: string;
}

export interface SharedQuoteConfig {
  areas: SharedArea[];
  landscape: SharedLandscape;
  projectLocation: string;
}

// QuoteBuilderTab extracted to client/src/features/deals/components/QuoteBuilderTab.tsx

// Default lead object for "New Deal" mode to prevent crashes
const defaultLead: Partial<Lead> = {
  clientName: "New Deal",
  projectName: "",
  projectAddress: "",
  dealStage: "Leads",
  leadPriority: 3,
  value: undefined,
  sqft: 0,
  probability: 20,
  quoteNumber: null,
  quoteUrl: null,
  quoteVersion: null,
  gcsBucket: null,
  gcsPath: null,
  driveFolderUrl: null,
  projectCode: null,
  buyerPersona: null
};

export default function DealWorkspace() {
  const params = useParams<{ id: string }>();
  const isNewLead = params.id === "new";
  // Use parseInt to safely extract numeric ID, ignoring any query string that might be attached
  const leadId = !isNewLead && params.id ? parseInt(params.id.split("?")[0], 10) : NaN;
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const validTabs = isNewLead
      ? ["lead"]
      : ["lead", "quote", "ai", "documents", "proposal", "engagement"];
    const urlParams = new URLSearchParams(window.location.search);
    const tabFromUrl = urlParams.get("tab");
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      return tabFromUrl;
    }
    return "lead";
  });
  const { toast } = useToast();
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [showCpqImportModal, setShowCpqImportModal] = useState(false);
  const [importedCpqData, setImportedCpqData] = useState<MappedConfiguratorData | null>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);

  // Shared quote configuration state - synced between Simple and Advanced modes
  const [sharedConfig, setSharedConfig] = useState<SharedQuoteConfig>({
    areas: [{
      id: "1",
      name: "Main Building",
      buildingType: "4",
      squareFeet: "",
      lod: "300",
      scope: "full",
      disciplines: ["architecture"],
      expanded: true,
    }],
    landscape: {
      include: true,
      type: "built",
      acres: "",
      lod: "300",
    },
    projectLocation: "",
  });

  // Helper to update shared areas
  const updateSharedAreas = useCallback((areas: SharedArea[]) => {
    setSharedConfig(prev => ({ ...prev, areas }));
  }, []);

  // Helper to update shared landscape
  const updateSharedLandscape = useCallback((landscape: SharedLandscape) => {
    setSharedConfig(prev => ({ ...prev, landscape }));
  }, []);

  // Helper to update project location
  const updateSharedLocation = useCallback((projectLocation: string) => {
    setSharedConfig(prev => ({ ...prev, projectLocation }));
  }, []);

  // Memoize normalized areas to prevent infinite re-renders
  const normalizedAreas = useMemo(() =>
    sharedConfig.areas.map(a => ({ ...a, expanded: a.expanded ?? false })),
    [sharedConfig.areas]
  );

  const handleTabChange = (value: string) => {
    const validTabs = isNewLead
      ? ["lead"]
      : ["lead", "quote", "ai", "documents", "proposal", "engagement"];
    setActiveTab(validTabs.includes(value) ? value : "lead");
  };
  const queryClient = useQueryClient();
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();

  const { data: fetchedLead, isLoading: leadLoading, isError, error } = useQuery<Lead>({
    queryKey: ["/api/leads", leadId],
    enabled: !isNaN(leadId) && leadId > 0,
  });

  // ALL useQuery hooks must be called BEFORE any conditional returns (Rules of Hooks)
  const { data: quotes, isLoading: quotesLoading } = useQuery<CpqQuote[]>({
    queryKey: ["/api/leads", leadId, "cpq-quotes"],
    enabled: !isNaN(leadId) && leadId > 0,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery<LeadDocument[]>({
    queryKey: ["/api/leads", leadId, "documents"],
    enabled: !isNaN(leadId) && leadId > 0,
  });

  const { data: proposalEmails } = useQuery<{
    id: number;
    leadId: number;
    quoteId: number | null;
    token: string;
    recipientEmail: string;
    recipientName: string | null;
    subject: string | null;
    sentAt: string;
    firstOpenedAt: string | null;
    lastOpenedAt: string | null;
    openCount: number;
    clickCount: number;
  }[]>({
    queryKey: ["/api/leads", leadId, "proposal-emails"],
    enabled: !isNaN(leadId) && leadId > 0,
  });

  const lead = (isNewLead ? defaultLead : fetchedLead) as Lead;
  const latestQuote = quotes?.find((q) => q.isLatest);

  // Initialize shared config from lead data when lead loads (only if not already set)
  useEffect(() => {
    if (lead) {
      setSharedConfig(prev => {
        const updates: Partial<SharedQuoteConfig> = {};

        // Set project location from lead's project address if not already set
        if (!prev.projectLocation && lead.projectAddress) {
          updates.projectLocation = lead.projectAddress;
        }

        // Set first area's name from lead's project name if it's still the default
        if (prev.areas.length > 0 && prev.areas[0].name === "Main Building" && lead.projectName) {
          updates.areas = prev.areas.map((area, index) =>
            index === 0 ? { ...area, name: lead.projectName || area.name } : area
          );
        }

        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    }
  }, [lead]);

  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/leads/${leadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/trash"] });
      toast({
        title: "Deal Moved to Trash",
        description: "The deal has been moved to trash and will be permanently deleted after 60 days."
      });
      setLocation("/sales");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete deal",
        variant: "destructive"
      });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/leads/${leadId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "documents"] });
      toast({ title: "Document Uploaded", description: "File has been uploaded successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "documents"] });
      toast({ title: "Document Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Site Readiness Magic Link state
  const [siteReadinessAnswers, setSiteReadinessAnswers] = useState<Record<string, any>>({});
  const [questionsToSend, setQuestionsToSend] = useState<string[]>([]);
  const [generatedMagicLink, setGeneratedMagicLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Initialize site readiness answers from lead data
  // CEO sees their internal answers only - client answers are shown separately if completed
  // Reset state when lead changes to prevent cross-lead data contamination
  useEffect(() => {
    if (lead?.siteReadiness) {
      const structured = lead.siteReadiness as { internal?: Record<string, any>; client?: Record<string, any> };
      // Only load internal (CEO) answers for editing - don't merge with client to avoid overwriting
      setSiteReadinessAnswers(structured.internal || {});
    } else {
      // Reset to empty when lead has no site readiness data
      setSiteReadinessAnswers({});
    }
    if (lead?.siteReadinessQuestionsSent) {
      setQuestionsToSend(lead.siteReadinessQuestionsSent as string[]);
    } else {
      // Reset to empty when no questions were sent
      setQuestionsToSend([]);
    }
    // Reset magic link state when lead changes
    setGeneratedMagicLink(null);
    setLinkCopied(false);
  }, [leadId, lead?.siteReadiness, lead?.siteReadinessQuestionsSent]);

  // Get client-submitted answers for display (read-only)
  const clientSubmittedAnswers = useMemo(() => {
    if (!lead?.siteReadiness) return {};
    const structured = lead.siteReadiness as { internal?: Record<string, any>; client?: Record<string, any> };
    return structured.client || {};
  }, [lead?.siteReadiness]);

  // Save site readiness answers to persist CEO-entered data (stores in internal segment)
  const saveSiteReadinessMutation = useMutation({
    mutationFn: async () => {
      // Get existing structured data and update internal segment
      const existing = (lead?.siteReadiness as { internal?: Record<string, any>; client?: Record<string, any> }) || {};
      const structuredAnswers = {
        internal: { ...(existing.internal || {}), ...siteReadinessAnswers },
        client: existing.client || {},
      };
      return updateMutation.mutateAsync({
        id: leadId,
        siteReadiness: structuredAnswers,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({ title: "Answers Saved", description: "Site readiness answers have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateMagicLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/leads/${leadId}/site-readiness-link`, {
        questionIds: questionsToSend,
        siteReadiness: siteReadinessAnswers,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate link");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedMagicLink(data.magicLink);
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({
        title: "Magic Link Generated",
        description: `Link valid for 7 days. ${data.questionsCount} questions sent to client.`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleQuestionToSend = (questionId: string, checked: boolean) => {
    setQuestionsToSend(prev =>
      checked ? [...prev, questionId] : prev.filter(id => id !== questionId)
    );
  };

  const updateSiteReadinessAnswer = (questionId: string, value: any) => {
    setSiteReadinessAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const copyMagicLink = async () => {
    if (generatedMagicLink) {
      await navigator.clipboard.writeText(generatedMagicLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const pushToQboMutation = useMutation({
    mutationFn: async (forceResync: boolean = false) => {
      if (!latestQuote?.id) throw new Error("No quote to push");
      const response = await apiRequest("POST", "/api/quickbooks/estimate", {
        quoteId: latestQuote.id,
        contactEmail: lead?.contactEmail || lead?.billingContactEmail,
        forceResync,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create estimate");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/estimate-url", leadId] });
      toast({
        title: "Estimate Created",
        description: `QuickBooks estimate ${data.estimateNumber} created successfully.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to push to QuickBooks",
        variant: "destructive"
      });
    },
  });

  const sendProposalMutation = useMutation({
    mutationFn: async ({ recipientEmail, customSubject }: { recipientEmail: string; customSubject: string }) => {
      if (!leadId) throw new Error("No lead ID");
      const response = await apiRequest("POST", "/api/google/gmail/send-proposal", {
        leadId,
        recipientEmail,
        customSubject,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send proposal email");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setShowProposalDialog(false);
      toast({
        title: "Proposal Sent",
        description: `Proposal email sent to ${data.sentTo}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send proposal email",
        variant: "destructive"
      });
    },
  });


  // Check QuickBooks connection status
  const { data: qboStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/quickbooks/estimate-url", leadId],
    enabled: !!leadId,
    staleTime: 60000,
  });

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      clientName: "",
      projectName: "",
      projectAddress: "",
      value: undefined,
      dealStage: "",
      probability: undefined,
      notes: "",
      quoteNumber: "",
      timeline: "",
      paymentTerms: "",
      leadSource: "",
      leadPriority: undefined,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      billingContactName: "",
      billingContactEmail: "",
      billingContactPhone: "",
      projectStatus: {
        proposalPhase: false,
        inHand: false,
        urgent: false,
        other: false,
        otherText: "",
      },
      proofLinks: "",
      missingInfo: [],
    },
  });

  useEffect(() => {
    if (lead) {
      const projectStatus = (lead as any).projectStatus || {};
      form.reset({
        clientName: lead.clientName ?? "",
        projectName: lead.projectName ?? "",
        projectAddress: lead.projectAddress ?? "",
        value: lead.value !== null && lead.value !== undefined ? Number(lead.value) : undefined,
        dealStage: lead.dealStage ?? "",
        probability: lead.probability ?? undefined,
        notes: lead.notes ?? "",
        quoteNumber: lead.quoteNumber ?? "",
        timeline: lead.timeline ?? "",
        paymentTerms: lead.paymentTerms ?? "",
        leadSource: lead.leadSource ?? "",
        leadPriority: lead.leadPriority ?? undefined,
        contactName: lead.contactName ?? "",
        contactEmail: lead.contactEmail ?? "",
        contactPhone: lead.contactPhone ?? "",
        billingContactName: (lead as any).billingContactName ?? "",
        billingContactEmail: (lead as any).billingContactEmail ?? "",
        billingContactPhone: (lead as any).billingContactPhone ?? "",
        buyerPersona: lead.buyerPersona ?? "",
        projectStatus: {
          proposalPhase: projectStatus.proposalPhase || false,
          inHand: projectStatus.inHand || false,
          urgent: projectStatus.urgent || false,
          other: projectStatus.other || false,
          otherText: projectStatus.otherText || "",
        },
        proofLinks: (lead as any).proofLinks ?? "",
        missingInfo: (lead as any).missingInfo ?? [],
      });
    }
  }, [lead, form]);

  // Warn user about unsaved changes before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.formState.isDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S or Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeTab === 'lead' && form.formState.isDirty) {
          form.handleSubmit(onSubmit)();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, form]);

  async function onSubmit(data: LeadFormData) {
    try {
      if (isNewLead) {
        const created = await createMutation.mutateAsync(data as any);
        // Pre-populate cache to prevent blank screen/loading on redirect
        queryClient.setQueryData(["/api/leads", created.id], created);
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });

        toast({ title: "Success", description: "Deal created successfully" });
        setLocation(`/deals/${created.id}`);
        return;
      }

      await updateMutation.mutateAsync({ id: leadId, ...data });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Success", description: "Deal updated successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  }

  if (leadLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center gap-4 p-4 border-b">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 flex-1" />
        </header>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-destructive">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Deal</h2>
        <p className="text-muted-foreground mb-4">
          {(error as Error)?.message || "An unexpected error occurred"}
        </p>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!lead && !isNewLead) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Lead Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested deal could not be found.</p>
        <Button onClick={() => setLocation("/sales")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pipeline
        </Button>
      </div>
    );
  }

  const isPending = isNewLead ? createMutation.isPending : updateMutation.isPending;

  // Helper function to get files status badge info
  const getFilesStatus = () => {
    const status = (lead as any).driveFolderStatus;
    if (!lead.driveFolderId && !lead.driveFolderUrl) {
      return { color: "bg-muted text-muted-foreground", label: "No Folder", icon: Folder };
    }
    if (status === "files_uploaded" || status === "active") {
      return { color: "bg-green-500/20 text-green-600 border-green-500/30", label: "Files Uploaded", icon: FolderCheck };
    }
    // Default: folder created but empty
    return { color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30", label: "Folder Empty", icon: FolderOpen };
  };

  const filesStatus = getFilesStatus();

  // Helper function to get storage links based on storage mode
  const getStorageLinks = () => {
    const storageMode = (lead as any).storageMode || "legacy_drive";
    const gcsBucket = (lead as any).gcsBucket;
    const gcsPath = (lead as any).gcsPath;
    const driveFolderUrl = lead.driveFolderUrl;

    const gcsConsoleUrl = gcsBucket && gcsPath
      ? `https://console.cloud.google.com/storage/browser/${gcsBucket}/${gcsPath}`
      : null;

    switch (storageMode) {
      case "hybrid_gcs":
        return {
          mode: "hybrid",
          primary: gcsConsoleUrl ? { url: gcsConsoleUrl, label: "Scan Data (GCS)", icon: Cloud } : null,
          secondary: driveFolderUrl ? { url: driveFolderUrl, label: "Docs Folder (Drive)", icon: HardDrive } : null,
        };
      case "gcs_native":
        return {
          mode: "gcs",
          primary: gcsConsoleUrl ? { url: gcsConsoleUrl, label: "Project Files (GCS)", icon: Cloud } : null,
          secondary: null,
        };
      default: // legacy_drive
        return {
          mode: "drive",
          primary: driveFolderUrl
            ? { url: driveFolderUrl, label: "Drive Folder", icon: HardDrive }
            : null,
          secondary: null,
        };
    }
  };

  const storageLinks = lead.projectCode ? getStorageLinks() : null;

  // Google Static Maps URL for header thumbnail (16:9 aspect ratio)
  const getStaticMapUrl = (address: string) => {
    if (!address || address.length < 5) return null;
    return `/api/location/static-map?address=${encodeURIComponent(address)}&size=320x180&zoom=18&maptype=satellite`;
  };

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="page-deal-workspace">
      <header className="flex items-center justify-between gap-4 p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/sales")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Google Maps Satellite Thumbnail - 16:9 aspect ratio */}
          {lead.projectAddress && lead.projectAddress.length >= 5 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.projectAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <div className="w-32 h-[72px] rounded-md overflow-hidden border bg-muted">
                    <img
                      src={getStaticMapUrl(lead.projectAddress) || ""}
                      alt="Project location"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-6 h-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" /></svg></div>';
                      }}
                      data-testid="img-location-thumbnail"
                    />
                  </div>
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>View on Google Maps</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="w-32 h-[72px] rounded-md border bg-muted flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-muted-foreground" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{lead.clientName}</h1>
              {lead.projectCode && (
                <Badge variant="outline" className="font-mono text-xs">
                  {lead.projectCode}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{lead.projectName || lead.projectAddress}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Generate Estimate in QuickBooks Button */}
          {latestQuote && qboStatus?.connected && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
              onClick={() => pushToQboMutation.mutate(!!lead.qboEstimateId)}
              disabled={pushToQboMutation.isPending}
              data-testid="button-generate-qbo-estimate"
            >
              {pushToQboMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="w-4 h-4 mr-2" />
              )}
              {lead.qboEstimateId ? "Sync to QuickBooks" : "Generate Estimate in QuickBooks"}
            </Button>
          )}

          {/* Enroll in Sequence Button */}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setShowEnrollDialog(true)}
            data-testid="button-enroll-sequence"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Enroll</span>
          </Button>

          {/* Files Status Badge - Always show to indicate folder state */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Badge
                  variant="outline"
                  className={`gap-1 ${filesStatus.color}`}
                  data-testid="badge-files-status"
                >
                  {filesStatus.label === "No Folder" && <Folder className="w-3 h-3" />}
                  {filesStatus.label === "Files Uploaded" && <FolderCheck className="w-3 h-3" />}
                  {filesStatus.label === "Folder Empty" && <FolderOpen className="w-3 h-3" />}
                  {filesStatus.label}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Google Drive folder status</p>
            </TooltipContent>
          </Tooltip>

          {lead.projectCode && storageLinks ? (
            storageLinks.mode === "hybrid" && storageLinks.secondary ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge variant="secondary" className="gap-1 cursor-pointer" data-testid="dropdown-storage-links">
                    <Cloud className="w-3 h-3" />
                    Open Folder
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {storageLinks.primary && (
                    <DropdownMenuItem asChild>
                      <a
                        href={storageLinks.primary.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                        data-testid="link-gcs-folder"
                      >
                        <Cloud className="w-4 h-4" />
                        {storageLinks.primary.label}
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <a
                      href={storageLinks.secondary.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                      data-testid="link-drive-folder"
                    >
                      <HardDrive className="w-4 h-4" />
                      {storageLinks.secondary.label}
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={storageLinks.primary?.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                    data-testid="link-drive-folder"
                  >
                    <Badge variant="secondary" className="gap-1 cursor-pointer">
                      {storageLinks.mode === "gcs" ? <Cloud className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                      {storageLinks.primary?.label || "Open Folder"}
                    </Badge>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open project folder for {lead.projectCode}</p>
                </TooltipContent>
              </Tooltip>
            )
          ) : null}
          <Badge variant="outline" className="text-xs">
            {lead.dealStage}
          </Badge>
          {/* Tier A Badge - Auto-flagged for large projects */}
          {(lead.sqft && lead.sqft >= TIER_A_THRESHOLD) || lead.abmTier === "Tier A" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="gap-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30" data-testid="badge-tier-a">
                  <Star className="w-3 h-3 fill-current" />
                  Tier A
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Large project ({(lead.sqft || 0).toLocaleString()} sqft) - estimator card recommended for better proposal accuracy</p>
              </TooltipContent>
            </Tooltip>
          ) : null}
          {lead.value && (
            <Badge variant="secondary">
              ${Number(lead.value).toLocaleString()}
            </Badge>
          )}
          {/* QuickBooks Sync Status */}
          <QboEstimateBadge lead={lead} />

          {/* Delete Button - Standalone with Confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                data-testid="button-delete-deal"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{lead.clientName}" will be moved to trash. You can restore it within 60 days. After that, it will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteLeadMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                >
                  {deleteLeadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Move to Trash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 bg-card/30">
          <TabsList className="h-11 bg-transparent">
            <TabsTrigger value="lead" className="gap-2" data-testid="tab-lead">
              <FileText className="w-4 h-4" />
              Lead Details
            </TabsTrigger>
            {isNewLead ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <TabsTrigger value="quote" className="gap-2" disabled>
                      <Calculator className="w-4 h-4" />
                      Quote Builder
                    </TabsTrigger>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save the deal first to create a quote</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <TabsTrigger value="quote" className="gap-2" data-testid="tab-quote">
                <Calculator className="w-4 h-4" />
                Quote Builder
              </TabsTrigger>
            )}

            {isNewLead ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <TabsTrigger value="proposal" className="gap-2" disabled>
                      <Brain className="w-4 h-4" />
                      Proposal
                    </TabsTrigger>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save the deal first to generate a proposal</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <TabsTrigger value="proposal" className="gap-2" data-testid="tab-proposal">
                <Brain className="w-4 h-4" />
                Proposal
              </TabsTrigger>
            )}
            {isNewLead ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <TabsTrigger value="documents" className="gap-2" disabled>
                      <Paperclip className="w-4 h-4" />
                      Documents
                    </TabsTrigger>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save the deal first to upload documents</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
                <Paperclip className="w-4 h-4" />
                Documents
              </TabsTrigger>
            )}

            {isNewLead ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <TabsTrigger value="engagement" className="gap-2" disabled>
                      <Activity className="w-4 h-4" />
                      Engagement
                    </TabsTrigger>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save the deal first to track engagement</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <TabsTrigger value="engagement" className="gap-2" data-testid="tab-engagement">
                <Activity className="w-4 h-4" />
                Engagement
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Lead Details Tab - Consolidated form with bordered sections */}
        <TabsContent value="lead" className="flex-1 overflow-auto m-0">
          <ErrorBoundary fallbackTitle="Lead Details Error" fallbackMessage="Failed to load lead details. Please try refreshing.">
            <LeadDetailsTab
              lead={lead}
              leadId={leadId}
              form={form}
              onSubmit={onSubmit}
              isPending={isPending}
              queryClient={queryClient}
              updateMutation={updateMutation}
              createMutation={createMutation}
              toast={toast}
              documents={documents}
              uploadDocumentMutation={uploadDocumentMutation}
            />
          </ErrorBoundary>
        </TabsContent>

        {/* Quote Builder Tab */}
        <TabsContent value="quote" className="flex-1 overflow-auto m-0">
          {/* Import CPQ Button */}
          <div className="flex items-center justify-end p-3 border-b bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCpqImportModal(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import from CPQ
            </Button>
          </div>

          {/* Conditional Content */}
          <ErrorBoundary fallbackTitle="Quote Builder Error" fallbackMessage="Failed to load quote builder. Please try refreshing.">
            <QuoteBuilderTab
              lead={lead}
              leadId={leadId}
              existingQuotes={quotes}
            />
          </ErrorBoundary>
        </TabsContent>

        {/* Proposal Tab - Evidence Vault + AI Assistant */}
        <TabsContent value="proposal" className="flex-1 overflow-auto m-0">
          <ErrorBoundary fallbackTitle="Proposal Tab Error" fallbackMessage="Failed to load proposal section. Please try refreshing.">
            <ProposalTab lead={lead} />
          </ErrorBoundary>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="flex-1 overflow-auto m-0">
          <ErrorBoundary fallbackTitle="Documents Tab Error" fallbackMessage="Failed to load documents. Please try refreshing.">
            <DocumentsTab
              documents={documents}
              documentsLoading={documentsLoading}
              uploadDocumentMutation={uploadDocumentMutation}
              deleteDocumentMutation={deleteDocumentMutation}
            />
          </ErrorBoundary>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="flex-1 overflow-auto m-0">
          <ErrorBoundary fallbackTitle="Engagement Tab Error" fallbackMessage="Failed to load engagement tracking. Please try refreshing.">
            <EngagementTab leadId={leadId} />
          </ErrorBoundary>
        </TabsContent>

      </Tabs>

      {lead && latestQuote && (
        <SendProposalDialog
          open={showProposalDialog}
          onOpenChange={setShowProposalDialog}
          leadId={leadId}
          projectName={lead.projectName || ""}
          clientName={lead.clientName}
          contactName={lead.contactName || undefined}
          contactEmail={lead.contactEmail || undefined}
          billingContactName={lead.billingContactName || undefined}
          billingContactEmail={lead.billingContactEmail || undefined}
          quoteTotal={latestQuote.totalPrice ? Number(latestQuote.totalPrice) : undefined}
          onSend={(email, subject) => sendProposalMutation.mutate({ recipientEmail: email, customSubject: subject })}
          isSending={sendProposalMutation.isPending}
        />
      )}

      <EnrollSequenceDialog
        leadId={leadId}
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
      />

      {/* CPQ Import Modal */}
      <CpqImportModal
        open={showCpqImportModal}
        onOpenChange={setShowCpqImportModal}
        onImport={(data, rawData) => {
          setImportedCpqData(data);
          setShowCpqImportModal(false);
        }}
      />
    </div>
  );
}
