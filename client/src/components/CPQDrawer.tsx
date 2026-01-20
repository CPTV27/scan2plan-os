import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, RefreshCw, X, History, Plus, Clock, FileDown, Calculator } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Lead, QuoteVersion, CpqArea, CpqTravel } from "@shared/schema";
import { format } from "date-fns";

// CPQ URL must be configured via environment variable - no hardcoded fallback for security
const CPQ_BASE_URL = import.meta.env.VITE_CPQ_URL;

interface CpqScopingPayload {
  type: "CPQ_SCOPING_PAYLOAD";
  leadId: number;
  projectDetails: {
    clientName: string;
    projectName: string;
    projectAddress: string;
    specificBuilding?: string;
    typeOfBuilding?: string;
    hasBasement?: boolean;
    hasAttic?: boolean;
    notes?: string;
  };
  company: string;
  project: string;
  address: string;
  version: number;
  mode: "new" | "edit";
  areas: CpqArea[];
  risks: string[];
  travel: CpqTravel | null;
  services: Record<string, number>;
  scopingData: Record<string, unknown>;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  billingContact: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
}

interface CPQDrawerProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PriceSnapshot {
  total?: number;
  labor?: number;
  travel?: number;
  equipment?: number;
  lineItems?: Array<{ name: string; amount: number }>;
}

