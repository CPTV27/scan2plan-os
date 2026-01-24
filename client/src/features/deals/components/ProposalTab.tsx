import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileEdit, PenTool, Check, Clock, Send, Copy, Plus, Trash2, History, Loader2, Download, FileCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import type { Lead, GeneratedProposal, CpqQuote } from "@shared/schema";
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
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Inline rename state
  const [editingProposalId, setEditingProposalId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  // Signature version selection
  const [selectedSignatureProposalId, setSelectedSignatureProposalId] = useState<number | null>(null);

  // Fetch all proposals for this lead
  const { data: proposals, isLoading: proposalsLoading } = useQuery<GeneratedProposal[]>({
    queryKey: ["/api/generated-proposals/lead", lead.id],
    enabled: !!lead.id,
  });

  // Fetch all quotes for this lead
  const { data: quotes } = useQuery<CpqQuote[]>({
    queryKey: [`/api/leads/${lead.id}/cpq-quotes`],
    enabled: !!lead.id,
  });

  // Create new version mutation
  const createVersionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/proposals/${lead.id}/create`, {
        createNewVersion: true,
        quoteId: selectedQuoteId || undefined,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create new version");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/generated-proposals/lead", lead.id] });
      const selectedQuote = quotes?.find(q => String(q.id) === selectedQuoteId);
      const quoteLabel = selectedQuote?.quoteNumber ? ` (${selectedQuote.quoteNumber})` : "";
      toast({
        title: "New version created",
        description: `Version ${data.version || "new"}${quoteLabel} created successfully`,
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

  // Rename proposal mutation
  const renameProposalMutation = useMutation({
    mutationFn: async ({ proposalId, name }: { proposalId: number; name: string }) => {
      const response = await apiRequest("PATCH", `/api/generated-proposals/${proposalId}`, { name });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to rename proposal");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/generated-proposals/lead", lead.id] });
      setEditingProposalId(null);
      setEditingName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to rename",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start inline editing
  const handleStartEdit = (proposal: GeneratedProposal) => {
    setEditingProposalId(proposal.id);
    setEditingName(proposal.name || "");
  };

  // Save inline edit
  const handleSaveEdit = () => {
    if (editingProposalId && editingName.trim()) {
      renameProposalMutation.mutate({ proposalId: editingProposalId, name: editingName.trim() });
    } else {
      setEditingProposalId(null);
      setEditingName("");
    }
  };

  // Cancel inline edit
  const handleCancelEdit = () => {
    setEditingProposalId(null);
    setEditingName("");
  };

  const sortedProposals = proposals?.slice().sort((a, b) => (b.version || 1) - (a.version || 1)) || [];

  const handleSendSignatureLink = async (proposalId: number) => {
    setSendingLink(true);
    setSelectedSignatureProposalId(proposalId);
    try {
      const response = await apiRequest("POST", `/api/leads/${lead.id}/send-signature-link`, {
        recipientEmail: lead.contactEmail,
        recipientName: lead.clientName,
        proposalId: proposalId,
      });
      const data = await response.json();

      setSignatureUrl(data.signatureUrl);

      const selectedProposal = sortedProposals.find(p => p.id === proposalId);
      toast({
        title: "Signature link generated",
        description: selectedProposal
          ? `Using proposal v${selectedProposal.version || 1}. Copy the link below to send to your client.`
          : "Copy the link below to send to your client",
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
              <div className="flex items-center gap-2">
                {quotes && quotes.length > 0 && (
                  <Select
                    value={selectedQuoteId || "latest"}
                    onValueChange={(v) => setSelectedQuoteId(v === "latest" ? null : v)}
                  >
                    <SelectTrigger className="w-[180px] h-9 text-sm">
                      <SelectValue placeholder="Select Quote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest Quote</SelectItem>
                      {quotes.map((quote, index) => {
                        // Use versionName (e.g., "Version 1") or fall back to version number
                        const versionName = (quote as any).versionName;
                        const versionNumber = (quote as any).versionNumber || index + 1;
                        const displayName = versionName || `Version ${versionNumber}`;
                        return (
                          <SelectItem key={quote.id} value={String(quote.id)}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
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
                        {editingProposalId === proposal.id ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit();
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            className="h-7 text-sm font-medium w-64"
                            autoFocus
                          />
                        ) : (
                          <p
                            className="text-sm font-medium cursor-pointer hover:text-primary hover:underline"
                            onClick={() => handleStartEdit(proposal)}
                            title="Click to rename"
                          >
                            {proposal.name}
                          </p>
                        )}
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
                      {isSigned && (lead as any).signatureProposalId === proposal.id && (
                        <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                          <Check className="w-3 h-3 mr-1" />
                          Signed
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/deals/${lead.id}/proposal?v=${proposal.id}`)}
                      >
                        <FileEdit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleSendSignatureLink(proposal.id)}
                        disabled={sendingLink && selectedSignatureProposalId === proposal.id}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        {sendingLink && selectedSignatureProposalId === proposal.id ? "Sending..." : "Send for Signature"}
                      </Button>
                      {isSigned && (lead as any).signatureProposalId === proposal.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const clientToken = (lead as any).clientToken;
                            if (clientToken) {
                              window.open(`/api/public/proposals/${clientToken}/signed-pdf`, '_blank');
                            } else {
                              toast({
                                title: "No signed PDF available",
                                description: "The signature token is not available.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <FileCheck className="w-4 h-4 mr-1" />
                          Download Signed
                        </Button>
                      )}
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

        {/* Client Signature Section */}
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
                    <p className="text-sm text-muted-foreground">
                      Use the "Send for Signature" button on each proposal version above
                    </p>
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

    </ScrollArea>
  );
}
