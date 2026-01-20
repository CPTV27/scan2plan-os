import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";

interface QuoteFieldsProps {
  data: {
    paymentTerms: string;
    paymentTermsOther: string;
    paymentNotes: string;
  };
  onChange: (field: string, value: any) => void;
}

export default function QuoteFields({ data, onChange }: QuoteFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Payment Terms */}
      <Card className="p-4 bg-accent/50">
        <h3 className="text-lg font-semibold mb-4">Payment Terms</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Payment Terms
            </Label>
            <RadioGroup value={data.paymentTerms} onValueChange={(val) => onChange('paymentTerms', val)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partner" id="payment-partner" />
                <Label htmlFor="payment-partner" className="cursor-pointer">Partner (no hold on production)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="owner" id="payment-owner" />
                <Label htmlFor="payment-owner" className="cursor-pointer">Owner (hold if delay)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="net30" id="payment-net30" />
                <Label htmlFor="payment-net30" className="cursor-pointer">Net 30 +5%</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="net60" id="payment-net60" />
                <Label htmlFor="payment-net60" className="cursor-pointer">Net 60 +10%</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="net90" id="payment-net90" />
                <Label htmlFor="payment-net90" className="cursor-pointer">Net 90 +15%</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="payment-other" />
                <Label htmlFor="payment-other" className="cursor-pointer">Other</Label>
              </div>
            </RadioGroup>
            {data.paymentTerms === 'other' && (
              <Input
                placeholder="Specify payment terms"
                value={data.paymentTermsOther}
                onChange={(e) => onChange('paymentTermsOther', e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes" className="text-sm font-medium">
              Payment Notes
            </Label>
            <Textarea
              id="payment-notes"
              placeholder="Additional payment-related notes..."
              value={data.paymentNotes}
              onChange={(e) => onChange('paymentNotes', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}



