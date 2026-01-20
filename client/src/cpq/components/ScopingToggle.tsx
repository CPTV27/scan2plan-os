import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface ScopingToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function ScopingToggle({ enabled, onChange }: ScopingToggleProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="scoping-mode" className="text-base font-semibold cursor-pointer">
            Detailed Scoping Mode
          </Label>
          <p className="text-sm text-muted-foreground">
            Enable to add comprehensive project details and file uploads
          </p>
        </div>
        <Switch
          id="scoping-mode"
          checked={enabled}
          onCheckedChange={onChange}
          data-testid="switch-scoping-mode"
        />
      </div>
    </Card>
  );
}



