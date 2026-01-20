import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import FileUpload from "./FileUpload";

interface ScopingFieldsProps {
  data: {
    gradeAroundBuilding: string;
    gradeOther: string;
    interiorCadElevations: string;
    aboveBelowACT: string;
    aboveBelowACTOther: string;
    actSqft: string;
    bimDeliverable: string[];
    bimDeliverableOther: string;
    bimVersion: string;
    customTemplate: string;
    customTemplateOther: string;
    customTemplateFiles: any[];
    sqftAssumptions: string;
    sqftAssumptionsFiles: any[];
    assumedGrossMargin: string;
    caveatsProfitability: string;
    projectNotes: string;
    scopingDocuments: any[];
    mixedScope: string;
    insuranceRequirements: string;
    tierAScanningCost: string;
    tierAScanningCostOther: string;
    tierAModelingCost: string;
    tierAMargin: string;
    estimatedTimeline: string;
    timelineOther: string;
    timelineNotes: string;
    paymentTerms: string;
    paymentTermsOther: string;
    paymentNotes: string;
    accountContact: string;
    phoneNumber: string;
    designProContact: string;
    designProCompanyContact: string;
    otherContact: string;
    proofLinks: string;
    ndaFiles: any[];
    source: string;
    sourceNote: string;
    assist: string;
    probabilityOfClosing: string;
    projectStatus: string;
    projectStatusOther: string;
  };
  onChange: (field: string, value: any) => void;
}

export default function ScopingFields({ data, onChange }: ScopingFieldsProps) {
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
            <Label htmlFor="interior-cad-elevations" className="text-sm font-medium">
              Interior CAD Elevations? How Many?
            </Label>
            <Input
              id="interior-cad-elevations"
              type="number"
              placeholder="0"
              value={data.interiorCadElevations}
              onChange={(e) => onChange('interiorCadElevations', e.target.value)}
              className="font-mono"
            />
          </div>

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

      {/* Internal Notes & Assumptions */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Internal Notes & Assumptions</h3>
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

          <div className="space-y-2">
            <Label htmlFor="project-notes" className="text-sm font-medium">
              Additional Project Notes
            </Label>
            <Textarea
              id="project-notes"
              placeholder="Any other internal notes..."
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

      {/* Project Timeline */}
      <Card className="p-4">
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



      {/* Contacts & Communication */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Contacts & Communication</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-contact" className="text-sm font-medium">
              Account Contact
            </Label>
            <Input
              id="account-contact"
              placeholder="Primary account contact"
              value={data.accountContact}
              onChange={(e) => onChange('accountContact', e.target.value)}
              data-testid="input-account-contact"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-number" className="text-sm font-medium">
              Phone Number
            </Label>
            <Input
              id="phone-number"
              type="tel"
              placeholder="Contact phone number"
              value={data.phoneNumber}
              onChange={(e) => onChange('phoneNumber', e.target.value)}
              data-testid="input-phone-number"
            />
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
              data-testid="input-design-pro-contact"
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

      {/* Lead Tracking */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Lead Tracking</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source" className="text-sm font-medium">
              Source
            </Label>
            <Select value={data.source} onValueChange={(val) => onChange('source', val)}>
              <SelectTrigger id="source">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ABM">ABM</SelectItem>
                <SelectItem value="Cold outreach">Cold outreach</SelectItem>
                <SelectItem value="Referral - Client">Referral - Client</SelectItem>
                <SelectItem value="Referral - Partner">Referral - Partner</SelectItem>
                <SelectItem value="Existing customer">Existing customer</SelectItem>
                <SelectItem value="CEU">CEU</SelectItem>
                <SelectItem value="Proof Vault">Proof Vault</SelectItem>
                <SelectItem value="Spec/Standards">Spec/Standards</SelectItem>
                <SelectItem value="Podcast">Podcast</SelectItem>
                <SelectItem value="Site/SEO">Site/SEO</SelectItem>
                <SelectItem value="Permit trigger">Permit trigger</SelectItem>
                <SelectItem value="Compliance trigger">Compliance trigger</SelectItem>
                <SelectItem value="Procurement trigger">Procurement trigger</SelectItem>
                <SelectItem value="Event/Conference">Event/Conference</SelectItem>
                <SelectItem value="Social">Social</SelectItem>
                <SelectItem value="Vendor Onboarding">Vendor Onboarding</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-note" className="text-sm font-medium">
              Source Note
            </Label>
            <Textarea
              id="source-note"
              placeholder="Additional details about the source..."
              value={data.sourceNote}
              onChange={(e) => onChange('sourceNote', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assist" className="text-sm font-medium">
              Assist
            </Label>
            <Select value={data.assist} onValueChange={(val) => onChange('assist', val)}>
              <SelectTrigger id="assist">
                <SelectValue placeholder="Select assist" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ABM">ABM</SelectItem>
                <SelectItem value="Cold outreach">Cold outreach</SelectItem>
                <SelectItem value="Referral - Client">Referral - Client</SelectItem>
                <SelectItem value="Referral - Partner">Referral - Partner</SelectItem>
                <SelectItem value="Existing customer">Existing customer</SelectItem>
                <SelectItem value="CEU">CEU</SelectItem>
                <SelectItem value="Proof Vault">Proof Vault</SelectItem>
                <SelectItem value="Spec/Standards">Spec/Standards</SelectItem>
                <SelectItem value="Podcast">Podcast</SelectItem>
                <SelectItem value="Site/SEO">Site/SEO</SelectItem>
                <SelectItem value="Permit trigger">Permit trigger</SelectItem>
                <SelectItem value="Compliance trigger">Compliance trigger</SelectItem>
                <SelectItem value="Procurement trigger">Procurement trigger</SelectItem>
                <SelectItem value="Event/Conference">Event/Conference</SelectItem>
                <SelectItem value="Social">Social</SelectItem>
                <SelectItem value="Vendor Onboarding">Vendor Onboarding</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="probability-closing" className="text-sm font-medium">
              Probability of Closing: {data.probabilityOfClosing || 50}%
            </Label>
            <Slider
              id="probability-closing"
              min={0}
              max={100}
              step={5}
              value={[parseInt(data.probabilityOfClosing) || 50]}
              onValueChange={(vals) => onChange('probabilityOfClosing', vals[0].toString())}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Project Status
            </Label>
            <RadioGroup value={data.projectStatus} onValueChange={(val) => onChange('projectStatus', val)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="proposal" id="status-proposal" />
                <Label htmlFor="status-proposal" className="cursor-pointer">Proposal Phase</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inhand" id="status-inhand" />
                <Label htmlFor="status-inhand" className="cursor-pointer">In Hand</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="urgent" id="status-urgent" />
                <Label htmlFor="status-urgent" className="cursor-pointer">Urgent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="status-other" />
                <Label htmlFor="status-other" className="cursor-pointer">Other:</Label>
              </div>
            </RadioGroup>
            {data.projectStatus === 'other' && (
              <Input
                placeholder="Specify status"
                value={data.projectStatusOther}
                onChange={(e) => onChange('projectStatusOther', e.target.value)}
                className="mt-2"
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}



