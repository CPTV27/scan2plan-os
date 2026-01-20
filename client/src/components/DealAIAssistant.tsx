import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Brain,
  Building2,
  Check,
  Copy,
  Edit2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Save,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EvidenceVaultPanel } from "./EvidenceVaultPanel";
import type { Lead } from "@shared/schema";

interface BuyerPersona {
  id: number;
  code: string;
  roleTitle: string;
  primaryPain: string;
  secondaryPain: string | null;
  hiddenFear: string | null;
  valueDriver: string;
  dealbreaker: string | null;
  tonePreference: string;
  communicationStyle: string;
  attentionSpan: string;
  technicalTriggers: string[];
  emotionalTriggers: string[];
  avoidWords: string[];
}

interface SimplePersona {
  id: number;
  code: string;
  name: string;
  painPoints: string[];
  preferredTags: string[];
}

interface DealAIAssistantProps {
  lead: Lead;
}

const EMAIL_TYPES = [
  { value: "introduction", label: "Introduction / First Touch" },
  { value: "follow_up", label: "Follow-up After Meeting" },
  { value: "proposal_send", label: "Proposal Delivery" },
  { value: "check_in", label: "Status Check-in" },
  { value: "objection_response", label: "Objection Response" },
  { value: "close_attempt", label: "Close / Decision Request" },
];

const PROJECT_TYPES = [
  "Commercial / Office",
  "Industrial / Warehouse", 
  "Residential",
  "Healthcare / Medical",
  "Education / Campus",
  "Retail / Hospitality",
  "Mixed Use",
  "Historical / Renovation",
];

