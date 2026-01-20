import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, History, Loader2, FileText, Calculator, ExternalLink, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { CpqQuote } from "@shared/schema";

interface VersionHistoryTabProps {
  quotes: CpqQuote[] | undefined;
  quotesLoading: boolean;
  onViewQuote: (quote: CpqQuote) => void;
  onNavigateToQuoteBuilder: () => void;
}

export function VersionHistoryTab({ 
  quotes, 
  quotesLoading, 
  onViewQuote,
  onNavigateToQuoteBuilder 
}: VersionHistoryTabProps) {
  return (
    <ScrollArea className="h-full flex-1">
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Quote Version History
              </CardTitle>
              <CardDescription>
                Track all quote revisions for this deal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quotesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : quotes && quotes.length > 0 ? (
                <div className="space-y-3">
                  {quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className={`p-4 rounded-lg border transition-colors cursor-pointer hover-elevate ${
                        quote.isLatest ? "border-primary/50 bg-primary/5" : "border-border"
                      }`}
                      data-testid={`version-card-${quote.id}`}
                      onClick={() => onViewQuote(quote)}
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Version {quote.versionNumber}</span>
                          {quote.isLatest && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                          {(quote as any).createdBy === "external-cpq" && (
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                              External CPQ
                            </Badge>
                          )}
                          {quote.versionName && (
                            <span className="text-muted-foreground text-sm">
                              ({quote.versionName})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {quote.createdAt &&
                            formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Quote: <span className="font-mono">{quote.quoteNumber}</span>
                        </span>
                        {quote.totalPrice && (
                          <span className="font-medium">
                            ${Number(quote.totalPrice).toLocaleString()}
                          </span>
                        )}
                        {quote.createdBy && quote.createdBy !== "external-cpq" && (
                          <span className="text-muted-foreground">
                            by {quote.createdBy}
                          </span>
                        )}
                        {(quote as any).externalCpqUrl && (
                          <a
                            href={(quote as any).externalCpqUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            View in CPQ
                          </a>
                        )}
                      </div>
                      {((quote as any).internalCosts?.tierAScanningCost != null || (quote as any).pricingBreakdown?.items?.length > 0) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-2 pt-2 border-t border-muted">
                          {(quote as any).internalCosts?.tierAScanningCost != null && (
                            <span className="text-muted-foreground">
                              Scanning: <span className="font-mono font-medium text-foreground">${Number((quote as any).internalCosts.tierAScanningCost).toLocaleString()}</span>
                            </span>
                          )}
                          {(quote as any).internalCosts?.tierAModelingCost != null && (
                            <span className="text-muted-foreground">
                              Modeling: <span className="font-mono font-medium text-foreground">${Number((quote as any).internalCosts.tierAModelingCost).toLocaleString()}</span>
                            </span>
                          )}
                          {(quote as any).internalCosts?.assumedMargin && (
                            <span className="text-muted-foreground">
                              Target Margin: <span className="font-mono font-medium text-foreground">{(quote as any).internalCosts.assumedMargin}%</span>
                            </span>
                          )}
                          {!(quote as any).internalCosts?.tierAScanningCost && (quote as any).pricingBreakdown?.items?.slice(0, 3).map((item: any, idx: number) => (
                            <span key={idx} className="text-muted-foreground">
                              {item.label}: <span className="font-mono font-medium text-foreground">${Number(item.value).toLocaleString()}</span>
                            </span>
                          ))}
                          {!(quote as any).internalCosts?.tierAScanningCost && (quote as any).pricingBreakdown?.items?.length > 3 && (
                            <span className="text-muted-foreground text-xs">
                              +{(quote as any).pricingBreakdown.items.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-1">No Quotes Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first quote using the Quote Builder tab.
                  </p>
                  <Button
                    variant="default"
                    onClick={onNavigateToQuoteBuilder}
                    data-testid="button-create-first-quote"
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Start Quote
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
  );
}
