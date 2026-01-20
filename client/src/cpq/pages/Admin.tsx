import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PricingMatrixEditor from "@/cpq/components/PricingMatrixEditor";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const BUILDING_TYPES = [
  { id: 1, name: "Commercial / Office" },
  { id: 2, name: "Industrial / Warehouse" },
  { id: 3, name: "Retail" },
  { id: 4, name: "Healthcare" },
  { id: 5, name: "Educational" },
  { id: 6, name: "Residential (Single Family)" },
  { id: 7, name: "Residential (Multi-Family)" },
  { id: 8, name: "Hospitality" },
  { id: 9, name: "Religious / Community" },
  { id: 10, name: "Sports / Recreation" },
  { id: 11, name: "Transportation / Infrastructure" },
  { id: 12, name: "Mixed-Use" },
  { id: 13, name: "Historic / Preservation" },
];

// Map of category names for display
const CATEGORY_TITLES: Record<string, string> = {
  risk: "Risk Factors",
  travel: "Travel Costs",
  discount: "Scope Discounts",
  service: "Additional Services",
  payment: "Payment Terms",
  general: "General Parameters",
};

// Map of parameter keys to human-readable labels
const PARAMETER_LABELS: Record<string, string> = {
  risk_occupied: "Occupied Building Premium (%)",
  risk_hazardous: "Hazardous Conditions Premium (%)",
  risk_no_power: "No Power/HVAC Premium (%)",
  risk_occupied_tier_a: "Occupied Building - Tier A (%)",
  risk_hazardous_tier_a: "Hazardous Conditions - Tier A (%)",
  risk_no_power_tier_a: "No Power/HVAC - Tier A (%)",
  travel_cost_troy: "Travel Cost - Troy ($/mile)",
  travel_cost_brooklyn: "Travel Cost - Brooklyn ($/mile)",
  travel_scan_day_fee: "Scan Day Fee (>75mi, ≥2 days)",
  travel_distance_threshold: "Distance Threshold (miles)",
  travel_min_days: "Min Days for Scan Day Fee",
  discount_interior_only: "Interior Only Discount (%)",
  discount_exterior_only: "Exterior Only Discount (%)",
  discount_mixed_interior: "Mixed - Interior Portion (%)",
  discount_mixed_exterior: "Mixed - Exterior Portion (%)",
  discount_roof_facades: "Roof/Facades Only (%)",
  service_matterport: "Matterport ($/sqft)",
  service_georeferencing: "Georeferencing (per building/site)",
  service_scanning_full_day: "Scanning - Full Day",
  service_scanning_half_day: "Scanning - Half Day",
  service_expedited: "Expedited Service Fee (%)",
  payment_net30_interest: "Net 30 Interest (%)",
  payment_net60_interest: "Net 60 Interest (%)",
  payment_net90_interest: "Net 90 Interest (%)",
  minimum_sqft_service: "Minimum Sqft (Tier B & C)",
  cad_conversion_minimum: "CAD Conversion Minimum",
  tier_a_overhead_markup: "Tier A Overhead Markup (%)",
  tier_a_gm_markup_min: "Tier A GM Markup Min (%)",
  tier_a_gm_markup_max: "Tier A GM Markup Max (%)",
  tier_a_threshold: "Tier A Threshold (sqft)",
  landscape_acres_threshold: "Landscape Tier A Threshold (acres)",
  landscape_tier_a_overhead: "Landscape Tier A Overhead (%)",
  landscape_tier_a_gm: "Landscape Tier A GM (%)",
};

interface PricingParameter {
  id: number;
  parameterKey: string;
  parameterValue: string;
  parameterType: string;
  description: string | null;
  category: string | null;
  updatedAt: string | null;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState("parameters");
  const [matrixTab, setMatrixTab] = useState("client");
  const [selectedBuildingType, setSelectedBuildingType] = useState<number>(1);
  const [params, setParams] = useState<Record<number, string>>({});
  const { toast } = useToast();

  // Fetch pricing parameters
  const { data: pricingParameters, isLoading: isLoadingParameters } = useQuery<PricingParameter[]>({
    queryKey: ["/api/pricing-parameters"],
  });

  // Fetch client pricing matrix
  const { data: clientPricingRates, isLoading: isLoadingClientRates } = useQuery<any[]>({
    queryKey: ["/api/pricing-matrix"],
  });

  // Fetch upteam pricing matrix
  const { data: upteamPricingRates, isLoading: isLoadingUpteamRates } = useQuery<any[]>({
    queryKey: ["/api/upteam-pricing-matrix"],
  });