export function DealAIAssistant({ lead }: DealAIAssistantProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("proposal");
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [emailType, setEmailType] = useState("introduction");
  const [emailContext, setEmailContext] = useState("");
  const [scopeNotes, setScopeNotes] = useState("");
  const [objection, setObjection] = useState("");
  const [projectType, setProjectType] = useState("Commercial / Office");
  const [timeline, setTimeline] = useState("Standard");
  
  // Deal Summary state
  const [dealSummary, setDealSummary] = useState<string>("");
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDirty, setSummaryDirty] = useState(false);

  // Generate initial deal summary from lead data
  useEffect(() => {
    if (lead && !dealSummary) {
      const summary = generateDealSummary(lead);
      setDealSummary(summary);
    }
  }, [lead]);

  const generateDealSummary = (lead: Lead): string => {
    const parts: string[] = [];
    
    if (lead.clientName) {
      parts.push(`Client: ${lead.clientName}`);
    }
    if (lead.projectName) {
      parts.push(`Project: ${lead.projectName}`);
    }
    if (lead.projectAddress) {
      parts.push(`Location: ${lead.projectAddress}`);
    }
    if (lead.sqft) {
      parts.push(`Size: ${lead.sqft.toLocaleString()} sqft`);
    }
    if (lead.value) {
      parts.push(`Deal Value: $${Number(lead.value).toLocaleString()}`);
    }
    if (lead.dealStage) {
      parts.push(`Stage: ${lead.dealStage}`);
    }
    if (lead.notes) {
      parts.push(`\nNotes: ${lead.notes}`);
    }
    
    return parts.join("\n");
  };

  // Fetch all personas for the selector
  const { data: allPersonas } = useQuery<SimplePersona[]>({
    queryKey: ["/api/personas"],
  });

  const buyerCode = lead.buyerPersona || "";

  const { data: persona, isLoading: personaLoading, error: personaError } = useQuery<BuyerPersona>({
    queryKey: [`/api/intelligence/personas/${buyerCode}`],
    enabled: !!buyerCode,
  });

  // Mutation to update lead's buyer persona
  const updatePersonaMutation = useMutation({
    mutationFn: async (personaCode: string) => {
      const res = await apiRequest("PATCH", `/api/leads/${lead.id}`, {
        buyerPersona: personaCode,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Persona Updated", description: "Buyer persona has been saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  // Save summary locally (used for AI generation context)
  const handleSaveSummary = () => {
    setSummaryDirty(false);
    setIsEditingSummary(false);
    toast({ title: "Summary Updated", description: "Context updated for AI generation" });
  };

  const proposalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/intelligence/generate/proposal", {
        buyerCode,
        projectName: lead.projectName || lead.clientName,
        projectType,
        squareFootage: lead.sqft?.toString() || "TBD",
        timeline,
        scopeNotes: scopeNotes || lead.notes || undefined,
        dealContext: dealSummary, // Include deal summary for AI context
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast({ title: "Proposal generated", description: "AI-generated proposal is ready for review" });
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const emailPrompts: Record<string, string> = {
        introduction: `Write an introduction email for a new prospect. We want to schedule a discovery call to understand their project needs. Project: ${lead.projectName || "their upcoming project"}. Be professional but warm.`,
        follow_up: `Write a follow-up email after an initial meeting. Reference the project discussion and next steps. Project: ${lead.projectName || "their project"}.`,
        proposal_send: `Write an email to send along with our proposal. Project: ${lead.projectName || "their project"}. Value: $${lead.value?.toLocaleString() || "TBD"}. Emphasize value over price.`,
        check_in: `Write a professional check-in email. We want to touch base on the project status and see if they have questions. Project: ${lead.projectName || "their project"}.`,
        objection_response: `Write an email responding to this concern: "${emailContext || "They need more time to decide"}". Be understanding but create urgency through value, not pressure.`,
        close_attempt: `Write an email to move toward closing the deal. Project: ${lead.projectName || "their project"}. Value: $${lead.value?.toLocaleString() || "TBD"}. Be direct but respectful.`,
      };

      const res = await apiRequest("POST", "/api/intelligence/generate/content", {
        buyerCode,
        contentType: "email",
        projectContext: {
          projectName: lead.projectName || lead.clientName,
          projectType,
          squareFootage: lead.sqft?.toString() || "TBD",
        },
        specificRequest: emailPrompts[emailType] + (emailContext ? `\n\nAdditional context: ${emailContext}` : ""),
        dealContext: dealSummary,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast({ title: "Email drafted", description: "AI-generated email is ready for review" });
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const negotiationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/intelligence/generate/negotiation", {
        buyerCode,
        objectionRaised: objection,
        projectContext: `Project: ${lead.projectName || lead.clientName}, Value: $${lead.value?.toLocaleString() || "TBD"}, Stage: ${lead.dealStage}`,
        dealContext: dealSummary,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast({ title: "Response brief generated", description: "Negotiation strategy is ready" });
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({ title: "Copied!", description: "Content copied to clipboard" });
  };

  const isGenerating = proposalMutation.isPending || emailMutation.isPending || negotiationMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Evidence Vault Panel - Collapsible research insights */}
      <EvidenceVaultPanel lead={lead} defaultOpen={false} />

      {/* Deal Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Deal Summary
            </CardTitle>
            <div className="flex items-center gap-2">
              {isEditingSummary ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingSummary(false);
                      setDealSummary(generateDealSummary(lead));
                      setSummaryDirty(false);
                    }}
                    data-testid="button-cancel-summary"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSummary}
                    disabled={!summaryDirty}
                    data-testid="button-save-summary"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingSummary(true)}
                  data-testid="button-edit-summary"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
          <CardDescription className="text-xs">
            Context provided to AI for generating targeted content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingSummary ? (
            <Textarea
              value={dealSummary}
              onChange={(e) => {
                setDealSummary(e.target.value);
                setSummaryDirty(true);
              }}
              className="min-h-[120px] text-sm"
              placeholder="Enter deal context for AI generation..."
              data-testid="textarea-deal-summary"
            />
          ) : (
            <div className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
              {dealSummary || "No deal summary available. Click Edit to add context."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buyer Persona Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Target Buyer Persona
            </CardTitle>
            {buyerCode && <Badge variant="outline">{buyerCode}</Badge>}
          </div>
          <CardDescription className="text-xs">
            Select the buyer type to tailor AI content generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={buyerCode}
            onValueChange={(value) => updatePersonaMutation.mutate(value)}
            disabled={updatePersonaMutation.isPending}
          >
            <SelectTrigger data-testid="select-buyer-persona">
              {updatePersonaMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              ) : (
                <SelectValue placeholder="Select a buyer persona..." />
              )}
            </SelectTrigger>
            <SelectContent>
              {allPersonas?.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.code}</span>
                    <span className="text-muted-foreground">- {p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Show persona details if selected */}
          {persona && (
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded-lg">
              <div>
                <span className="text-muted-foreground">Role:</span>
                <p className="font-medium">{persona.roleTitle}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Primary Pain:</span>
                <p className="font-medium">{persona.primaryPain}</p>
              </div>
              <div>
                <span className="text-muted-foreground">What They Value:</span>
                <p className="font-medium">{persona.valueDriver}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Communication Style:</span>
                <p className="font-medium">{persona.tonePreference}</p>
              </div>
            </div>
          )}

          {!buyerCode && (
            <div className="flex items-center gap-2 text-amber-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Select a persona to enable AI content generation</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="proposal" className="gap-2" data-testid="tab-ai-proposal">
            <FileText className="h-4 w-4" />
            Proposal
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2" data-testid="tab-ai-email">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="objection" className="gap-2" data-testid="tab-ai-objection">
            <MessageSquare className="h-4 w-4" />
            Objection
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposal" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Proposal Language
              </CardTitle>
              <CardDescription className="text-xs">
                Creates persona-targeted proposal text with executive summary, approach, and investment framing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Project:</span>
                  <p className="font-medium">{lead.projectName || lead.clientName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <p className="font-medium">{lead.sqft?.toLocaleString() || "TBD"} sqft</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Value:</span>
                  <p className="font-medium">${lead.value?.toLocaleString() || "TBD"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stage:</span>
                  <p className="font-medium">{lead.dealStage}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Project Type</Label>
                  <Select value={projectType} onValueChange={setProjectType}>
                    <SelectTrigger className="mt-1" data-testid="select-project-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timeline</Label>
                  <Select value={timeline} onValueChange={setTimeline}>
                    <SelectTrigger className="mt-1" data-testid="select-timeline">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Urgent">Urgent (1-2 weeks)</SelectItem>
                      <SelectItem value="Standard">Standard (2-4 weeks)</SelectItem>
                      <SelectItem value="Flexible">Flexible (4+ weeks)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="scope-notes">Additional Scope Notes (optional)</Label>
                <Textarea
                  id="scope-notes"
                  placeholder="Any special requirements, conditions, or context for the proposal..."
                  value={scopeNotes}
                  onChange={(e) => setScopeNotes(e.target.value)}
                  className="mt-1"
                  data-testid="input-scope-notes"
                />
              </div>

              <Button
                onClick={() => proposalMutation.mutate()}
                disabled={isGenerating || !buyerCode}
                className="w-full"
                data-testid="button-generate-proposal"
              >
                {proposalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                {!buyerCode ? "Select a Persona First" : "Generate Proposal Language"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Draft Email
              </CardTitle>
              <CardDescription className="text-xs">
                Generate persona-targeted emails for any stage of the sales process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email Type</Label>
                <Select value={emailType} onValueChange={setEmailType}>
                  <SelectTrigger className="mt-1" data-testid="select-email-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="email-context">Additional Context (optional)</Label>
                <Textarea
                  id="email-context"
                  placeholder="Any specific points to address, recent conversations, or context..."
                  value={emailContext}
                  onChange={(e) => setEmailContext(e.target.value)}
                  className="mt-1"
                  data-testid="input-email-context"
                />
              </div>

              <Button
                onClick={() => emailMutation.mutate()}
                disabled={isGenerating || !buyerCode}
                className="w-full"
                data-testid="button-generate-email"
              >
                {emailMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {!buyerCode ? "Select a Persona First" : "Draft Email"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="objection" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Handle Objection
              </CardTitle>
              <CardDescription className="text-xs">
                Get strategic guidance for handling objections based on persona psychology
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="objection">What objection or concern was raised?</Label>
                <Textarea
                  id="objection"
                  placeholder='e.g., "Your price is higher than competitors" or "We need to think about it"'
                  value={objection}
                  onChange={(e) => setObjection(e.target.value)}
                  className="mt-1"
                  data-testid="input-objection"
                />
              </div>

              <Button
                onClick={() => negotiationMutation.mutate()}
                disabled={isGenerating || !objection.trim() || !buyerCode}
                className="w-full"
                data-testid="button-generate-response"
              >
                {negotiationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                {!buyerCode ? "Select a Persona First" : "Generate Response Strategy"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {generatedContent && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Generated Content
              </CardTitle>
              <Button size="sm" variant="outline" onClick={copyToClipboard} data-testid="button-copy-content">
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {generatedContent}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
