import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, ExternalLink, User, DollarSign, Building2 } from "lucide-react";

interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  projectName: string;
  clientName: string;
  contactName?: string;
  contactEmail?: string;
  billingContactName?: string;
  billingContactEmail?: string;
  quoteTotal?: number;
  onSend: (recipientEmail: string, customSubject: string) => void;
  isSending: boolean;
}

export function SendProposalDialog({
  open,
  onOpenChange,
  leadId,
  projectName,
  clientName,
  contactName,
  contactEmail,
  billingContactName,
  billingContactEmail,
  quoteTotal,
  onSend,
  isSending,
}: SendProposalDialogProps) {
  const defaultEmail = contactEmail || billingContactEmail || "";
  const defaultSubject = `Scan2Plan Proposal - ${projectName || clientName || "Your Project"}`;
  
  const [recipientEmail, setRecipientEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState(defaultSubject);
  const [selectedContact, setSelectedContact] = useState<"primary" | "billing" | "custom">(
    contactEmail ? "primary" : billingContactEmail ? "billing" : "custom"
  );

  useEffect(() => {
    if (open) {
      setRecipientEmail(defaultEmail);
      setSubject(defaultSubject);
      setSelectedContact(contactEmail ? "primary" : billingContactEmail ? "billing" : "custom");
    }
  }, [open, defaultEmail, defaultSubject, contactEmail, billingContactEmail]);

  const handleContactSelect = (type: "primary" | "billing" | "custom") => {
    setSelectedContact(type);
    if (type === "primary" && contactEmail) {
      setRecipientEmail(contactEmail);
    } else if (type === "billing" && billingContactEmail) {
      setRecipientEmail(billingContactEmail);
    }
  };

  const handleSend = () => {
    if (!recipientEmail.trim()) return;
    onSend(recipientEmail.trim(), subject.trim());
  };

  const isValidEmail = recipientEmail.includes("@") && recipientEmail.includes(".");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-send-proposal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Proposal Email
          </DialogTitle>
          <DialogDescription>
            Review and confirm the recipient before sending the proposal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{projectName}</span>
            </div>
            {quoteTotal && quoteTotal > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <Badge variant="secondary">
                  ${quoteTotal.toLocaleString()}
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Select Recipient</Label>
            <div className="flex flex-wrap gap-2">
              {contactEmail && (
                <Button
                  type="button"
                  variant={selectedContact === "primary" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleContactSelect("primary")}
                  className="gap-2"
                  data-testid="button-select-primary-contact"
                >
                  <User className="w-3 h-3" />
                  {contactName || "Primary Contact"}
                </Button>
              )}
              {billingContactEmail && billingContactEmail !== contactEmail && (
                <Button
                  type="button"
                  variant={selectedContact === "billing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleContactSelect("billing")}
                  className="gap-2"
                  data-testid="button-select-billing-contact"
                >
                  <User className="w-3 h-3" />
                  {billingContactName || "Billing Contact"}
                </Button>
              )}
              <Button
                type="button"
                variant={selectedContact === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => handleContactSelect("custom")}
                data-testid="button-select-custom-email"
              >
                Custom Email
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient-email">Recipient Email</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="client@example.com"
              value={recipientEmail}
              onChange={(e) => {
                setRecipientEmail(e.target.value);
                if (selectedContact !== "custom") {
                  setSelectedContact("custom");
                }
              }}
              data-testid="input-recipient-email"
            />
            {recipientEmail && !isValidEmail && (
              <p className="text-xs text-destructive">Please enter a valid email address</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject Line</Label>
            <Input
              id="email-subject"
              placeholder="Proposal subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-email-subject"
            />
          </div>

          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground gap-1"
              onClick={() => window.open(`/api/google/gmail/preview-proposal/${leadId}`, '_blank')}
              data-testid="button-preview-in-dialog"
            >
              <ExternalLink className="w-3 h-3" />
              Preview proposal content in new tab
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            data-testid="button-cancel-send-proposal"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || !recipientEmail.trim() || !isValidEmail}
            data-testid="button-confirm-send-proposal"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Proposal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
