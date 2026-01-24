import { useState, useEffect } from "react";
import type { Lead, CpqQuote } from "@shared/schema";
import Calculator from "@/cpq/pages/Calculator";

export interface QuoteBuilderTabProps {
  lead: Lead;
  leadId: number;
  existingQuotes?: CpqQuote[];
  sourceQuote?: CpqQuote | null;
  onQuoteSaved?: () => void;
}

export default function QuoteBuilderTab({ lead, leadId, existingQuotes, sourceQuote, onQuoteSaved }: QuoteBuilderTabProps) {
  const latestQuoteId =
    sourceQuote?.id ||
    existingQuotes?.find((quote) => quote.isLatest)?.id ||
    existingQuotes?.[0]?.id;
  const [activeQuoteId, setActiveQuoteId] = useState<string | undefined>(
    latestQuoteId !== undefined ? String(latestQuoteId) : undefined
  );

  useEffect(() => {
    if (sourceQuote?.id) {
      setActiveQuoteId(String(sourceQuote.id));
      return;
    }
    if (!activeQuoteId && latestQuoteId !== undefined) {
      setActiveQuoteId(String(latestQuoteId));
    }
  }, [sourceQuote?.id, activeQuoteId, latestQuoteId]);

  // Use sourceQuote ID if available for editing, otherwise pass initial data from lead
  const initialData = {
    clientName: lead.clientName,
    projectName: lead.projectName || "",
    projectAddress: lead.projectAddress || "",
  };

  return (
    <div className="space-y-6">
      <Calculator
        quoteId={activeQuoteId}
        initialData={initialData}
        isEmbedded={true}
        onQuoteSaved={(savedQuoteId) => {
          if (savedQuoteId) {
            setActiveQuoteId(savedQuoteId);
          }
          onQuoteSaved?.();
        }}
        onVersionSelect={(newQuoteId) => {
          setActiveQuoteId(newQuoteId);
        }}
        leadId={leadId}
      />
    </div>
  );
}
