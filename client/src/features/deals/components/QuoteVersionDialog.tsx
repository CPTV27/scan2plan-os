import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Building2,
  Calculator,
  DollarSign,
  FileText,
} from "lucide-react";
import { CPQ_PAYMENT_TERMS_DISPLAY } from "@shared/schema";
import type { CpqQuote } from "@shared/schema";

interface QuoteVersionDialogProps {
  quote: CpqQuote | null;
  onClose: () => void;
  onEditVersion: (quote: CpqQuote) => void;
}

export function QuoteVersionDialog({
  quote,
  onClose,
  onEditVersion,
}: QuoteVersionDialogProps) {
  return (
    <Dialog open={!!quote} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quote Version {quote?.versionNumber}
            {quote?.isLatest && (
              <Badge variant="default" className="ml-2">Current</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Quote #{quote?.quoteNumber} - Created {quote?.createdAt && formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>

        {quote && (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Project</Label>
                <p className="font-medium">{quote.projectName}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Total Price</Label>
                <p className="font-semibold text-lg">
                  ${Number(quote.totalPrice || 0).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Address</Label>
                <p className="text-sm">{quote.projectAddress}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Building Type</Label>
                <p className="text-sm">{quote.typeOfBuilding}</p>
              </div>
              {quote.paymentTerms && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Payment Terms</Label>
                  <p className="text-sm">{CPQ_PAYMENT_TERMS_DISPLAY[quote.paymentTerms as keyof typeof CPQ_PAYMENT_TERMS_DISPLAY] || quote.paymentTerms}</p>
                </div>
              )}
              {quote.dispatchLocation && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Dispatch Location</Label>
                  <p className="text-sm capitalize">{quote.dispatchLocation}</p>
                </div>
              )}
            </div>

            <Separator />

            {quote.areas && Array.isArray(quote.areas) && (quote.areas as any[]).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Areas ({(quote.areas as any[]).length})
                </h4>
                <div className="space-y-2">
                  {(quote.areas as any[]).map((area: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{area.name || `Area ${idx + 1}`}</span>
                        <span className="text-sm text-muted-foreground">
                          {Number(area.squareFeet || area.sqft || 0).toLocaleString()} SF
                        </span>
                      </div>
                      {area.disciplines && area.disciplines.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {area.disciplines.map((disc: any, dIdx: number) => (
                            <Badge key={dIdx} variant="secondary" className="text-xs">
                              {typeof disc === 'string' ? disc.toUpperCase() : disc.discipline?.toUpperCase()}
                              {typeof disc !== 'string' && disc.lod && ` (LOD ${disc.lod})`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quote.pricingBreakdown && (quote.pricingBreakdown as any).items && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Pricing Breakdown
                </h4>
                <div className="space-y-1">
                  {((quote.pricingBreakdown as any).items as any[]).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-muted last:border-0">
                      <span className="text-sm">{item.label}</span>
                      <span className="font-mono text-sm">${Number(item.value || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quote.risks && Array.isArray(quote.risks) && (quote.risks as string[]).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Risk Factors
                </h4>
                <div className="flex flex-wrap gap-1">
                  {(quote.risks as string[]).map((risk: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {risk.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {quote.notes && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notes
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button
                className="w-full"
                onClick={() => onEditVersion(quote)}
                data-testid="button-edit-this-version"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Edit This Version
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Creates a new version based on this quote
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
