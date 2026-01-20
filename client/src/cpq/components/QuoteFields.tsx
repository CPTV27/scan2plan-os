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

    </div>
  );
}



