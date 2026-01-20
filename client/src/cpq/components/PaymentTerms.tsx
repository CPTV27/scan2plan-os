import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface PaymentTermsProps {
  value: string;
  onChange: (value: string) => void;
}

const PAYMENT_OPTIONS = [
  { value: "net30", label: "Net 30 Days (0% interest)", interest: 0 },
  { value: "net60", label: "Net 60 Days (+10% interest)", interest: 10 },
  { value: "net90", label: "Net 90 Days (+20% interest)", interest: 20 },
];

export default function PaymentTerms({ value, onChange }: PaymentTermsProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Payment Terms</h3>
          <p className="text-sm text-muted-foreground">
            Select payment terms for this quote
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-terms">Payment Terms</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger id="payment-terms" data-testid="select-payment-terms">
              <SelectValue placeholder="Select payment terms" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}



