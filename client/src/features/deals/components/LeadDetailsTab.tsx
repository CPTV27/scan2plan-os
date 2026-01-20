import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import type { BuyerPersona } from "@shared/schema";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  DollarSign,
  Download,
  Loader2,
  Paperclip,
  Save,
  Star,
  Upload,
  User,
  Users,
} from "lucide-react";
import { PersonaSuggestion } from "@/components/PersonaSuggestion";
import { LocationPreview } from "@/components/LocationPreview";
import { HungryField, HUNGRY_FIELD_QUESTIONS } from "@/components/HungryField";
import { DataCompleteness } from "@/components/DataCompleteness";
import { FollowUpBuilder } from "@/components/FollowUpBuilder";
import { TierAEstimatorCard, MarketingInfluenceWidget } from "@/features/deals/components";
import { TIER_A_THRESHOLD, TOUCHPOINT_OPTIONS } from "@shared/schema";
import { LeadDetailsTabProps, MissingInfoEntry } from "@/features/deals/types";
import { CPQ_PAYMENT_TERMS, CPQ_PAYMENT_TERMS_DISPLAY } from "@shared/schema";
import { useLeadAutosave } from "@/hooks/use-lead-autosave";
import { AutosaveStatus } from "@/components/AutosaveStatus";

export function LeadDetailsTab({
  lead,
  leadId,
  form,
  onSubmit,
  isPending,
  queryClient,
  updateMutation,
  toast,
  documents,
  uploadDocumentMutation,
}: LeadDetailsTabProps) {
  const { data: personas = [] } = useQuery<BuyerPersona[]>({
    queryKey: ["/api/personas"],
  });

  const autosave = useLeadAutosave({
    leadId,
    form,
    debounceMs: 1500,
    enabled: !isNaN(leadId),
  });

  // Sync form paymentTerms when lead changes (e.g., from QuoteBuilder updates)
  useEffect(() => {
    const currentFormValue = form.getValues("paymentTerms");
    const leadValue = lead.paymentTerms ?? "";
    if (leadValue !== currentFormValue) {
      form.setValue("paymentTerms", leadValue, { shouldDirty: false });
    }
  }, [lead.paymentTerms, form]);

  const missingInfo = form.watch("missingInfo") || [];

  const isFieldUnknown = (fieldKey: string): boolean => {
    return missingInfo.some((entry: MissingInfoEntry) => entry.fieldKey === fieldKey && entry.status !== "answered");
  };

  const toggleMissingInfo = (fieldKey: string, isUnknown: boolean) => {
    const current = form.getValues("missingInfo") || [];
    if (isUnknown) {
      const existingIdx = current.findIndex((e: MissingInfoEntry) => e.fieldKey === fieldKey);
      if (existingIdx >= 0) {
        const updated = [...current];
        updated[existingIdx] = { ...updated[existingIdx], status: "pending" };
        form.setValue("missingInfo", updated, { shouldDirty: true });
      } else {
        const newEntry: MissingInfoEntry = {
          fieldKey,
          question: HUNGRY_FIELD_QUESTIONS[fieldKey] || `What is the ${fieldKey}?`,
          addedAt: new Date().toISOString(),
          status: "pending",
        };
        form.setValue("missingInfo", [...current, newEntry], { shouldDirty: true });
      }
    } else {
      const updated = current.map((entry: MissingInfoEntry) =>
        entry.fieldKey === fieldKey
          ? { ...entry, status: "answered" as const, answeredAt: new Date().toISOString() }
          : entry
      );
      form.setValue("missingInfo", updated, { shouldDirty: true });
    }
  };

  const markFollowUpsAsSent = (fieldKeys: string[]) => {
    const current = form.getValues("missingInfo") || [];
    const updated = current.map((entry: MissingInfoEntry) =>
      fieldKeys.includes(entry.fieldKey) && entry.status === "pending"
        ? { ...entry, status: "sent" as const, sentAt: new Date().toISOString() }
        : entry
    );
    form.setValue("missingInfo", updated, { shouldDirty: true });
  };

  return (
    <ScrollArea className="h-full flex-1">
      <div className="p-4 pb-32 space-y-4">
        <PersonaSuggestion
          leadId={leadId}
          clientName={lead.clientName}
          projectName={lead.projectName ?? undefined}
          projectType={lead.buildingType ?? undefined}
          contactName={lead.contactName ?? undefined}
          notes={lead.notes ?? undefined}
          currentPersonaCode={lead.buyerPersona ?? undefined}
          onPersonaAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
          }}
        />

        <DataCompleteness
          fields={[
            { key: "projectName", label: "Project Name", value: form.watch("projectName"), required: true },
            { key: "contactName", label: "Contact Name", value: form.watch("contactName"), required: true },
            { key: "contactEmail", label: "Contact Email", value: form.watch("contactEmail"), required: true },
            { key: "leadSource", label: "Lead Source", value: form.watch("leadSource"), required: true },
            { key: "timeline", label: "Project Timeline", value: form.watch("timeline") },
            { key: "paymentTerms", label: "Payment Terms", value: form.watch("paymentTerms") },
            { key: "proofLinks", label: "Proof Links", value: form.watch("proofLinks") },
            { key: "notes", label: "Notes", value: form.watch("notes") },
          ]}
          missingInfo={missingInfo}
        />

        <FollowUpBuilder
          contactName={form.watch("contactName") || "Client"}
          contactEmail={form.watch("contactEmail") || ""}
          projectName={form.watch("projectName") || lead.projectName || "Your Project"}
          missingInfo={missingInfo}
          onMarkAsSent={markFollowUpsAsSent}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Project Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client / Company *</FormLabel>
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
                      <FormLabel>Project Name <span className="text-destructive">*</span></FormLabel>
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
                      <FormLabel>Project Address *</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Industrial Park Dr, City, ST 12345" {...field} value={field.value || ""} data-testid="input-project-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <LocationPreview
                  address={form.watch("projectAddress") || ""}
                  companyName={form.watch("clientName")}
                  onAddressUpdate={(formattedAddress) => {
                    form.setValue("projectAddress", formattedAddress);
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Deal Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Deal Value</FormLabel>
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
                        <FormLabel>Probability of Closing</FormLabel>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">0%</span>
                            <span className="text-lg font-semibold" data-testid="text-probability-value">{field.value || 0}%</span>
                            <span className="text-sm text-muted-foreground">100%</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={0}
                              max={100}
                              step={5}
                              value={[field.value || 0]}
                              onValueChange={(values) => field.onChange(values[0])}
                              data-testid="slider-probability"
                              className="w-full"
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="timeline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Timeline</FormLabel>
                      <FormControl>
                        <Input placeholder="Q1 2026, Urgent, etc." {...field} value={field.value || ""} data-testid="input-timeline" />
                      </FormControl>
                      <FormDescription className="text-xs">First impression of client's timeline expectations</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dealStage"
                  render={({ field }) => {
                    const isClosingWon = field.value === "Closed Won" && lead.dealStage !== "Closed Won";
                    const hasSource = form.watch("leadSource") && form.watch("leadSource") !== "";
                    const showAttributionWarning = isClosingWon && !hasSource;

                    return (
                      <FormItem>
                        <FormLabel>Deal Stage *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        {showAttributionWarning && (
                          <div className="flex items-center gap-2 p-2 mt-2 text-sm rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400" data-testid="alert-attribution-required">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span>Lead source is required to close this deal. Please set a source below.</span>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leadSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Source <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead-source">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Amplifi">Amplifi</SelectItem>
                            <SelectItem value="Customer Referral">Customer Referral</SelectItem>
                            <SelectItem value="Website">Website</SelectItem>
                            <SelectItem value="Social Media">Social Media</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
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
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={String(field.value || 3)}>
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Project Status
                </CardTitle>
                <CardDescription>Track the current phase and urgency of this project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="projectStatus.proposalPhase"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-proposal-phase"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">Proposal Phase</FormLabel>
                          <FormDescription className="text-xs">Currently preparing proposal</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectStatus.inHand"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-in-hand"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">In Hand</FormLabel>
                          <FormDescription className="text-xs">Project is confirmed</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectStatus.urgent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-urgent"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">Urgent</FormLabel>
                          <FormDescription className="text-xs">High priority timeline</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectStatus.other"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-other"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">Other</FormLabel>
                          <FormDescription className="text-xs">Custom status</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("projectStatus.other") && (
                  <FormField
                    control={form.control}
                    name="projectStatus.otherText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Other Status Details</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Describe the status..."
                            {...field}
                            value={field.value || ""}
                            data-testid="input-other-status"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {((lead.sqft && lead.sqft >= TIER_A_THRESHOLD) || lead.abmTier === "Tier A") && (
              <TierAEstimatorCard
                lead={lead}
                leadId={leadId}
                updateMutation={updateMutation}
                queryClient={queryClient}
                toast={toast}
              />
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Contact Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Andrew Schuster" {...field} value={field.value || ""} data-testid="input-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@company.com" {...field} value={field.value || ""} data-testid="input-contact-email" />
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
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Billing Contact <span className="text-destructive">*</span>
                  </h4>
                  <FormField
                    control={form.control}
                    name="billingContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Contact Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Accounts Payable / CFO Name" {...field} value={field.value || ""} data-testid="input-billing-contact-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="billingContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Email <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="billing@company.com" {...field} value={field.value || ""} data-testid="input-billing-contact-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="billingContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Phone</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="(555) 123-4567" {...field} value={field.value || ""} data-testid="input-billing-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <HungryField
                        fieldKey="paymentTerms"
                        question={HUNGRY_FIELD_QUESTIONS.paymentTerms}
                        onUnknownChange={(isUnknown) => toggleMissingInfo("paymentTerms", isUnknown)}
                        isUnknown={isFieldUnknown("paymentTerms")}
                      >
                        <FormItem className="mt-4">
                          <FormLabel>Payment Terms</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-payment-terms">
                                <SelectValue placeholder="Select payment terms" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CPQ_PAYMENT_TERMS.filter(term => term !== "other").map((term) => (
                                <SelectItem key={term} value={term}>
                                  {CPQ_PAYMENT_TERMS_DISPLAY[term]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      </HungryField>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Buyer Persona
                </CardTitle>
                <CardDescription>Classify the primary decision-maker type</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="buyerPersona"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-buyer-persona">
                            <SelectValue placeholder="Select buyer persona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {personas.map((persona) => (
                            <SelectItem key={persona.code} value={persona.code}>
                              {persona.code}: {persona.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Attribution & Touchpoints
                </CardTitle>
                <CardDescription>Track marketing touchpoints for this lead</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="proofLinks"
                  render={({ field }) => (
                    <HungryField
                      fieldKey="proofLinks"
                      question={HUNGRY_FIELD_QUESTIONS.proofLinks}
                      onUnknownChange={(isUnknown) => toggleMissingInfo("proofLinks", isUnknown)}
                      isUnknown={isFieldUnknown("proofLinks")}
                    >
                      <FormItem>
                        <FormLabel>Proof Links</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Links to evidence (LinkedIn, case studies, etc.)"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-proof-links"
                            rows={3}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Add links to supporting materials like LinkedIn posts, case studies, or reference projects
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    </HungryField>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  Notes & Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this deal..."
                          {...field}
                          value={field.value || ""}
                          data-testid="input-notes"
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Quick Upload (NDA, Floor Plans)
                  </h4>
                  {isNaN(leadId) ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            data-testid="button-upload-nda"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload File
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Save the deal first to upload files</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadDocumentMutation.isPending}
                      onClick={() => {
                        const input = document.getElementById('nda-upload-input') as HTMLInputElement;
                        input?.click();
                      }}
                      data-testid="button-upload-nda"
                    >
                      {uploadDocumentMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload File
                        </>
                      )}
                    </Button>
                  )}
                  <input
                    id="nda-upload-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocumentMutation.mutate(file);
                      e.target.value = '';
                    }}
                    disabled={uploadDocumentMutation.isPending || isNaN(leadId)}
                    data-testid="input-upload-nda"
                  />
                </div>
                {documents && documents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {documents.slice(0, 3).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                        data-testid={`doc-preview-${doc.id}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{doc.originalName}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                          data-testid={`button-download-doc-${doc.id}`}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {documents.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{documents.length - 3} more documents (see Documents tab)
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <MarketingInfluenceWidget leadId={leadId} />

            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm py-4 border-t -mx-4 px-4 space-y-2">
              <div className="flex items-center justify-between">
                <AutosaveStatus
                  status={autosave.status}
                  error={autosave.error}
                  onRetry={autosave.retry}
                />
                {autosave.lastSavedAt && (
                  <span className="text-xs text-muted-foreground">
                    Last saved {autosave.lastSavedAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <Button type="submit" disabled={isPending} className="w-full" data-testid="button-submit-lead">
                  <Save className="w-4 h-4 mr-2" />
                  {isPending ? "Saving..." : "Force Sync"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Changes autosave. Use this for a full sync.
                </p>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </ScrollArea>
  );
}
