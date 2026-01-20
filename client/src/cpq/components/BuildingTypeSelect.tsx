import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

interface BuildingTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export default function BuildingTypeSelect({ value, onChange }: BuildingTypeSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="building-type" className="text-sm font-medium">
        Building Type
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="building-type" data-testid="select-building-type">
          <SelectValue placeholder="Select building type" />
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
  );
}



