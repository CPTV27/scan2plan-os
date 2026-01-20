import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Mail, 
  Copy, 
  CheckCircle2, 
  MessageSquare,
  Send,
  Edit2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissingInfoEntry } from "@/features/deals/types";
import { useToast } from "@/hooks/use-toast";

interface FollowUpBuilderProps {
  contactName: string;
  contactEmail: string;
  projectName: string;
  missingInfo: MissingInfoEntry[];
  onMarkAsSent: (fieldKeys: string[]) => void;
  className?: string;
}

export function FollowUpBuilder({
  contactName,
  contactEmail,
  projectName,
  missingInfo,
  onMarkAsSent,
  className,
}: FollowUpBuilderProps) {
  const { toast } = useToast();
  const pendingItems = missingInfo.filter(m => m.status === "pending");
  const [isEditing, setIsEditing] = useState(false);
  const [userEditedContent, setUserEditedContent] = useState<string | null>(null);
  
  const generatedEmail = useMemo(() => {
    const firstName = contactName.split(" ")[0] || "there";
    const questionsList = pendingItems
      .map((item, idx) => `${idx + 1}. ${item.question}`)
      .join("\n");
    
    return `Hi ${firstName},

I hope this message finds you well! I'm following up regarding your ${projectName} project.

To provide you with the most accurate proposal, I need a few additional details:

${questionsList}

Please take a moment to reply with these details, or let me know if you'd like to discuss them over a quick call.

Thank you for your time, and I look forward to helping you move this project forward!

Best regards,
The Scan2Plan Team`;
  }, [contactName, projectName, pendingItems]);

  const emailContent = userEditedContent ?? generatedEmail;

  if (pendingItems.length === 0) {
    return null;
  }

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailContent);
      toast({
        title: "Email copied",
        description: "The follow-up email has been copied to your clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard. Please select and copy manually.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsSent = () => {
    const fieldKeys = pendingItems.map(item => item.fieldKey);
    onMarkAsSent(fieldKeys);
    toast({
      title: "Marked as sent",
      description: `${pendingItems.length} follow-up question${pendingItems.length > 1 ? 's' : ''} marked as sent.`,
    });
  };

  const handleOpenMailClient = () => {
    const subject = encodeURIComponent(`Follow-up: ${projectName}`);
    const body = encodeURIComponent(emailContent);
    window.open(`mailto:${contactEmail}?subject=${subject}&body=${body}`, "_blank");
    handleMarkAsSent();
  };

  return (
    <Card className={cn("border-amber-500/30 bg-amber-500/5", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">Follow-Up Builder</CardTitle>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            {pendingItems.length} question{pendingItems.length > 1 ? "s" : ""} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Questions to include:</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isEditing) {
                  setUserEditedContent(null);
                }
                setIsEditing(!isEditing);
              }}
              className="h-6 text-xs"
              data-testid="button-toggle-edit-email"
            >
              <Edit2 className="h-3 w-3 mr-1" />
              {isEditing ? "Reset & Preview" : "Edit Email"}
            </Button>
          </div>
          
          {!isEditing && (
            <ul className="space-y-1">
              {pendingItems.map((item, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <MessageSquare className="h-3 w-3 text-amber-500 mt-1 flex-shrink-0" />
                  <span>{item.question}</span>
                </li>
              ))}
            </ul>
          )}
          
          {isEditing && (
            <Textarea
              value={emailContent}
              onChange={(e) => setUserEditedContent(e.target.value)}
              className="min-h-[200px] text-sm font-mono"
              data-testid="textarea-email-content"
            />
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleOpenMailClient}
            className="flex-1"
            data-testid="button-send-email"
          >
            <Send className="h-4 w-4 mr-2" />
            Open in Email Client
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyEmail}
            data-testid="button-copy-email"
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMarkAsSent}
            data-testid="button-mark-sent"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Mark Sent
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground pt-1">
          Sending to: <span className="font-medium">{contactEmail}</span>
        </p>
      </CardContent>
    </Card>
  );
}