  // Update pricing rate mutation (client pricing)
  const updateClientRateMutation = useMutation({
    mutationFn: async ({ id, ratePerSqFt }: { id: number; ratePerSqFt: string }) => {
      return await apiRequest("PATCH", `/api/pricing-matrix/${id}`, { ratePerSqFt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-matrix"] });
      toast({
        title: "Rate updated",
        description: "Client pricing rate has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client pricing rate",
        variant: "destructive",
      });
    },
  });

  // Update pricing rate mutation (upteam pricing)
  const updateUpteamRateMutation = useMutation({
    mutationFn: async ({ id, ratePerSqFt }: { id: number; ratePerSqFt: string }) => {
      return await apiRequest("PATCH", `/api/upteam-pricing-matrix/${id}`, { ratePerSqFt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upteam-pricing-matrix"] });
      toast({
        title: "Rate updated",
        description: "Upteam pricing rate has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update upteam pricing rate",
        variant: "destructive",
      });
    },
  });

  // Update pricing parameter mutation
  const updateParameterMutation = useMutation({
    mutationFn: async ({ id, parameterValue }: { id: number; parameterValue: string }) => {
      const res = await apiRequest("PATCH", `/api/pricing-parameters/${id}`, { parameterValue });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-parameters"] });
      // Toast is handled in handleSaveParameters for better aggregate feedback
    },
    onError: (error: any) => {
      // Error is handled in handleSaveParameters for better aggregate feedback
      throw error;
    },
  });

  const handleParamChange = (id: number, value: string) => {
    setParams((prev) => ({ ...prev, [id]: value }));
  };

  const handleSaveParameters = async () => {
    if (Object.keys(params).length === 0) return;

    // Save all changed parameters with proper error handling
    const updates = Object.entries(params).map(([id, value]) =>
      updateParameterMutation.mutateAsync({ id: parseInt(id), parameterValue: value })
        .catch((error) => ({ error, id }))
    );

    const results = await Promise.allSettled(updates);

    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error));

    if (failures.length === 0) {
      toast({
        title: "Parameters saved",
        description: `Successfully updated ${results.length} parameters`,
      });
      setParams({});
    } else if (failures.length < results.length) {
      toast({
        title: "Partial save",
        description: `${results.length - failures.length} of ${results.length} parameters updated. ${failures.length} failed.`,
        variant: "destructive",
      });
      // Keep failed params in state for retry
      const failedIds = failures.map(f => {
        if (f.status === 'fulfilled' && f.value?.id) return f.value.id;
        return null;
      }).filter(Boolean);
      setParams(prev => {
        const newParams: Record<number, string> = {};
        failedIds.forEach(id => {
          if (id && prev[id]) newParams[id] = prev[id];
        });
        return newParams;
      });
    } else {
      toast({
        title: "Save failed",
        description: "Failed to update any parameters. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClientRateChange = (rateId: number, newRate: number) => {
    updateClientRateMutation.mutate({
      id: rateId,
      ratePerSqFt: newRate.toString(),
    });
  };

  const handleUpteamRateChange = (rateId: number, newRate: number) => {
    updateUpteamRateMutation.mutate({
      id: rateId,
      ratePerSqFt: newRate.toString(),
    });
  };

  // Group parameters by category
  const groupedParameters = (pricingParameters || []).reduce((groups, param) => {
    const category = param.category || 'general';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(param);
    return groups;
  }, {} as Record<string, PricingParameter[]>);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
          <p className="text-muted-foreground">
            Configure pricing parameters and matrix rates
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="parameters" data-testid="tab-parameters">
              Pricing Parameters
            </TabsTrigger>
            <TabsTrigger value="matrix" data-testid="tab-matrix">
              Pricing Matrix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="mt-6 space-y-6">
            {isLoadingParameters ? (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : (
              <>
                {Object.entries(groupedParameters).map(([category, parameters]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle>{CATEGORY_TITLES[category] || category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {parameters.map((param) => (
                          <div key={param.id} className="space-y-2">
                            <Label htmlFor={`param-${param.id}`} className="text-sm font-medium">
                              {PARAMETER_LABELS[param.parameterKey] || param.description || param.parameterKey}
                            </Label>
                            <Input
                              id={`param-${param.id}`}
                              type="number"
                              step="0.01"
                              value={params[param.id] ?? param.parameterValue}
                              onChange={(e) =>
                                handleParamChange(param.id, e.target.value)
                              }
                              className="font-mono"
                              data-testid={`input-param-${param.parameterKey}`}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-end">
                  <Button
                    size="lg"
                    onClick={handleSaveParameters}
                    disabled={Object.keys(params).length === 0 || updateParameterMutation.isPending}
                    data-testid="button-save-parameters"
                  >
                    {updateParameterMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Parameters
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="matrix" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Building Type</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedBuildingType.toString()}
                  onValueChange={(value) => setSelectedBuildingType(parseInt(value))}
                >
                  <SelectTrigger className="w-full max-w-md" data-testid="select-building-type">
                    <SelectValue placeholder="Select building type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Tabs value={matrixTab} onValueChange={setMatrixTab}>
              <TabsList>
                <TabsTrigger value="client" data-testid="tab-client-pricing">
                  Client Pricing Matrix
                </TabsTrigger>
                <TabsTrigger value="upteam" data-testid="tab-upteam-pricing">
                  Upteam Pricing Matrix
                </TabsTrigger>
              </TabsList>

              <TabsContent value="client" className="mt-6">
                {isLoadingClientRates ? (
                  <Card>
                    <CardContent className="flex items-center justify-center p-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </CardContent>
                  </Card>
                ) : (
                  <PricingMatrixEditor
                    buildingType={BUILDING_TYPES.find(b => b.id === selectedBuildingType)?.name || ""}
                    buildingTypeId={selectedBuildingType}
                    rates={clientPricingRates || []}
                    onRateChange={handleClientRateChange}
                    isUpteam={false}
                  />
                )}
              </TabsContent>

              <TabsContent value="upteam" className="mt-6">
                {isLoadingUpteamRates ? (
                  <Card>
                    <CardContent className="flex items-center justify-center p-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </CardContent>
                  </Card>
                ) : (
                  <PricingMatrixEditor
                    buildingType={BUILDING_TYPES.find(b => b.id === selectedBuildingType)?.name || ""}
                    buildingTypeId={selectedBuildingType}
                    rates={upteamPricingRates || []}
                    onRateChange={handleUpteamRateChange}
                    isUpteam={true}
                  />
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



