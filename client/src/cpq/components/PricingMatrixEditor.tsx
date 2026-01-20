import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const AREA_TIERS = [
  "0-5k",
  "5k-10k",
  "10k-20k",
  "20k-30k",
  "30k-40k",
  "40k-50k",
  "50k-75k",
  "75k-100k",
  "100k+",
];

const DISCIPLINES = ["architecture", "structure", "mepf", "site"];
const LOD_LEVELS = ["200", "300", "350", "350+"];

interface PricingRate {
  id: number;
  buildingTypeId: number;
  areaTier: string;
  discipline: string;
  lod: string;
  ratePerSqFt: string;
}

interface PricingMatrixEditorProps {
  buildingType: string;
  buildingTypeId: number;
  rates: PricingRate[];
  onRateChange: (rateId: number, value: number) => void;
  isUpteam?: boolean;
}

export default function PricingMatrixEditor({
  buildingType,
  buildingTypeId,
  rates,
  onRateChange,
  isUpteam = false,
}: PricingMatrixEditorProps) {
  const [editingCell, setEditingCell] = useState<number | null>(null);

  // Filter rates for this building type
  const filteredRates = rates.filter(r => r.buildingTypeId === buildingTypeId);

  // Create a map for quick lookup
  const rateMap = new Map<string, PricingRate>();
  filteredRates.forEach(rate => {
    const key = `${rate.areaTier}-${rate.discipline}-${rate.lod}`;
    rateMap.set(key, rate);
  });

  const getRateKey = (tier: string, discipline: string, lod: string) =>
    `${tier}-${discipline}-${lod}`;
  
  const getRate = (tier: string, discipline: string, lod: string): PricingRate | undefined => {
    const key = getRateKey(tier, discipline, lod);
    return rateMap.get(key);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {isUpteam ? "Upteam" : "Client"} Pricing Matrix
          <Badge variant="outline">{buildingType}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">Area Tier</TableHead>
                {DISCIPLINES.map((disc) =>
                  LOD_LEVELS.map((lod) => (
                    <TableHead key={`${disc}-${lod}`} className="text-center min-w-[100px]">
                      <div className="text-xs capitalize">{disc}</div>
                      <div className="text-xs text-muted-foreground">LOD {lod}</div>
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {AREA_TIERS.map((tier, tierIdx) => (
                <TableRow key={tier}>
                  <TableCell className="sticky left-0 bg-background font-medium text-sm">
                    {tier}
                  </TableCell>
                  {DISCIPLINES.map((disc) =>
                    LOD_LEVELS.map((lod) => {
                      const rateRecord = getRate(tier, disc, lod);
                      const rateValue = rateRecord ? parseFloat(rateRecord.ratePerSqFt) : 0;
                      const isEditing = editingCell === rateRecord?.id;

                      return (
                        <TableCell
                          key={`${disc}-${lod}`}
                          className="text-center p-2"
                          onClick={() => rateRecord && !isEditing && setEditingCell(rateRecord.id)}
                        >
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-20 h-8 text-center font-mono text-sm"
                              defaultValue={rateValue.toFixed(4)}
                              onBlur={(e) => {
                                if (rateRecord) {
                                  onRateChange(rateRecord.id, parseFloat(e.target.value) || 0);
                                }
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && rateRecord) {
                                  onRateChange(rateRecord.id, parseFloat(e.currentTarget.value) || 0);
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              data-testid={`input-rate-${tier}-${disc}-${lod}`}
                            />
                          ) : (
                            <span
                              className={`font-mono text-sm ${rateRecord ? 'cursor-pointer hover:text-primary hover:underline' : 'text-muted-foreground'}`}
                              data-testid={`text-rate-${tier}-${disc}-${lod}`}
                            >
                              {rateRecord ? `$${rateValue.toFixed(2)}` : 'N/A'}
                            </span>
                          )}
                        </TableCell>
                      );
                    })
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}



