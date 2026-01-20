import { PandaDocEmbed } from "@/components/PandaDocEmbed";
import type { QueryClient } from "@tanstack/react-query";

interface PandaDocTabProps {
  pandaDocId: string | null;
  documentName?: string;
  leadId: number;
  quoteId?: number;
  queryClient: QueryClient;
  onOpenSendDialog?: () => void;
  proposalEmails?: Array<{ openCount: number | null; sentAt: Date | string | null }>;
}

export function PandaDocTab({
  pandaDocId,
  documentName,
  leadId,
  quoteId,
  queryClient,
  onOpenSendDialog,
  proposalEmails,
}: PandaDocTabProps) {
  return (
    <PandaDocEmbed
      pandaDocId={pandaDocId}
      documentName={documentName}
      leadId={leadId}
      quoteId={quoteId}
      onDocumentCreated={() => {
        queryClient.invalidateQueries({ queryKey: ['/api/leads', leadId] });
      }}
      onDocumentSent={() => {
        queryClient.invalidateQueries({ queryKey: ['/api/leads', leadId] });
      }}
      onOpenSendDialog={onOpenSendDialog}
      proposalEmails={proposalEmails}
    />
  );
}
