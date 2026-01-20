import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface ProjectDetailsFormProps {
  clientName: string;
  projectName: string;
  projectAddress: string;
  specificBuilding: string;
  hasBasement: boolean;
  hasAttic: boolean;
  notes: string;
  onFieldChange: (field: string, value: string | boolean) => void;
}

export default function ProjectDetailsForm({
  clientName,
  projectName,
  projectAddress,
  specificBuilding,
  hasBasement,
  hasAttic,
  notes,
  onFieldChange,
}: ProjectDetailsFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Project Details</h3>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client-name" className="text-sm font-medium">
            Client Name
          </Label>
          <Input
            id="client-name"
            placeholder="Optional"
            value={clientName}
            onChange={(e) => onFieldChange('clientName', e.target.value)}
            data-testid="input-client-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-name" className="text-sm font-medium">
            Project Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="project-name"
            placeholder="Required"
            value={projectName}
            onChange={(e) => onFieldChange('projectName', e.target.value)}
            required
            data-testid="input-project-name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-address" className="text-sm font-medium">
          Project Address <span className="text-destructive">*</span>
        </Label>
        <Input
          id="project-address"
          placeholder="Enter full project address"
          value={projectAddress}
          onChange={(e) => onFieldChange('projectAddress', e.target.value)}
          required
          data-testid="input-project-address"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="specific-building" className="text-sm font-medium">
          Specific Building or Unit?
        </Label>
        <Input
          id="specific-building"
          placeholder="Enter building or unit details"
          value={specificBuilding}
          onChange={(e) => onFieldChange('specificBuilding', e.target.value)}
          data-testid="input-specific-building"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Building Features</Label>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="has-basement"
              checked={hasBasement}
              onCheckedChange={(checked) => onFieldChange('hasBasement', checked as boolean)}
              data-testid="checkbox-basement"
            />
            <Label htmlFor="has-basement" className="cursor-pointer font-normal">
              Has Basement
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="has-attic"
              checked={hasAttic}
              onCheckedChange={(checked) => onFieldChange('hasAttic', checked as boolean)}
              data-testid="checkbox-attic"
            />
            <Label htmlFor="has-attic" className="cursor-pointer font-normal">
              Has Attic
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          Project Notes
        </Label>
        <Textarea
          id="notes"
          placeholder="Add any special requirements or notes..."
          value={notes}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          rows={4}
          data-testid="textarea-notes"
        />
      </div>
    </div>
  );
}



