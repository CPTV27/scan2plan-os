import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const BUILDING_TYPES = [
  { value: "1", label: "Residential - Single Family" },
  { value: "2", label: "Residential - Multi Family" },
  { value: "3", label: "Residential - Luxury" },
  { value: "4", label: "Commercial / Office" },
  { value: "5", label: "Retail / Restaurants" },
  { value: "6", label: "Kitchen / Catering Facilities" },
  { value: "7", label: "Education" },
  { value: "8", label: "Hotel / Theatre / Museum" },
  { value: "9", label: "Hospitals / Mixed Use" },
  { value: "10", label: "Mechanical / Utility Rooms" },
  { value: "11", label: "Warehouse / Storage" },
  { value: "12", label: "Religious Buildings" },
  { value: "13", label: "Infrastructure / Roads / Bridges" },
  { value: "14", label: "Built Landscape" },
  { value: "15", label: "Natural Landscape" },
  { value: "16", label: "ACT (Above/Below Acoustic Ceiling Tiles) [rate pending]" },
];

const PROJECT_SCOPES = [
  { value: "full", label: "Full Building" },
  { value: "interior", label: "Interior Only" },
  { value: "exterior", label: "Exterior Only" },
  { value: "mixed", label: "Mixed Scope (Interior + Exterior)" },
  { value: "roof", label: "Roof/Facades Only" },
];

const DISCIPLINES = [
  { id: "architecture", label: "Architecture", description: "Building modeling" },
  { id: "structure", label: "Structure", description: "Structural elements" },
  { id: "mepf", label: "MEPF", description: "Mechanical, Electrical, Plumbing, Fire" },
  { id: "site", label: "Site/Topography", description: "Site work and grading" },
  { id: "matterport", label: "Matterport Virtual Tours", description: "Virtual tour generation at $0.10/sqft" },
];

const LOD_LEVELS = [
  { value: "200", label: "200" },
  { value: "300", label: "300" },
  { value: "350", label: "350" },
];

interface Facade {
  id: string;
  label: string;
}

interface Area {
  id: string;
  name: string;
  buildingType: string;
  squareFeet: string;
  scope: string;
  disciplines: string[];
  disciplineLods: Record<string, string>;
  mixedInteriorLod: string;
  mixedExteriorLod: string;
  numberOfRoofs: number;
  facades: Facade[];
  gradeAroundBuilding: boolean;
  gradeLod: string;
  includeCad: boolean;
  additionalElevations: number;
}

