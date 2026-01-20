import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  insertLeadSchema, 
  BUILDING_TYPES, 
  SCOPE_OPTIONS, 
  BIM_DELIVERABLES, 
  DISCIPLINE_OPTIONS,
  BUYER_PERSONAS,
  SOURCE_OPTIONS,
  REFERRAL_SOURCES,
  CPQ_PAYMENT_TERMS,
  CPQ_PAYMENT_TERMS_DISPLAY,
  type BuyerPersonaId,
} from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateLead, useUpdateLead } from "@/hooks/use-leads";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Briefcase, 
  Calculator, 
  Brain, 
  Trash2, 
  Loader2, 
  Building2, 
  DollarSign,
  Users,
  Mic,
  Square,
  MessageSquare,
  MapPin,
  Navigation,
  RefreshCw,
  Home
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GoogleIntel } from "@shared/schema";
import { LocationPreview } from "./LocationPreview";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { ContextHelp } from "./ContextHelp";

const formSchema = insertLeadSchema;
type FormData = z.infer<typeof formSchema>;

interface LeadFormProps {
  lead?: Lead;
  onSuccess?: () => void;
  onOpenCPQ?: () => void;
  onOpenResearch?: () => void;
  onOpenCommunication?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function LeadForm({ lead, onSuccess, onOpenCPQ, onOpenResearch, onOpenCommunication, onDelete, isDeleting }: LeadFormProps) {
  const { toast } = useToast();
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const [activeTab, setActiveTab] = useState("overview");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: lead ? {
      clientName: lead.clientName,
      projectName: lead.projectName || "",
      projectAddress: lead.projectAddress,
      value: Number(lead.value),
      dealStage: lead.dealStage,
      probability: lead.probability || 0,
      notes: lead.notes || "",
      quoteNumber: lead.quoteNumber || "",
      buildingType: lead.buildingType || "",
      sqft: lead.sqft || undefined,
      scope: lead.scope || "",
      disciplines: lead.disciplines || "",
      bimDeliverable: lead.bimDeliverable || "",
      bimVersion: lead.bimVersion || "",
      contactName: lead.contactName || "",
      contactEmail: lead.contactEmail || "",
      contactPhone: lead.contactPhone || "",
      dispatchLocation: lead.dispatchLocation || "",
      distance: lead.distance || undefined,
      travelRate: lead.travelRate ? Number(lead.travelRate) : undefined,
      timeline: lead.timeline || "",
      paymentTerms: lead.paymentTerms || "",
      leadSource: lead.leadSource || "",
      source: lead.source || "cold_outreach",
      referrerCompanyName: lead.referrerCompanyName || "",
      referrerContactName: lead.referrerContactName || "",
      leadPriority: lead.leadPriority || 3,
      cpqAreas: lead.cpqAreas as any,
      cpqRisks: lead.cpqRisks as any,
      cpqTravel: lead.cpqTravel as any,
      cpqServices: lead.cpqServices as any,
      cpqScopingData: lead.cpqScopingData as any,
    } : {
      clientName: "",
      projectName: "",
      projectAddress: "",
      value: undefined,
      dealStage: "",
      probability: undefined,
      notes: "",
      quoteNumber: "",
      buildingType: "",
      sqft: undefined,
      scope: "",
      disciplines: "",
      bimDeliverable: "",
      bimVersion: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      dispatchLocation: "",
      distance: undefined,
      travelRate: undefined,
      timeline: "",
      paymentTerms: "",
      leadSource: "",
      source: "",
      referrerCompanyName: "",
      referrerContactName: "",
      leadPriority: undefined,
      cpqAreas: [],
      cpqRisks: [],
      cpqTravel: {},
      cpqServices: {},
      cpqScopingData: {},
    },
  });

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const extractScopeMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/scoping/extract", {
        transcription: text,
        leadId: lead?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.scope) {
        const scope = data.scope;
        if (scope.sqft) form.setValue("sqft", scope.sqft);
        if (scope.buildingType) form.setValue("buildingType", scope.buildingType);
        if (scope.scope) form.setValue("scope", scope.scope);
        if (scope.disciplines) form.setValue("disciplines", scope.disciplines);
        if (scope.projectName) form.setValue("projectName", scope.projectName);
        if (scope.projectAddress) form.setValue("projectAddress", scope.projectAddress);
        if (scope.contactName) form.setValue("contactName", scope.contactName);
        if (scope.contactEmail) form.setValue("contactEmail", scope.contactEmail);
        if (scope.contactPhone) form.setValue("contactPhone", scope.contactPhone);
        if (scope.notes) {
          const existingNotes = form.getValues("notes") || "";
          form.setValue("notes", existingNotes ? `${existingNotes}\n\n---\nFrom call:\n${scope.notes}` : scope.notes);
        }
        toast({
          title: "Scope Extracted",
          description: "AI has filled in the scoping details from your call.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Extraction Failed",
        description: "Could not extract scope details from the recording.",
        variant: "destructive",
      });
    },
  });

  const refreshGoogleIntelMutation = useMutation({
    mutationFn: async () => {
      if (!lead?.id) throw new Error("No lead ID");
      const response = await apiRequest("POST", `/api/leads/${lead.id}/google-intel`, {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate both the list and detail queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
        if (lead?.id) {
          queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id] });
        }
        toast({
          title: "Google Intel Updated",
          description: "Building and travel data has been refreshed.",
        });
      } else {
        toast({
          title: "No Data Available",
          description: data.message || "Could not retrieve Google data for this address.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Could not refresh Google Intel data.",
        variant: "destructive",
      });
    },
  });

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser. Please use Chrome.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        }
      }
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        toast({
          title: "Recording Error",
          description: "There was an error with speech recognition.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setRecordingTime(0);
    setTranscript("");

    timerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const processTranscript = useCallback(() => {
    if (transcript.trim()) {
      extractScopeMutation.mutate(transcript);
    }
  }, [transcript, extractScopeMutation]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  async function onSubmit(data: FormData) {
    try {
      if (lead) {
        await updateMutation.mutateAsync({ id: lead.id, ...data });
        toast({ title: "Success", description: "Deal updated successfully" });
      } else {
        await createMutation.mutateAsync(data);
        toast({ title: "Success", description: "Deal created successfully" });
      }
      onSuccess?.();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Something went wrong", 
        variant: "destructive" 
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {lead && (onOpenCPQ || onOpenResearch || onDelete) && (
          <div className="flex items-center justify-between gap-2 pb-2 border-b">
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenCPQ && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenCPQ}
                  data-testid="button-cpq"
                >
                  <Calculator className="w-4 h-4 mr-1" />
                  {lead.quoteUrl ? "Edit Quote" : "Generate Quote"}
                </Button>
              )}
              {onOpenResearch && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenResearch}
                  data-testid="button-research"
                >
                  <Brain className="w-4 h-4 mr-1" />
                  AI Research
                </Button>
              )}
              {onOpenCommunication && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenCommunication}
                  data-testid="button-communication"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Communicate
                </Button>
              )}
            </div>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={onDelete}
                disabled={isDeleting}
                data-testid="button-delete-lead"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="h-[60vh] pr-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap w-full gap-1 mb-4">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <Building2 className="w-3 h-3 mr-1" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="financial" data-testid="tab-financial">
                <DollarSign className="w-3 h-3 mr-1" />
                Financial
              </TabsTrigger>
              <TabsTrigger value="contacts" data-testid="tab-contacts">
                <Users className="w-3 h-3 mr-1" />
                Contacts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-0">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {!isRecording ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={startRecording}
                          className="gap-2"
                          data-testid="button-start-voice-recording"
                        >
                          <Mic className="w-4 h-4" />
                          Record Scoping Call
                        </Button>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                            <span className="font-mono text-sm font-bold">{formatTime(recordingTime)}</span>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={stopRecording}
                            className="gap-2"
                            data-testid="button-stop-voice-recording"
                          >
                            <Square className="w-4 h-4" />
                            Stop
                          </Button>
                        </>
                      )}
                    </div>
                    {transcript && !isRecording && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={processTranscript}
                        disabled={extractScopeMutation.isPending}
                        className="gap-2"
                        data-testid="button-extract-scope"
                      >
                        {extractScopeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                        Extract Scope
                      </Button>
                    )}
                  </div>
                  {(isRecording || transcript) && (
                    <div className="mt-3 p-2 rounded bg-muted text-xs max-h-24 overflow-y-auto">
                      {transcript || <span className="text-muted-foreground italic">Listening...</span>}
                    </div>
                  )}
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client / Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Ashley McGraw Architects" {...field} data-testid="input-client-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="4900 Tank Trail, Roofs" {...field} value={field.value || ""} data-testid="input-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Address</FormLabel>
                    <FormControl>
                      <AddressAutocomplete
                        value={field.value || ""}
                        onChange={field.onChange}
                        onPlaceSelected={(formattedAddress) => {
                          form.setValue("projectAddress", formattedAddress, { shouldDirty: true });
                        }}
                        placeholder="Start typing address..."
                        data-testid="input-project-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <LocationPreview 
                address={form.watch("projectAddress") || ""} 
                companyName={form.watch("clientName")}
                buildingType={form.watch("buildingType") || undefined}
                onAddressUpdate={(formattedAddress) => {
                  form.setValue("projectAddress", formattedAddress);
                }}
              />

              {lead?.googleIntel && (lead.googleIntel as GoogleIntel).buildingInsights?.available ? (
                <div className="bg-muted/50 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5" />
                      Google Building Intel
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => refreshGoogleIntelMutation.mutate()}
                      disabled={refreshGoogleIntelMutation.isPending}
                      data-testid="button-refresh-google-intel"
                    >
                      {refreshGoogleIntelMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(lead.googleIntel as GoogleIntel).buildingInsights?.squareFeet && (
                      <div className="flex items-center gap-1.5">
                        <Square className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Roof Area:</span>
                        <span className="font-medium">{(lead.googleIntel as GoogleIntel).buildingInsights?.squareFeet?.toLocaleString()} SF</span>
                      </div>
                    )}
                    {(lead.googleIntel as GoogleIntel).buildingInsights?.maxRoofHeightFeet && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Height:</span>
                        <span className="font-medium">{(lead.googleIntel as GoogleIntel).buildingInsights?.maxRoofHeightFeet} ft</span>
                      </div>
                    )}
                  </div>
                  {(lead.googleIntel as GoogleIntel).travelInsights?.available && (
                    <div className="flex items-center gap-3 text-sm pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Navigation className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-medium">{(lead.googleIntel as GoogleIntel).travelInsights?.distanceMiles} mi</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Travel:</span>
                        <span className="font-medium">{(lead.googleIntel as GoogleIntel).travelInsights?.durationText}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {lead && !lead.googleIntel && form.watch("projectAddress") && (
                <div className="bg-muted/30 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Google Intel not loaded</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => refreshGoogleIntelMutation.mutate()}
                      disabled={refreshGoogleIntelMutation.isPending}
                      data-testid="button-fetch-google-intel"
                    >
                      {refreshGoogleIntelMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Fetch Building Data
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal Value ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probability (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" {...field} data-testid="input-probability" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dealStage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Stage</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-deal-stage">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Leads">Leads</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Proposal">Proposal</SelectItem>
                        <SelectItem value="Negotiation">Negotiation</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                        <SelectItem value="Closed Won">Closed Won</SelectItem>
                        <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="leadPriority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(parseInt(val))}
                      defaultValue={field.value !== undefined && field.value !== null ? String(field.value) : ""}
                    >
                        <FormControl>
                          <SelectTrigger data-testid="select-lead-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5">5 - Highest</SelectItem>
                          <SelectItem value="4">4 - High</SelectItem>
                          <SelectItem value="3">3 - Medium</SelectItem>
                          <SelectItem value="2">2 - Low</SelectItem>
                          <SelectItem value="1">1 - Lowest</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="buyerPersona"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Buyer Persona
                        <ContextHelp content="This selection controls the Automated Outreach Script. Choose 'Engineer' for technical/risk hooks, 'Architect' for design intent, or 'Developer' for financial/ROI hooks." />
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-buyer-persona">
                            <SelectValue placeholder="Select persona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(BUYER_PERSONAS).map(([id, label]) => (
                            <SelectItem key={id} value={id}>{id}: {label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Tailors communication style and templates
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {REFERRAL_SOURCES.includes(form.watch("source") as any) && (
                <div className="grid grid-cols-2 gap-4 p-3 border border-dashed rounded-md bg-muted/30">
                  <FormField
                    control={form.control}
                    name="referrerCompanyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referrer Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name" {...field} value={field.value || ""} data-testid="input-referrer-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="referrerContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referrer Contact</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact name" {...field} value={field.value || ""} data-testid="input-referrer-contact" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional details..." {...field} value={field.value || ""} data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 mt-0">
              <FormField
                control={form.control}
                name="quoteNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Q1764539694247" {...field} value={field.value || ""} data-testid="input-quote-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Timeline</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-timeline">
                          <SelectValue placeholder="Select timeline" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1week">~1 Week</SelectItem>
                        <SelectItem value="2weeks">~2 Weeks</SelectItem>
                        <SelectItem value="3weeks">~3 Weeks</SelectItem>
                        <SelectItem value="4weeks">~4 Weeks</SelectItem>
                        <SelectItem value="5weeks">~5 Weeks</SelectItem>
                        <SelectItem value="6weeks">~6 Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-terms">
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CPQ_PAYMENT_TERMS.map((term) => (
                          <SelectItem key={term} value={term}>
                            {CPQ_PAYMENT_TERMS_DISPLAY[term]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </TabsContent>

            <TabsContent value="contacts" className="space-y-4 mt-0">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Andrew Schuster" {...field} value={field.value || ""} data-testid="input-contact-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="schuster@ashleymcgraw.com" {...field} value={field.value || ""} data-testid="input-contact-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(315) 484-8826" {...field} value={field.value || ""} data-testid="input-contact-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-4" />

              <div>
                <h3 className="text-sm font-medium mb-3">Billing Contact (Required for Contract)</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cpqScopingData.billingContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Contact Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Accounts Payable / Billing Manager" {...field} value={field.value || ""} data-testid="input-billing-contact-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpqScopingData.billingContactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="billing@company.com" {...field} value={field.value || ""} data-testid="input-billing-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpqScopingData.billingContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Contact Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="(555) 123-4567" {...field} value={field.value || ""} data-testid="input-billing-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpqScopingData.billingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="123 Business St, Suite 100, City, ST 12345" {...field} value={field.value || ""} data-testid="input-billing-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <Button type="submit" disabled={isPending} className="w-full" data-testid="button-submit-lead">
          {isPending ? "Saving..." : lead ? "Update Deal" : "Create Deal"}
        </Button>
      </form>
    </Form>
  );
}
