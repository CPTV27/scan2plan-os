import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import FileUpload from "./FileUpload";

interface ScopeFieldsProps {
  data: {
    bimDeliverable: string[];
    bimDeliverableOther: string;
    bimVersion: string;
    customTemplate: string;
    customTemplateOther: string;
    customTemplateFiles: any[];
    sqftAssumptions: string;
    sqftAssumptionsFiles: any[];
    projectNotes: string;
    scopingDocuments: any[];
    mixedScope: string;
    insuranceRequirements: string;
    designProContact: string;
    designProCompanyContact: string;
    otherContact: string;
  };
  onChange: (field: string, value: any) => void;
}

export default function ScopeFields({ data, onChange }: ScopeFieldsProps) {
  const handleCheckboxArrayChange = (field: string, value: string, checked: boolean) => {
    const currentValues = (data[field as keyof typeof data] as string[]) || [];
    const newValues = checked 
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    onChange(field, newValues);
  };

  return (
    <div className="space-y-6">
      {/* Deliverables */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Deliverables</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              BIM Deliverable
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {['Revit', 'Archicad', 'Sketchup', 'Rhino', 'Other'].map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    id={`bim-${option}`}
                    checked={(data.bimDeliverable || []).includes(option)}
                    onCheckedChange={(checked) => handleCheckboxArrayChange('bimDeliverable', option, checked as boolean)}
                  />
                  <Label htmlFor={`bim-${option}`} className="cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {(data.bimDeliverable || []).includes('Other') && (
              <Input
                placeholder="Specify other"
                value={data.bimDeliverableOther}
                onChange={(e) => onChange('bimDeliverableOther', e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bim-version" className="text-sm font-medium">
              Which BIM Version?
            </Label>
            <Input
              id="bim-version"
              placeholder="e.g., Revit 2024"
              value={data.bimVersion}
              onChange={(e) => onChange('bimVersion', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Custom Template?
            </Label>
            <RadioGroup value={data.customTemplate} onValueChange={(val) => onChange('customTemplate', val)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="template-yes" />
                <Label htmlFor="template-yes" className="cursor-pointer">Yes, will provide</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="template-no" />
                <Label htmlFor="template-no" className="cursor-pointer">No, use Scan2Plan standard</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="template-other" />
                <Label htmlFor="template-other" className="cursor-pointer">Other:</Label>
              </div>
            </RadioGroup>
            {data.customTemplate === 'other' && (
              <Input
                placeholder="Specify other"
                value={data.customTemplateOther}
                onChange={(e) => onChange('customTemplateOther', e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {data.customTemplate === 'yes' && (
            <FileUpload
              label="Upload Template"
              files={data.customTemplateFiles || []}
              onChange={(files) => onChange('customTemplateFiles', files)}
            />
          )}
        </div>
      </Card>

      {/* Scope Assumptions */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Scope Assumptions</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sqft-assumptions" className="text-sm font-medium">
              Square Footage Assumptions
            </Label>
            <Textarea
              id="sqft-assumptions"
              placeholder="Document any assumptions about square footage..."
              value={data.sqftAssumptions}
              onChange={(e) => onChange('sqftAssumptions', e.target.value)}
              rows={3}
            />
            <FileUpload
              label="Upload Supporting Documents"
              files={data.sqftAssumptionsFiles || []}
              onChange={(files) => onChange('sqftAssumptionsFiles', files)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-notes" className="text-sm font-medium">
              Additional Project Notes
            </Label>
            <Textarea
              id="project-notes"
              placeholder="Any other project notes..."
              value={data.projectNotes}
              onChange={(e) => onChange('projectNotes', e.target.value)}
              rows={4}
            />
            <FileUpload
              label="Upload Scoping Documents"
              files={data.scopingDocuments || []}
              onChange={(files) => onChange('scopingDocuments', files)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mixed-scope" className="text-sm font-medium">
              Mixed Scope?
            </Label>
            <Input
              id="mixed-scope"
              placeholder="Describe any mixed scope considerations"
              value={data.mixedScope}
              onChange={(e) => onChange('mixedScope', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insurance-requirements" className="text-sm font-medium">
              Insurance Requirements
            </Label>
            <Textarea
              id="insurance-requirements"
              placeholder="Document any special insurance requirements..."
              value={data.insuranceRequirements}
              onChange={(e) => onChange('insuranceRequirements', e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* Contacts & Communication */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Contacts & Communication</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="design-pro-contact" className="text-sm font-medium">
              Design Pro Contact
            </Label>
            <Input
              id="design-pro-contact"
              placeholder="Design professional contact"
              value={data.designProContact}
              onChange={(e) => onChange('designProContact', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="design-pro-company-contact" className="text-sm font-medium">
              Design Pro Company Contact Info (if not client)
            </Label>
            <Input
              id="design-pro-company-contact"
              placeholder="Company contact information"
              value={data.designProCompanyContact}
              onChange={(e) => onChange('designProCompanyContact', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="other-contact" className="text-sm font-medium">
              Other Contact Info
            </Label>
            <Input
              id="other-contact"
              placeholder="Additional contacts"
              value={data.otherContact}
              onChange={(e) => onChange('otherContact', e.target.value)}
            />
          </div>

        </div>
      </Card>
    </div>
  );
}