interface AreaInputProps {
  area: Area;
  index: number;
  onChange: (id: string, field: keyof Area, value: string | boolean | number | Facade[]) => void;
  onDisciplineChange: (areaId: string, disciplineId: string, checked: boolean) => void;
  onLodChange: (areaId: string, disciplineId: string, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export default function AreaInput({ area, index, onChange, onDisciplineChange, onLodChange, onRemove, canRemove }: AreaInputProps) {
  const isLandscape = area.buildingType === "14" || area.buildingType === "15";
  const isACT = area.buildingType === "16";
  const isSimplifiedUI = isLandscape || isACT;
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Area {index + 1}</h4>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(area.id)}
              data-testid={`button-remove-area-${index}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`area-building-type-${area.id}`} className="text-sm font-medium">
            Area Type
          </Label>
          <Select value={area.buildingType} onValueChange={(value) => onChange(area.id, 'buildingType', value)}>
            <SelectTrigger id={`area-building-type-${area.id}`} data-testid={`select-area-building-type-${index}`}>
              <SelectValue placeholder="Select area type" />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`area-name-${area.id}`} className="text-sm font-medium">
              Area Name
            </Label>
            <Input
              id={`area-name-${area.id}`}
              placeholder="e.g., Main Building"
              value={area.name}
              onChange={(e) => onChange(area.id, 'name', e.target.value)}
              data-testid={`input-area-name-${index}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`area-sqft-${area.id}`} className="text-sm font-medium">
              {isLandscape ? "Acres" : "Square Footage"}
            </Label>
            <Input
              id={`area-sqft-${area.id}`}
              type="number"
              placeholder="0"
              value={area.squareFeet}
              onChange={(e) => onChange(area.id, 'squareFeet', e.target.value)}
              className="font-mono"
              data-testid={`input-area-sqft-${index}`}
            />
          </div>
        </div>

        {!isSimplifiedUI && (
          <div className="space-y-2">
            <Label htmlFor={`area-scope-${area.id}`} className="text-sm font-medium">
              Project Scope
            </Label>
            <Select value={area.scope} onValueChange={(value) => onChange(area.id, 'scope', value)}>
              <SelectTrigger id={`area-scope-${area.id}`} data-testid={`select-area-scope-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_SCOPES.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Roof/Facades Configuration */}
        {area.scope === "roof" && !isSimplifiedUI && (
          <div className="space-y-4 p-3 bg-muted/50 rounded-md">
            <Label className="text-sm font-medium">Roof & Facades Configuration</Label>
            <p className="text-xs text-muted-foreground">Each roof and facade is priced at 10% of the base price per discipline</p>
            
            {/* Facades/Roof */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Facades/Roof ({(area.facades || []).length}/5)</Label>
                {(area.facades || []).length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newFacades = [...(area.facades || []), { id: Date.now().toString(), label: "" }];
                      onChange(area.id, 'facades', newFacades);
                    }}
                    data-testid={`button-add-facade-${index}`}
                  >
                    Add Facade/Roof
                  </Button>
                )}
              </div>
              
              {(area.facades || []).map((facade, facadeIndex) => (
                <div key={facade.id} className="flex items-center gap-2">
                  <Input
                    placeholder={`e.g., South Facing Facade or Main Roof`}
                    value={facade.label}
                    onChange={(e) => {
                      const newFacades = [...(area.facades || [])];
                      newFacades[facadeIndex] = { ...facade, label: e.target.value };
                      onChange(area.id, 'facades', newFacades);
                    }}
                    className="flex-1"
                    data-testid={`input-facade-label-${index}-${facadeIndex}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newFacades = (area.facades || []).filter((_, i) => i !== facadeIndex);
                      onChange(area.id, 'facades', newFacades);
                    }}
                    data-testid={`button-remove-facade-${index}-${facadeIndex}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {isSimplifiedUI ? (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Level of Detail (LoD)</h4>
            <div className="space-y-2">
              <Label htmlFor={`lod-${area.id}`} className="text-sm font-medium">
                Select LoD
              </Label>
              <Select 
                value={area.disciplineLods[isACT ? "mepf" : "site"] || "300"} 
                onValueChange={(value) => onLodChange(area.id, isACT ? "mepf" : "site", value)}
              >
                <SelectTrigger id={`lod-${area.id}`} data-testid={`select-lod-simplified-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOD_LEVELS.map((lod) => (
                    <SelectItem key={lod.value} value={lod.value}>
                      LoD {lod.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {area.scope === "mixed" ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Level of Detail (LoD)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`lod-interior-${area.id}`} className="text-xs text-muted-foreground">
                      Interior (65%)
                    </Label>
                    <Select 
                      value={area.mixedInteriorLod || "300"} 
                      onValueChange={(value) => onChange(area.id, 'mixedInteriorLod', value)}
                    >
                      <SelectTrigger id={`lod-interior-${area.id}`} data-testid={`select-lod-interior-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOD_LEVELS.map((lod) => (
                          <SelectItem key={lod.value} value={lod.value}>
                            LoD {lod.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`lod-exterior-${area.id}`} className="text-xs text-muted-foreground">
                      Exterior (35%)
                    </Label>
                    <Select 
                      value={area.mixedExteriorLod || "300"} 
                      onValueChange={(value) => onChange(area.id, 'mixedExteriorLod', value)}
                    >
                      <SelectTrigger id={`lod-exterior-${area.id}`} data-testid={`select-lod-exterior-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOD_LEVELS.map((lod) => (
                          <SelectItem key={lod.value} value={lod.value}>
                            LoD {lod.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`lod-${area.id}`} className="text-sm font-medium">
                  Level of Detail (LoD)
                </Label>
                <Select 
                  value={area.disciplineLods["architecture"] || "300"} 
                  onValueChange={(value) => {
                    DISCIPLINES.filter(d => d.id !== "matterport").forEach(d => {
                      onLodChange(area.id, d.id, value);
                    });
                  }}
                >
                  <SelectTrigger id={`lod-${area.id}`} className="w-32" data-testid={`select-lod-area-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOD_LEVELS.map((lod) => (
                      <SelectItem key={lod.value} value={lod.value}>
                        LoD {lod.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Disciplines</Label>
              <div className="grid grid-cols-2 gap-2">
                {DISCIPLINES.map((discipline) => {
                  const isSelected = area.disciplines.includes(discipline.id);
                  
                  return (
                    <div 
                      key={discipline.id}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-accent" : "border-border hover-elevate"
                      }`}
                      onClick={() => onDisciplineChange(area.id, discipline.id, !isSelected)}
                    >
                      <Checkbox
                        id={`${area.id}-${discipline.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => onDisciplineChange(area.id, discipline.id, checked as boolean)}
                        data-testid={`checkbox-area-${index}-discipline-${discipline.id}`}
                      />
                      <Label
                        htmlFor={`${area.id}-${discipline.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {discipline.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* CAD Deliverable Section */}
        {!isLandscape && !isACT && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">CAD Deliverable</h4>
              <Card className={`p-3 transition-colors ${area.includeCad ? "border-primary bg-accent" : ""}`}>
                <div className="space-y-3">
                  <div 
                    className="flex items-start gap-3 cursor-pointer hover-elevate rounded p-2 -m-2"
                    onClick={() => onChange(area.id, 'includeCad', !area.includeCad)}
                  >
                    <Checkbox
                      id={`${area.id}-cad`}
                      checked={area.includeCad}
                      onCheckedChange={(checked) => onChange(area.id, 'includeCad', checked as boolean)}
                      data-testid={`checkbox-area-${index}-cad`}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`${area.id}-cad`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        Include CAD Conversion (PDF & DWG)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {area.scope === "interior" 
                          ? "Interior Package: Floor plans, 8 interior elevations, 1 section, RCPs (if MEP in scope)"
                          : "Standard Package: Floor plans, exterior elevations, up to 2 sections, RCPs (if MEP in scope)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        $300 minimum charge applies
                      </p>
                    </div>
                  </div>

                  {area.includeCad && (
                    <div className="space-y-2 pl-8">
                      <Label htmlFor={`additional-elevations-${area.id}`} className="text-sm font-medium">
                        Additional Interior Elevations/Sections
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Beyond what's included in the package (tiered pricing: $25/ea for 1-10, $20/ea for 10-20, etc.)
                      </p>
                      <Input
                        id={`additional-elevations-${area.id}`}
                        type="number"
                        min="0"
                        placeholder="0"
                        value={area.additionalElevations || 0}
                        onChange={(e) => onChange(area.id, 'additionalElevations', e.target.value)}
                        className="font-mono w-24"
                        data-testid={`input-additional-elevations-${index}`}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}



