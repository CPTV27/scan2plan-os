import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Brain, FileText, Target, Mail, Loader2, Copy, Check } from "lucide-react";
import type { Lead } from "@shared/schema";
import { api } from "@shared/routes";

interface AIActionsProps {
  lead: Lead;
}

export function AIActions({ lead }: AIActionsProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogContent, setDialogContent] = useState("");
  const [copied, setCopied] = useState(false);

  const descriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai/generate-description/${lead.id}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setDialogTitle("Quote Description");
      setDialogContent(data.description);
      setDialogOpen(true);
    },
    onError: () => {
      toast({ title: "Failed to generate description", variant: "destructive" });
    }
  });

  const probabilityMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai/suggest-probability/${lead.id}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setDialogTitle("Suggested Probability");
      setDialogContent(`Suggested: ${data.probability}%\n\nReasoning: ${data.reasoning}`);
      setDialogOpen(true);
    },
    onError: () => {
      toast({ title: "Failed to suggest probability", variant: "destructive" });
    }
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai/draft-email/${lead.id}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setDialogTitle("Follow-up Email Draft");
      setDialogContent(data.email);
      setDialogOpen(true);
    },
    onError: () => {
      toast({ title: "Failed to draft email", variant: "destructive" });
    }
  });

  const applyProbability = async () => {
    const match = dialogContent.match(/Suggested: (\d+)%/);
    if (match) {
      const probability = parseInt(match[1]);
      try {
        await apiRequest("PUT", `/api/leads/${lead.id}`, {
          clientName: lead.clientName,
          projectAddress: lead.projectAddress,
          value: Number(lead.value),
          dealStage: lead.dealStage,
          probability,
        });
        queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
        toast({ title: "Probability updated", description: `Set to ${probability}%` });
        setDialogOpen(false);
      } catch {
        toast({ title: "Failed to update", variant: "destructive" });
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dialogContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const isLoading = descriptionMutation.isPending || probabilityMutation.isPending || emailMutation.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            disabled={isLoading}
            data-testid={`button-ai-actions-${lead.id}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4 text-primary" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-xs text-muted-foreground">AI Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => descriptionMutation.mutate()}
            data-testid={`ai-generate-description-${lead.id}`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Quote Description
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => probabilityMutation.mutate()}
            data-testid={`ai-suggest-probability-${lead.id}`}
          >
            <Target className="w-4 h-4 mr-2" />
            Suggest Probability
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => emailMutation.mutate()}
            data-testid={`ai-draft-email-${lead.id}`}
          >
            <Mail className="w-4 h-4 mr-2" />
            Draft Follow-up Email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              {dialogTitle}
            </DialogTitle>
            <DialogDescription>
              AI-generated content for {lead.clientName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea 
              value={dialogContent}
              onChange={(e) => setDialogContent(e.target.value)}
              className="min-h-[150px] text-sm"
              data-testid="textarea-ai-result"
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={copyToClipboard}
                data-testid="button-copy-result"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              {dialogTitle === "Suggested Probability" && (
                <Button 
                  size="sm"
                  onClick={applyProbability}
                  data-testid="button-apply-probability"
                >
                  Apply to Deal
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
