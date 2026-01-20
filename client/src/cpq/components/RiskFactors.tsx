import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const RISK_FACTORS = [
  { id: "occupied", label: "Occupied Building (+15%)" },
  { id: "hazardous", label: "Hazardous Conditions (+25%)" },
  { id: "noPower", label: "No Power/HVAC (+20%)" },
];

interface RiskFactorsProps {
  selectedRisks: string[];
  onRiskChange: (riskId: string, checked: boolean) => void;
}

export default function RiskFactors({ selectedRisks, onRiskChange }: RiskFactorsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Risk Factors</h3>
      <p className="text-sm text-muted-foreground">
        Select any risk factors that apply. Premiums apply to Architecture discipline only.
      </p>
      
      <div className="grid gap-3">
        {RISK_FACTORS.map((risk) => {
          const isSelected = selectedRisks.includes(risk.id);
          return (
            <Card
              key={risk.id}
              className={`p-4 cursor-pointer transition-colors hover-elevate ${
                isSelected ? "border-destructive bg-destructive/5" : ""
              }`}
              onClick={() => onRiskChange(risk.id, !isSelected)}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={risk.id}
                  checked={isSelected}
                  onCheckedChange={(checked) => onRiskChange(risk.id, checked as boolean)}
                  data-testid={`checkbox-risk-${risk.id}`}
                />
                <Label htmlFor={risk.id} className="text-sm font-medium cursor-pointer">
                  {risk.label}
                </Label>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}



