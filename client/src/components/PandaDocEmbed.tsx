import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Send, RefreshCw, ExternalLink, Eye, Mail, Clock, CheckCircle2, XCircle, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PandaDocEmbedProps {
  pandaDocId: string | null;
  documentName?: string;
  onDocumentCreated?: (docId: string) => void;
  onDocumentSent?: () => void;
  onOpenSendDialog?: () => void;
  leadId?: number;
  quoteId?: number;
  proposalEmails?: Array<{
    openCount: number | null;
    sentAt: string | Date | null;
  }>;
}

interface DocumentStatus {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
}

export function PandaDocEmbed({ 
  pandaDocId, 
  documentName,
  onDocumentSent,
  onDocumentCreated,
  onOpenSendDialog,
  leadId,
  quoteId,
  proposalEmails,
}: PandaDocEmbedProps) {
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus | null>(null);
  const [currentDocId, setCurrentDocId] = useState<string | null>(pandaDocId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pandadoc/documents", {
        quoteId,
        leadId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.id) {
        setCurrentDocId(data.id);
        onDocumentCreated?.(data.id);
        toast({
          title: "Document created",
          description: "Your proposal has been created in PandaDoc. Click 'Edit in PandaDoc' to customize it.",
        });
        refreshStatus(data.id);
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to create document",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const sendDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await apiRequest("POST", `/api/pandadoc/documents/${docId}/send`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document sent",
        description: "The proposal has been sent for signature.",
      });
      onDocumentSent?.();
      refreshStatus();
    },
    onError: (error) => {
      toast({
        title: "Failed to send",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const activeDocId = currentDocId || pandaDocId;

  const refreshStatus = async (docId?: string) => {
    const id = docId || activeDocId;
    if (!id) return;
    setIsRefreshing(true);
    try {
      const response = await apiRequest("GET", `/api/pandadoc/documents/${id}/status`);
      const status = await response.json();
      setDocumentStatus(status);
    } catch (error) {
      console.error("Failed to refresh status:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeDocId) {
      refreshStatus();
    }
  }, [activeDocId]);

  if (!activeDocId) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No Proposal Document</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {quoteId 
              ? "Create a PandaDoc proposal from your saved quote to send to the client."
              : "Save a quote in the Quote Builder first, then create a proposal here."
            }
          </p>
          {quoteId && (
            <Button 
              onClick={() => createDocumentMutation.mutate()}
              disabled={createDocumentMutation.isPending}
              data-testid="button-create-proposal"
            >
              {createDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Proposal
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const getStatusInfo = () => {
    if (!documentStatus) return { label: "Loading...", color: "bg-muted", icon: Loader2, description: "" };
    
    const statusMap: Record<string, { label: string; color: string; icon: typeof CheckCircle2; description: string }> = {
      "document.draft": { 
        label: "Draft", 
        color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", 
        icon: Edit3,
        description: "Document created and ready to edit in PandaDoc"
      },
      "document.sent": { 
        label: "Sent", 
        color: "bg-blue-500/10 text-blue-600 border-blue-500/20", 
        icon: Send,
        description: "Document sent and awaiting client signature"
      },
      "document.viewed": { 
        label: "Viewed", 
        color: "bg-purple-500/10 text-purple-600 border-purple-500/20", 
        icon: Eye,
        description: "Client has opened and viewed the document"
      },
      "document.completed": { 
        label: "Completed", 
        color: "bg-green-500/10 text-green-600 border-green-500/20", 
        icon: CheckCircle2,
        description: "Document has been signed by all parties"
      },
      "document.declined": { 
        label: "Declined", 
        color: "bg-red-500/10 text-red-600 border-red-500/20", 
        icon: XCircle,
        description: "Document was declined by the recipient"
      },
    };
    
    return statusMap[documentStatus.status] || { 
      label: documentStatus.status.replace("document.", ""), 
      color: "bg-muted", 
      icon: FileText,
      description: ""
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{documentName || documentStatus?.name || "Proposal"}</CardTitle>
                <CardDescription>
                  {documentStatus?.date_created && (
                    <>Created {format(new Date(documentStatus.date_created), "MMM d, yyyy 'at' h:mm a")}</>
                  )}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refreshStatus()}
              disabled={isRefreshing}
              data-testid="button-refresh-status"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className={`p-4 rounded-lg border ${statusInfo.color}`}>
            <div className="flex items-center gap-3">
              <StatusIcon className="h-5 w-5" />
              <div>
                <p className="font-medium">{statusInfo.label}</p>
                <p className="text-sm opacity-80">{statusInfo.description}</p>
              </div>
            </div>
          </div>

          {proposalEmails && proposalEmails.length > 0 && proposalEmails[0] && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Email Activity</p>
                  <p className="text-sm text-muted-foreground">
                    {(proposalEmails[0].openCount ?? 0) > 0 ? (
                      <>Opened {proposalEmails[0].openCount} time{(proposalEmails[0].openCount ?? 0) > 1 ? "s" : ""}</>
                    ) : proposalEmails[0].sentAt ? (
                      <>Sent {format(new Date(proposalEmails[0].sentAt), "MMM d, yyyy")}</>
                    ) : (
                      <>Pending</>
                    )}
                  </p>
                </div>
                {(proposalEmails[0].openCount ?? 0) > 0 ? (
                  <Badge variant="default" className="bg-green-600">
                    <Eye className="w-3 h-3 mr-1" />
                    Viewed
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => window.open(`https://app.pandadoc.com/documents/${activeDocId}`, "_blank")}
              data-testid="button-open-pandadoc"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {documentStatus?.status === "document.draft" ? "Edit in PandaDoc" : "View in PandaDoc"}
            </Button>

            {leadId && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => window.open(`/api/google/gmail/preview-proposal/${leadId}`, '_blank')}
                data-testid="button-preview-proposal"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview PDF
              </Button>
            )}

            {documentStatus?.status === "document.draft" && (
              <>
                {onOpenSendDialog && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={onOpenSendDialog}
                    data-testid="button-send-email"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send via Email
                  </Button>
                )}
                
                <Button
                  className="w-full"
                  onClick={() => sendDocumentMutation.mutate(activeDocId!)}
                  disabled={sendDocumentMutation.isPending}
                  data-testid="button-send-for-signature"
                >
                  {sendDocumentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send for Signature via PandaDoc
                </Button>
              </>
            )}
          </div>

          {documentStatus?.date_modified && (
            <p className="text-xs text-center text-muted-foreground">
              Last updated: {format(new Date(documentStatus.date_modified), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
