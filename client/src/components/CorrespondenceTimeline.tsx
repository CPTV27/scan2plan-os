import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Mail, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Paperclip, 
  ArrowDownLeft, 
  ArrowUpRight,
  MessageSquare,
  Clock,
  User,
  AlertCircle,
  Loader2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface EmailThread {
  id: number;
  leadId: number;
  gmailThreadId: string;
  subject: string;
  participants: string[];
  snippet: string;
  messageCount: number;
  hasAttachments: boolean;
  lastMessageAt: string;
}

interface EmailMessage {
  id: number;
  threadId: number;
  gmailMessageId: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyPreview: string;
  bodyHtml: string | null;
  hasAttachments: boolean;
  attachmentNames: string[];
  isInbound: boolean;
  sentAt: string;
}

interface CorrespondenceTimelineProps {
  leadId: number;
  contactEmail?: string | null;
}

export function CorrespondenceTimeline({ leadId, contactEmail }: CorrespondenceTimelineProps) {
  const queryClient = useQueryClient();
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());

  const { data: threads, isLoading, error } = useQuery<EmailThread[]>({
    queryKey: ['/api/emails/leads', leadId, 'threads'],
    queryFn: () => fetch(`/api/emails/leads/${leadId}/threads`).then(r => r.json()),
    enabled: !!leadId,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/emails/leads/${leadId}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails/leads', leadId, 'threads'] });
    },
  });

  const toggleThread = (threadId: number) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Correspondence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <p className="text-sm font-medium">Unable to load emails</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please ensure Gmail is connected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Correspondence
            </CardTitle>
            <CardDescription className="mt-1">
              {threads?.length || 0} conversation{threads?.length !== 1 ? 's' : ''} with deal contacts
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !contactEmail}
            data-testid="button-sync-emails"
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-2">Sync Emails</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !threads || threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm font-medium">No email history found</p>
            <p className="text-xs mt-1">
              {contactEmail 
                ? "Click 'Sync Emails' to fetch conversations from Gmail" 
                : "Add a contact email to sync correspondence"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                isExpanded={expandedThreads.has(thread.id)}
                onToggle={() => toggleThread(thread.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ThreadCardProps {
  thread: EmailThread;
  isExpanded: boolean;
  onToggle: () => void;
}

function ThreadCard({ thread, isExpanded, onToggle }: ThreadCardProps) {
  const { data: messages, isLoading } = useQuery<EmailMessage[]>({
    queryKey: ['/api/emails/threads', thread.id, 'messages'],
    queryFn: () => fetch(`/api/emails/threads/${thread.id}/messages`).then(r => r.json()),
    enabled: isExpanded,
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full p-3 text-left hover-elevate flex items-start gap-3 transition-colors"
            data-testid={`thread-${thread.id}`}
          >
            <div className="mt-0.5">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{thread.subject || "(No subject)"}</span>
                {thread.hasAttachments && (
                  <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{thread.snippet}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="bg-muted/30">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="divide-y">
                {messages.map((msg) => (
                  <MessageItem key={msg.id} message={msg} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No messages found
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface MessageItemProps {
  message: EmailMessage;
}

function MessageItem({ message }: MessageItemProps) {
  const [showFull, setShowFull] = useState(false);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-full ${message.isInbound ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
          {message.isInbound ? (
            <ArrowDownLeft className={`w-3 h-3 ${message.isInbound ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
          ) : (
            <ArrowUpRight className="w-3 h-3 text-green-600 dark:text-green-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {message.fromName || message.fromEmail}
            </span>
            <Badge variant="outline" className="text-xs">
              {message.isInbound ? 'Received' : 'Sent'}
            </Badge>
            {message.hasAttachments && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Paperclip className="w-3 h-3" />
                {message.attachmentNames.length}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(message.sentAt), 'MMM d, yyyy h:mm a')}
          </div>
        </div>
      </div>
      
      <div className="ml-8">
        {showFull && message.bodyHtml ? (
          <div 
            className="text-sm prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{message.bodyPreview}</p>
        )}
        
        {message.bodyHtml && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() => setShowFull(!showFull)}
            data-testid={`toggle-message-${message.id}`}
          >
            {showFull ? 'Show less' : 'Show full email'}
          </Button>
        )}
      </div>
    </div>
  );
}
