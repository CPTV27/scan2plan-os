import { ScrollArea } from "@/components/ui/scroll-area";
import { DealAIAssistant } from "@/components/DealAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileEdit, Sparkles, PenTool, Check, Clock, Send, Copy, ChevronDown, Plus, Trash2, History, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { SignatureCapture } from "@/components/SignatureCapture";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import type { Lead, GeneratedProposal } from "@shared/schema";
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
import { formatDistanceToNow } from "date-fns";

interface ProposalTabProps {
  lead: Lead;
}

export function ProposalTab({ lead }: ProposalTabProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);

  // Fetch all proposals for this lead
  const { data: proposals, isLoading: proposalsLoading } = useQuery<GeneratedProposal[]>({
    queryKey: ["/api/generated-proposals/lead", lead.id],
    enabled: !!lead.id,
  });

  // Create new version mutation
  const createVersionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/leads/${lead.id}/proposal/generate`, {
        createNewVersion: true,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create new version");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/generated-proposals/lead", lead.id] });
      toast({
        title: "New version created",
        description: `Version ${data.proposal?.version || "new"} created successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create version",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete proposal mutation
  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const response = await apiRequest("DELETE", `/api/generated-proposals/${proposalId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete proposal");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/generated-proposals/lead", lead.id] });
      toast({
        title: "Proposal deleted",
        description: "The proposal version has been deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sortedProposals = proposals?.slice().sort((a, b) => (b.version || 1) - (a.version || 1)) || [];

  const handleSendSignatureLink = async () => {
    setSendingLink(true);
    try {
      const response = await apiRequest("POST", `/api/leads/${lead.id}/send-signature-link`, {
        recipientEmail: lead.contactEmail,
        recipientName: lead.clientName,
      });
      const data = await response.json();

      setSignatureUrl(data.signatureUrl);

      toast({
        title: "Signature link generated",
        description: "Copy the link below to send to your client",
      });
    } catch (error) {
      toast({
        title: "Failed to generate link",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (signatureUrl) {
      navigator.clipboard.writeText(signatureUrl);
      toast({
        title: "Link copied!",
        description: "Signature link copied to clipboard",
      });
    }
  };

  const handleSignatureComplete = async (signatureData: {
    signatureImage: string;
    signerName: string;
    signerEmail: string;
    signedAt: Date;
  }) => {
    try {
      await apiRequest("POST", `/api/leads/${lead.id}/signature`, signatureData);

      // Refresh lead data
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id] });

      setShowSignatureDialog(false);

      toast({
        title: "Proposal signed!",
        description: `Signed by ${signatureData.signerName}`,
      });
    } catch (error) {
      toast({
        title: "Failed to save signature",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const isSigned = !!(lead as any).signedAt;

  return (
    <ScrollArea className="h-full flex-1">
      <div className="p-4 space-y-4">
        {/* Proposal Version History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5" />
                Proposal Versions
              </CardTitle>
              <Button
                size="sm"
                onClick={() => createVersionMutation.mutate()}
                disabled={createVersionMutation.isPending}
              >
                {createVersionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                New Version
              </Button>
            </div>
            <CardDescription>
              {sortedProposals.length === 0
                ? "No proposals yet. Create your first version."
                : `${sortedProposals.length} version${sortedProposals.length !== 1 ? "s" : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proposalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedProposals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileEdit className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Click "New Version" to create your first proposal</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        v{proposal.version || 1}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{proposal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {proposal.updatedAt
                            ? `Updated ${formatDistanceToNow(new Date(proposal.updatedAt), { addSuffix: true })}`
                            : proposal.createdAt
                              ? `Created ${formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}`
                              : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={proposal.status === "sent" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {proposal.status || "draft"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/deals/${lead.id}/proposal?v=${proposal.id}`)}
                      >
                        <FileEdit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deleteProposalMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Proposal Version?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete version {proposal.version || 1} of this proposal. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteProposalMutation.mutate(proposal.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two-column grid for Quick Actions and Client Signature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Proposal Builder Quick Access */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-primary" />
                Quick Edit
              </CardTitle>
              <CardDescription>
                {sortedProposals.length > 0
                  ? `Open latest version (v${sortedProposals[0]?.version || 1})`
                  : "Create and customize professional proposals"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate(`/deals/${lead.id}/proposal`)}
                className="gap-2 w-full"
                size="lg"
                data-testid="button-open-proposal-builder"
              >
                <Sparkles className="w-5 h-5" />
                Open Proposal Builder
              </Button>
            </CardContent>
          </Card>

          {/* Signature Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PenTool className="w-5 h-5" />
                    Client Signature
                  </CardTitle>
                  <CardDescription>
                    Send proposal for electronic signature
                  </CardDescription>
                </div>
                {isSigned && (
                  <Badge variant="default" className="bg-green-500 gap-1">
                    <Check className="w-3 h-3" />
                    Signed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isSigned ? (
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Signed by:</span>
                        <p className="font-medium">{(lead as any).signerName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium">{(lead as any).signerEmail}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Date:</span>
                        <p className="font-medium">
                          {new Date((lead as any).signedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {(lead as any).signatureImage && (
                    <div className="border rounded-lg p-2 bg-white">
                      <img
                        src={(lead as any).signatureImage}
                        alt="Client signature"
                        className="max-h-32 mx-auto"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      Awaiting Signature
                    </Badge>
                    <Button
                      size="sm"
                      onClick={handleSendSignatureLink}
                      disabled={sendingLink}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendingLink ? "Generating..." : "Send for Signature"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSignatureDialog(true)}
                    >
                      <PenTool className="w-4 h-4 mr-2" />
                      Sign In-Person
                    </Button>
                  </div>

                  {signatureUrl && (
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <p className="text-sm font-medium">Signature Link:</p>
                      <div className="flex gap-2">
                        <Input
                          value={signatureUrl}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button size="sm" onClick={handleCopyLink}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Send this link to your client to sign electronically. Link expires in 7 days.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Assistant - Collapsible */}
        <Collapsible>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    AI Proposal Assistant
                  </CardTitle>
                  <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <DealAIAssistant lead={lead} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-3xl">
          <SignatureCapture
            onSignatureComplete={handleSignatureComplete}
            onCancel={() => setShowSignatureDialog(false)}
            proposalTitle={lead.projectName || undefined}
            clientName={lead.clientName || undefined}
          />
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
