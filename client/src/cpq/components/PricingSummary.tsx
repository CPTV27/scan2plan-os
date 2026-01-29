import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface PricingLineItem {
  label: string;
  value: number;
  editable?: boolean;
  isDiscount?: boolean;
  isTotal?: boolean;
  isAreaHeader?: boolean;
  upteamCost?: number;
}

interface PricingSummaryProps {
  items: PricingLineItem[];
  onEdit?: (index: number, value: number) => void;
  totalClientPrice?: number;
  totalUpteamCost?: number;
}

export default function PricingSummary({ items, onEdit, totalClientPrice, totalUpteamCost }: PricingSummaryProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleEdit = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    onEdit?.(index, numValue);
    setEditingIndex(null);
  };
  
  // Extract square footage from label and calculate per-sqft rate
  const extractSqftAndRate = (label: string, value: number): { sqft: number; rate: number } | null => {
    // Match patterns like "(3,000 sqft" or "(3000 sqft" or "× 3,000 sqft"
    const sqftMatch = label.match(/[\(×]\s*([0-9,]+)\s+sqft/i);
    if (sqftMatch) {
      const sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
      if (sqft > 0) {
        return { sqft, rate: value / sqft };
      }
    }
    return null;
  };
  
  const profitMargin = totalClientPrice && totalUpteamCost ? totalClientPrice - totalUpteamCost : 0;
  const profitMarginPercent = totalClientPrice && totalUpteamCost && totalUpteamCost > 0 
    ? ((profitMargin / totalUpteamCost) * 100) 
    : 0;

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle>Pricing Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => {
          const sqftData = extractSqftAndRate(item.label, item.value);

          // Area header - render with border, no value
          if (item.isAreaHeader) {
            return (
              <div key={index} className="border border-border rounded-md p-2 mt-4 first:mt-0 bg-muted/30">
                <span className="text-sm font-semibold text-foreground">
                  {item.label}
                </span>
              </div>
            );
          }

          return (
            <div key={index}>
              {item.isTotal && index > 0 && <Separator className="my-4" />}
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    item.isTotal
                      ? "font-bold text-lg"
                      : item.isDiscount
                      ? "text-green-600"
                      : ""
                  }`}
                >
                  {item.label}
                </span>
                {item.editable && editingIndex === index ? (
                  <Input
                    type="number"
                    className="w-32 h-8 text-right font-mono"
                    defaultValue={item.value}
                    onBlur={(e) => handleEdit(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleEdit(index, e.currentTarget.value);
                      }
                    }}
                    autoFocus
                    data-testid={`input-edit-price-${index}`}
                  />
                ) : (
                  <span
                    className={`font-mono ${
                      item.isTotal ? "font-bold text-lg" : "text-sm"
                    } ${
                      item.isDiscount ? "text-green-600" : ""
                    } ${
                      item.editable ? "cursor-pointer hover:underline hover:text-primary" : ""
                    }`}
                    onClick={() => item.editable && setEditingIndex(index)}
                    data-testid={`text-price-${index}`}
                  >
                    {item.isDiscount && "- "}${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              {sqftData && !item.isTotal && !item.isDiscount && sqftData.rate > 0.001 && (
                <div className="flex items-center justify-end mt-0.5">
                  <span className="font-mono text-xs text-muted-foreground/70">
                    ${sqftData.rate.toFixed(2)}/sqft
                  </span>
                </div>
              )}
            </div>
          );
        })}
        
        {totalClientPrice !== undefined && totalUpteamCost !== undefined && (
          <>
            <Separator className="my-6" />
            <div className="space-y-3 pt-2">
              <h3 className="font-semibold text-sm text-muted-foreground">COST SUMMARY (Internal)</h3>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Client Price</span>
                <span className="font-mono text-sm font-semibold">
                  ${totalClientPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <Separator className="my-3" />
              
              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase">Upteam Cost Breakdown</h4>
                {items.filter(item => item.upteamCost !== undefined && item.upteamCost > 0).map((item, idx) => {
                  const sqftData = extractSqftAndRate(item.label, item.upteamCost || 0);
                  return (
                    <div key={`upteam-${idx}`} className="pl-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          ${(item.upteamCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {sqftData && sqftData.rate > 0.001 && (
                        <div className="flex items-center justify-end">
                          <span className="font-mono text-xs text-muted-foreground/70">
                            ${sqftData.rate.toFixed(2)}/sqft
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <Separator className="my-3" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total Upteam Cost</span>
                <span className="font-mono text-sm font-semibold text-muted-foreground">
                  ${totalUpteamCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Profit Margin</span>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-green-600">
                    ${profitMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="font-mono text-xs text-green-600">
                    {profitMarginPercent.toFixed(1)}% markup
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}



