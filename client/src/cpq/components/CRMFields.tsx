import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface CRMFieldsProps {
  data: {
    assumedGrossMargin: string;
    caveatsProfitability: string;
    tierAScanningCost: string;
    tierAScanningCostOther: string;
    tierAModelingCost: string;
    tierAMargin: string;
  };
  onChange: (field: string, value: any) => void;
}

export default function CRMFields({ data, onChange }: CRMFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Internal Notes */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Internal Notes</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assumed-margin" className="text-sm font-medium">
              Assumed Gross Margin
            </Label>
            <Input
              id="assumed-margin"
              placeholder="e.g., 30%"
              value={data.assumedGrossMargin}
              onChange={(e) => onChange('assumedGrossMargin', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caveats-profitability" className="text-sm font-medium">
              Caveats for Profitability
            </Label>
            <Textarea
              id="caveats-profitability"
              placeholder="Note any factors that could affect profitability..."
              value={data.caveatsProfitability}
              onChange={(e) => onChange('caveatsProfitability', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </Card>

      {/* Tier A Pricing */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Tier A Pricing (Internal)</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tier A - Scanning Cost
            </Label>
            <RadioGroup value={data.tierAScanningCost} onValueChange={(val) => onChange('tierAScanningCost', val)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3500" id="tier-scan-3500" />
                <Label htmlFor="tier-scan-3500" className="cursor-pointer">$3,500</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="7000" id="tier-scan-7000" />
                <Label htmlFor="tier-scan-7000" className="cursor-pointer">$7,000</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="10500" id="tier-scan-10500" />
                <Label htmlFor="tier-scan-10500" className="cursor-pointer">$10,500</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="15000" id="tier-scan-15000" />
                <Label htmlFor="tier-scan-15000" className="cursor-pointer">$15,000</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="18500" id="tier-scan-18500" />
                <Label htmlFor="tier-scan-18500" className="cursor-pointer">$18,500</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="tier-scan-other" />
                <Label htmlFor="tier-scan-other" className="cursor-pointer">Other</Label>
              </div>
            </RadioGroup>
            {data.tierAScanningCost === 'other' && (
              <Input
                placeholder="Specify scanning cost"
                value={data.tierAScanningCostOther}
                onChange={(e) => onChange('tierAScanningCostOther', e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tier-modeling-cost" className="text-sm font-medium">
              Tier A - Modeling Cost
            </Label>
            <Input
              id="tier-modeling-cost"
              placeholder="Enter modeling cost"
              value={data.tierAModelingCost}
              onChange={(e) => onChange('tierAModelingCost', e.target.value)}
            />
            <a 
              href="https://docs.google.com/spreadsheets/d/192MhTytrT01h05V3xOugBXm7dFcxl4ZMxcwuVUCQAuo/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View Modeling Cost Reference
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tier-margin" className="text-sm font-medium">
              Tier A - Margin
            </Label>
            <Select value={data.tierAMargin} onValueChange={(val) => onChange('tierAMargin', val)}>
              <SelectTrigger id="tier-margin">
                <SelectValue placeholder="Select margin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2.352">2.352X (1.68 overhead X 1.4 min GM)</SelectItem>
                <SelectItem value="2.5">2.5X</SelectItem>
                <SelectItem value="3">3X</SelectItem>
                <SelectItem value="3.5">3.5X</SelectItem>
                <SelectItem value="4">4X</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

    </div>
  );
}



