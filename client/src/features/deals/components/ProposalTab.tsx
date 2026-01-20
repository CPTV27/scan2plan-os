import { ScrollArea } from "@/components/ui/scroll-area";
import { DealAIAssistant } from "@/components/DealAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileEdit, Sparkles, PenTool, Check, Clock, Send, Copy } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { SignatureCapture } from "@/components/SignatureCapture";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Lead } from "@shared/schema";

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
        {/* Proposal Builder Entry Point */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-primary" />
              Proposal Builder
            </CardTitle>
            <CardDescription>
              Create and customize professional proposals with our split-pane editor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate(`/deals/${lead.id}/proposal`)}
              className="gap-2"
              data-testid="button-open-proposal-builder"
            >
              <Sparkles className="w-4 h-4" />
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
                  Send proposal to client for electronic signature
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
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="gap-1">
                    <Clock className="w-3 h-3" />
                    Awaiting Signature
                  </Badge>
                  <Button
                    onClick={handleSendSignatureLink}
                    disabled={sendingLink}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {sendingLink ? "Generating..." : "Send for Signature"}
                  </Button>
                  <Button
                    variant="outline"
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

        {/* AI Assistant */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Proposal Assistant
            </CardTitle>
            <CardDescription>
              Get AI help with proposal content, answers, and suggestions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DealAIAssistant lead={lead} />
          </CardContent>
        </Card>
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
