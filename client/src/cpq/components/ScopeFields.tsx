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
    accountContact: string;
    accountContactEmail: string;
    accountContactPhone: string;
    designProContact: string;
    designProCompanyContact: string;
    otherContact: string;
    proofLinks: string;
    ndaFiles: any[];
    estimatedTimeline: string;
    timelineNotes: string;
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
      <Card className="p-4 bg-accent/50">
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
      <Card className="p-4 bg-accent/50">
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
      <Card className="p-4 bg-accent/50">
        <h3 className="text-lg font-semibold mb-4">Contacts & Communication</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-contact" className="text-sm font-medium">
              Account Contact
            </Label>
            <Input
              id="account-contact"
              placeholder="Primary account contact name"
              value={data.accountContact}
              onChange={(e) => onChange('accountContact', e.target.value)}
              data-testid="input-account-contact"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account-contact-email" className="text-sm font-medium">
                Account Contact Email
              </Label>
              <Input
                id="account-contact-email"
                type="email"
                placeholder="email@example.com"
                value={data.accountContactEmail}
                onChange={(e) => onChange('accountContactEmail', e.target.value)}
                data-testid="input-account-contact-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-contact-phone" className="text-sm font-medium">
                Account Contact Phone
              </Label>
              <Input
                id="account-contact-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={data.accountContactPhone}
                onChange={(e) => onChange('accountContactPhone', e.target.value)}
                data-testid="input-account-contact-phone"
              />
            </div>
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="proof-links" className="text-sm font-medium">
              Proof Links
            </Label>
            <Textarea
              id="proof-links"
              placeholder="Links to proof documents, photos, etc..."
              value={data.proofLinks}
              onChange={(e) => onChange('proofLinks', e.target.value)}
              rows={2}
            />
            <FileUpload
              label="Upload NDA"
              files={data.ndaFiles || []}
              onChange={(files) => onChange('ndaFiles', files)}
            />
          </div>
        </div>
      </Card>

      {/* Project Timeline */}
      <Card className="p-4 bg-accent/50">
        <h3 className="text-lg font-semibold mb-4">Project Timeline</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Estimated Timeline
            </Label>
            <RadioGroup value={data.estimatedTimeline} onValueChange={(val) => onChange('estimatedTimeline', val)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1week" id="timeline-1week" />
                <Label htmlFor="timeline-1week" className="cursor-pointer">~1 week</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2weeks" id="timeline-2weeks" />
                <Label htmlFor="timeline-2weeks" className="cursor-pointer">~2 weeks</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3weeks" id="timeline-3weeks" />
                <Label htmlFor="timeline-3weeks" className="cursor-pointer">~3 weeks</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="4weeks" id="timeline-4weeks" />
                <Label htmlFor="timeline-4weeks" className="cursor-pointer">~4 weeks</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="5weeks" id="timeline-5weeks" />
                <Label htmlFor="timeline-5weeks" className="cursor-pointer">~5 weeks</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="6weeks" id="timeline-6weeks" />
                <Label htmlFor="timeline-6weeks" className="cursor-pointer">~6 weeks</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeline-notes" className="text-sm font-medium">
              Timeline Notes
            </Label>
            <Textarea
              id="timeline-notes"
              placeholder="Additional notes about project timeline..."
              value={data.timelineNotes}
              onChange={(e) => onChange('timelineNotes', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}