export function CPQDrawer({ lead, open, onOpenChange }: CPQDrawerProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [key, setKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"quote" | "versions">("quote");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const wasOpenRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch quote versions for this lead
  const { data: versions = [], isLoading: versionsLoading } = useQuery<QuoteVersion[]>({
    queryKey: ["/api/leads", lead?.id, "quote-versions"],
    enabled: !!lead?.id && open,
  });

  // Create new version mutation
  const createVersionMutation = useMutation({
    mutationFn: async (): Promise<QuoteVersion> => {
      const response = await apiRequest(`/api/leads/${lead?.id}/quote-versions`, "POST", {
        summary: `Version ${(lead?.quoteVersion || 0) + 1} - Edit in progress`,
      });
      return response.json();
    },
    onSuccess: (newVersion: QuoteVersion) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id, "quote-versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setSelectedVersion(newVersion.versionNumber);
      setActiveTab("quote");
    },
  });

  const getCPQUrl = (version?: number) => {
    if (!lead) return "";
    
    // Build params object, only including non-empty values
    const paramData: Record<string, string> = {
      leadId: lead.id.toString(),
      company: lead.clientName,
    };
    
    // Add optional fields if they have values
    if (lead.projectName) paramData.project = lead.projectName;
    if (lead.projectAddress) paramData.address = lead.projectAddress;
    if (lead.buildingType) paramData.buildingType = lead.buildingType;
    if (lead.sqft) paramData.sqft = lead.sqft.toString();
    if (lead.scope) paramData.scope = lead.scope;
    if (lead.disciplines) paramData.disciplines = lead.disciplines;
    if (lead.contactName) paramData.contactName = lead.contactName;
    if (lead.contactEmail) paramData.contactEmail = lead.contactEmail;
    if (lead.contactPhone) paramData.contactPhone = lead.contactPhone;
    if (lead.dispatchLocation) paramData.dispatchLocation = lead.dispatchLocation;
    if (lead.distance) paramData.distance = lead.distance.toString();
    
    // Add version info for editing existing quotes
    if (version) {
      paramData.version = version.toString();
      paramData.mode = "edit";
    }
    
    const params = new URLSearchParams(paramData);
    
    // If editing a specific version with its URL, use that
    if (version) {
      const versionData = versions.find(v => v.versionNumber === version);
      if (versionData?.quoteUrl) {
        const separator = versionData.quoteUrl.includes("?") ? "&" : "?";
        return `${versionData.quoteUrl}${separator}${params.toString()}`;
      }
    }
    
    // If lead has a quote URL, use it
    if (lead.quoteUrl) {
      const separator = lead.quoteUrl.includes("?") ? "&" : "?";
      return `${lead.quoteUrl}${separator}${params.toString()}`;
    }
    
    return `${CPQ_BASE_URL}/calculator?${params.toString()}`;
  };

  // Send prefill data via postMessage when CPQ signals ready
  const sendPrefillData = () => {
    if (!lead || !iframeRef.current?.contentWindow) return;
    
    // Assemble complete CPQ scoping payload from lead data
    const cpqAreas = (lead.cpqAreas && Array.isArray(lead.cpqAreas)) 
      ? lead.cpqAreas as CpqArea[] 
      : [];
    const cpqRisks = (lead.cpqRisks && Array.isArray(lead.cpqRisks)) 
      ? lead.cpqRisks as string[] 
      : [];
    const cpqTravel = (lead.cpqTravel && typeof lead.cpqTravel === 'object') 
      ? lead.cpqTravel as CpqTravel 
      : null;
    const cpqServices = (lead.cpqServices && typeof lead.cpqServices === 'object') 
      ? lead.cpqServices as Record<string, number> 
      : {};
    const cpqScopingData = (lead.cpqScopingData && typeof lead.cpqScopingData === 'object') 
      ? lead.cpqScopingData as Record<string, unknown> 
      : {};
    
    // Extract billing contact from scopingData
    const billingContactName = (cpqScopingData as any)?.billingContactName || "";
    const billingContactEmail = (cpqScopingData as any)?.billingContactEmail || "";
    const billingContactPhone = (cpqScopingData as any)?.billingContactPhone || "";
    const billingAddress = (cpqScopingData as any)?.billingAddress || "";

    // Build projectDetails with only defined optional fields to avoid overwriting CPQ state
    const projectDetails: CpqScopingPayload["projectDetails"] = {
      clientName: lead.clientName,
      projectName: lead.projectName || "",
      projectAddress: lead.projectAddress || "",
    };
    
    // Only include optional fields if they have values (avoid false/empty overwrites)
    const specificBuilding = (cpqScopingData as any)?.specificBuilding;
    if (specificBuilding) projectDetails.specificBuilding = specificBuilding;
    
    if (lead.buildingType) projectDetails.typeOfBuilding = lead.buildingType;
    
    const hasBasement = (cpqScopingData as any)?.hasBasement;
    if (hasBasement !== undefined && hasBasement !== null) projectDetails.hasBasement = hasBasement;
    
    const hasAttic = (cpqScopingData as any)?.hasAttic;
    if (hasAttic !== undefined && hasAttic !== null) projectDetails.hasAttic = hasAttic;
    
    if (lead.notes) projectDetails.notes = lead.notes;

    // Send the full structured payload for multi-building CPQ integration
    const scopingPayload: CpqScopingPayload = {
      type: "CPQ_SCOPING_PAYLOAD",
      leadId: lead.id,
      projectDetails,
      company: lead.clientName,
      project: lead.projectName || "",
      address: lead.projectAddress || "",
      version: selectedVersion || lead.quoteVersion || 1,
      mode: selectedVersion ? "edit" : "new",
      areas: cpqAreas,
      risks: cpqRisks,
      travel: cpqTravel,
      services: cpqServices,
      scopingData: cpqScopingData,
      contact: {
        name: lead.contactName || "",
        email: lead.contactEmail || "",
        phone: lead.contactPhone || "",
      },
      billingContact: {
        name: billingContactName,
        email: billingContactEmail,
        phone: billingContactPhone,
        address: billingAddress,
      },
    };
    
    iframeRef.current.contentWindow.postMessage(scopingPayload, "*");
    
    // Also send legacy CPQ_PREFILL for backwards compatibility
    iframeRef.current.contentWindow.postMessage({
      type: "CPQ_PREFILL",
      leadId: lead.id,
      company: lead.clientName,
      project: lead.projectName || "",
      address: lead.projectAddress || "",
      buildingType: lead.buildingType || "",
      sqft: lead.sqft || null,
      scope: lead.scope || "",
      disciplines: lead.disciplines || "",
      contactName: lead.contactName || "",
      contactEmail: lead.contactEmail || "",
      contactPhone: lead.contactPhone || "",
      dispatchLocation: lead.dispatchLocation || "",
      distance: lead.distance || null,
      version: selectedVersion || lead.quoteVersion || 1,
      mode: selectedVersion ? "edit" : "new",
    }, "*");
  };

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setKey(prev => prev + 1);
      wasOpenRef.current = true;
      // Set selected version to current quote version when opening
      setSelectedVersion(lead?.quoteVersion || null);
    } else if (wasOpenRef.current) {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/profitability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      wasOpenRef.current = false;
    }
  }, [open, lead?.id, queryClient]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setLoadError(false);
    // Send prefill data after iframe loads as a backup
    setTimeout(() => sendPrefillData(), 500);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setLoadError(true);
  };

  // Set a timeout to detect if the iframe fails to load (e.g., connection refused)
  useEffect(() => {
    if (open && isLoading) {
      const timer = setTimeout(() => {
        if (isLoading) {
          setLoadError(true);
          setIsLoading(false);
        }
      }, 15000); // 15 second timeout
      return () => clearTimeout(timer);
    }
  }, [open, isLoading, key]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setLoadError(false);
    setKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    if (!CPQ_BASE_URL) return;
    window.open(getCPQUrl(selectedVersion || undefined), "_blank");
  };

  const handleSelectVersion = (versionNumber: number) => {
    setSelectedVersion(versionNumber);
    setActiveTab("quote");
    setIsLoading(true);
    setKey(prev => prev + 1);
  };

  const handleCreateNewVersion = () => {
    createVersionMutation.mutate();
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Derive allowed origins from configured CPQ URL
      if (!CPQ_BASE_URL) return;
      
      try {
        const cpqOrigin = new URL(CPQ_BASE_URL).origin;
        // Accept messages from the configured CPQ origin or any replit.app domain (for dev)
        const isAllowed = event.origin === cpqOrigin || event.origin.endsWith(".replit.app");
        
        if (!isAllowed) {
          console.debug(`CPQ message rejected from origin: ${event.origin}`);
          return;
        }
      } catch {
        console.warn("Invalid CPQ URL configured");
        return;
      }
      
      if (event.data?.type === "CPQ_READY") {
        // CPQ is ready, send prefill data
        sendPrefillData();
      }
      
      if (event.data?.type === "CPQ_QUOTE_SAVED") {
        // CPQ saved a quote - update the currently active version
        if (event.data.priceSnapshot && lead?.id) {
          // Find the version being edited (selected or current)
          const activeVersionNumber = selectedVersion || lead.quoteVersion || 1;
          const activeVersion = versions.find(v => v.versionNumber === activeVersionNumber);
          
          if (activeVersion) {
            apiRequest(`/api/leads/${lead.id}/quote-versions/${activeVersion.id}`, "PATCH", {
              priceSnapshot: event.data.priceSnapshot,
              quoteUrl: event.data.quoteUrl,
              cpqQuoteId: event.data.cpqQuoteId,
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id, "quote-versions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/profitability"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [queryClient, lead, versions, selectedVersion]);

  if (!lead) return null;

  const hasExistingQuote = !!lead.quoteUrl || versions.length > 0;
  const currentVersion = selectedVersion || lead.quoteVersion || 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <SheetTitle className="truncate">
                {hasExistingQuote ? "Edit Quote" : "Generate Quote"}
              </SheetTitle>
              {currentVersion && (
                <Badge variant="outline" className="font-mono flex-shrink-0">
                  V{currentVersion}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasExistingQuote && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveTab(activeTab === "versions" ? "quote" : "versions")}
                  title="Version History"
                  data-testid="button-cpq-versions"
                >
                  <History className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
                title="Refresh"
                data-testid="button-cpq-refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(`/api/leads/${lead.id}/estimate-pdf`, "_blank")}
                title="Download PDF Estimate"
                data-testid="button-cpq-pdf"
              >
                <FileDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenExternal}
                title="Open in new tab"
                data-testid="button-cpq-external"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                title="Close"
                data-testid="button-cpq-close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {lead.clientName} {lead.projectName && `- ${lead.projectName}`}
          </p>
        </SheetHeader>

        {hasExistingQuote && activeTab === "versions" ? (
          <div className="flex-1 overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Quote Versions</h3>
              <Button 
                size="sm" 
                onClick={handleCreateNewVersion}
                disabled={createVersionMutation.isPending}
                data-testid="button-create-version"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createVersionMutation.isPending ? "Creating..." : "New Version"}
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-3rem)]">
              {versionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No version history yet</p>
                  <p className="text-sm">Versions are saved when you save quotes in CPQ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => {
                    const snapshot = version.priceSnapshot as PriceSnapshot | null;
                    return (
                      <div
                        key={version.id}
                        className={`p-3 border rounded-md cursor-pointer hover-elevate ${
                          selectedVersion === version.versionNumber ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => handleSelectVersion(version.versionNumber)}
                        data-testid={`version-card-${version.versionNumber}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              V{version.versionNumber}
                            </Badge>
                            {version.versionNumber === lead.quoteVersion && (
                              <Badge variant="secondary" className="text-xs">Current</Badge>
                            )}
                          </div>
                          {snapshot?.total && (
                            <span className="font-medium text-green-600">
                              ${Number(snapshot.total).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>
                            {version.createdAt ? format(new Date(version.createdAt), "MMM d, yyyy h:mm a") : "Unknown"}
                          </span>
                          {version.createdBy && (
                            <span className="truncate">by {version.createdBy}</span>
                          )}
                        </div>
                        {version.summary && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {version.summary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 relative overflow-hidden">
            {!CPQ_BASE_URL ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calculator className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Create Quote</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the built-in pricing calculator to create a quote for this project.
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/sales/calculator/${lead?.id}`);
                    }} 
                    variant="default" 
                    data-testid="button-open-calculator"
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Open Calculator
                  </Button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading CPQ...</p>
                </div>
              </div>
            ) : loadError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">CPQ Connection Failed</h3>
                    <p className="text-sm text-muted-foreground">
                      Unable to connect to the CPQ tool. Use the embedded calculator or try again.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/sales/calculator/${lead?.id}`);
                      }} 
                      variant="default" 
                      data-testid="button-cpq-embedded-calculator"
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Open Embedded Calculator
                    </Button>
                    <div className="flex gap-2">
                      <Button onClick={handleRefresh} variant="outline" data-testid="button-cpq-retry">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                      <Button onClick={handleOpenExternal} variant="outline" data-testid="button-cpq-open-direct">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Directly
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                key={key}
                src={getCPQUrl(selectedVersion || undefined)}
                className="w-full h-full border-0"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="CPQ Calculator"
                allow="clipboard-write"
              />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
