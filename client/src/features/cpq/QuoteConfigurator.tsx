/**
 * Quote Configurator - Multi-Area Product Configuration
 * 
 * Modern configurator-style UI for creating quotes with multiple areas.
 * Each area can have different building types, square footage, LOD, scope, and disciplines.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
    Plus,
    Trash2,
    Save,
    ArrowLeft,
    MapPin,
    Building2,
    Ruler,
    PenTool,
    ChevronDown,
    ChevronUp,
    Edit,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { calculatePricing, BUILDING_TYPES, LOD_OPTIONS, SCOPE_OPTIONS, DISCIPLINES, LANDSCAPE_TYPES, LANDSCAPE_LOD_OPTIONS, calculateLandscapePrice, LANDSCAPE_MINIMUM } from "./pricing";
import { LineItemEditor, type QuoteLineItem } from "./LineItemEditor";
import { generateEditableLineItems } from "./lineItemUtils";
import { enrichAreaWithProducts, generateQuoteSkus } from "@/lib/productResolver";
import { TreeDeciduous } from "lucide-react";
import type { Lead } from "@shared/schema";
import type { MappedConfiguratorData } from "./cpqImportUtils";

interface Area {
    id: string;
    name: string;
    buildingType: string;
    squareFeet: string;
    lod: string;
    scope: string;
    disciplines: string[];
    expanded: boolean;
}

interface QuoteConfiguratorProps {
    leadId?: number;
    quoteId?: number;
    onClose?: () => void;
    importedData?: MappedConfiguratorData | null;
    onClearImport?: () => void;
    // Shared state props for syncing with Advanced mode
    sharedAreas?: Area[];
    onAreasChange?: (areas: Area[]) => void;
    sharedLandscape?: { include: boolean; type: "built" | "natural"; acres: string; lod: string };
    onLandscapeChange?: (landscape: { include: boolean; type: "built" | "natural"; acres: string; lod: string }) => void;
    sharedLocation?: string;
    onLocationChange?: (location: string) => void;
}

export default function QuoteConfigurator({
    leadId,
    quoteId,
    onClose,
    importedData,
    onClearImport,
    sharedAreas,
    onAreasChange,
    sharedLandscape,
    onLandscapeChange,
    sharedLocation,
    onLocationChange,
}: QuoteConfiguratorProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Use shared state if provided, otherwise fall back to local state
    const [localAreas, setLocalAreas] = useState<Area[]>([
        {
            id: "1",
            name: "Main Building",
            buildingType: "4",
            squareFeet: "",
            lod: "300",
            scope: "full",
            disciplines: ["architecture"],
            expanded: true,
        },
    ]);
    const [localLocation, setLocalLocation] = useState("");
    const [localIncludeLandscape, setLocalIncludeLandscape] = useState(true);
    const [localLandscapeType, setLocalLandscapeType] = useState<"built" | "natural">("built");
    const [localLandscapeAcres, setLocalLandscapeAcres] = useState("");
    const [localLandscapeLod, setLocalLandscapeLod] = useState("300");

    // Derive actual values from shared props or local state
    const areas = sharedAreas || localAreas;
    const projectLocation = sharedLocation ?? localLocation;
    const includeLandscape = sharedLandscape?.include ?? localIncludeLandscape;
    const landscapeType = sharedLandscape?.type ?? localLandscapeType;
    const landscapeAcres = sharedLandscape?.acres ?? localLandscapeAcres;
    const landscapeLod = sharedLandscape?.lod ?? localLandscapeLod;

    // Unified setters that update shared or local state
    const setAreas = useCallback((newAreas: Area[] | ((prev: Area[]) => Area[])) => {
        const resolvedAreas = typeof newAreas === 'function' ? newAreas(areas) : newAreas;
        if (onAreasChange) {
            onAreasChange(resolvedAreas);
        } else {
            setLocalAreas(resolvedAreas);
        }
    }, [areas, onAreasChange]);

    const setProjectLocation = useCallback((location: string) => {
        if (onLocationChange) {
            onLocationChange(location);
        } else {
            setLocalLocation(location);
        }
    }, [onLocationChange]);

    const setIncludeLandscape = useCallback((include: boolean) => {
        if (onLandscapeChange) {
            onLandscapeChange({ include, type: landscapeType, acres: landscapeAcres, lod: landscapeLod });
        } else {
            setLocalIncludeLandscape(include);
        }
    }, [onLandscapeChange, landscapeType, landscapeAcres, landscapeLod]);

    const setLandscapeType = useCallback((type: "built" | "natural") => {
        if (onLandscapeChange) {
            onLandscapeChange({ include: includeLandscape, type, acres: landscapeAcres, lod: landscapeLod });
        } else {
            setLocalLandscapeType(type);
        }
    }, [onLandscapeChange, includeLandscape, landscapeAcres, landscapeLod]);

    const setLandscapeAcres = useCallback((acres: string) => {
        if (onLandscapeChange) {
            onLandscapeChange({ include: includeLandscape, type: landscapeType, acres, lod: landscapeLod });
        } else {
            setLocalLandscapeAcres(acres);
        }
    }, [onLandscapeChange, includeLandscape, landscapeType, landscapeLod]);

    const setLandscapeLod = useCallback((lod: string) => {
        if (onLandscapeChange) {
            onLandscapeChange({ include: includeLandscape, type: landscapeType, acres: landscapeAcres, lod });
        } else {
            setLocalLandscapeLod(lod);
        }
    }, [onLandscapeChange, includeLandscape, landscapeType, landscapeAcres]);

    // Project-level add-ons (not synced - Advanced mode only)
    const [services, setServices] = useState<Record<string, number>>({});
    const [risks, setRisks] = useState<string[]>([]);
    const [paymentTerms, setPaymentTerms] = useState("net_30");
    const [expedited, setExpedited] = useState(false);

    // Line Item Editor
    const [showLineItemEditor, setShowLineItemEditor] = useState(false);
    const [customLineItems, setCustomLineItems] = useState<QuoteLineItem[] | null>(null);
    const [hasCustomizedPricing, setHasCustomizedPricing] = useState(false);

    // Load lead data
    const { data: lead } = useQuery<Lead>({
        queryKey: [`/api/leads/${leadId}`],
        enabled: !!leadId,
    });

    // Populate from imported CPQ data
    useEffect(() => {
        if (importedData) {
            // Set areas
            if (importedData.areas.length > 0) {
                setAreas(importedData.areas);
            }
            // Set project location
            if (importedData.projectLocation) {
                setProjectLocation(importedData.projectLocation);
            }
            // Set landscape
            if (importedData.landscape) {
                setIncludeLandscape(importedData.landscape.include);
                setLandscapeType(importedData.landscape.type);
                setLandscapeAcres(importedData.landscape.acres);
                setLandscapeLod(importedData.landscape.lod);
            } else {
                setIncludeLandscape(false);
            }
            // Show toast
            toast({
                title: "Quote Imported",
                description: `Loaded ${importedData.areas.length} area(s) from ${importedData.projectName || "CPQ export"}`,
            });
            // Clear import data after applying
            if (onClearImport) {
                onClearImport();
            }
        }
    }, [importedData, onClearImport, toast]);

    // Calculate pricing
    const pricing = useMemo(() => {
        if (areas.length === 0 || areas.every(a => !a.squareFeet)) {
            return null;
        }

        return calculatePricing(
            areas.map(a => ({
                id: a.id,
                name: a.name,
                buildingType: a.buildingType,
                squareFeet: a.squareFeet,
                lod: a.lod,
                scope: a.scope,
                disciplines: a.disciplines,
            })),
            services,
            null, // travel calculated separately
            risks,
            paymentTerms
        );
    }, [areas, services, risks, paymentTerms]);

    // Calculate landscape pricing
    const landscapePrice = useMemo(() => {
        if (!includeLandscape || !landscapeAcres) return 0;
        const acres = parseFloat(landscapeAcres);
        if (isNaN(acres) || acres <= 0) return 0;
        return calculateLandscapePrice(landscapeType, acres, landscapeLod as "200" | "300" | "350");
    }, [includeLandscape, landscapeType, landscapeAcres, landscapeLod]);

    // Total price including landscape
    const totalPrice = useMemo(() => {
        const basePrice = pricing?.totalClientPrice || 0;
        return basePrice + landscapePrice;
    }, [pricing, landscapePrice]);

    // Add new area
    const addArea = () => {
        const newArea: Area = {
            id: String(Date.now()),
            name: `Area ${areas.length + 1}`,
            buildingType: "4",
            squareFeet: "",
            lod: "300",
            scope: "full",
            disciplines: ["architecture"],
            expanded: true,
        };
        setAreas([...areas, newArea]);
    };

    // Remove area
    const removeArea = (id: string) => {
        if (areas.length > 1) {
            setAreas(areas.filter(a => a.id !== id));
        }
    };

    // Update area
    const updateArea = (id: string, field: keyof Area, value: any) => {
        setAreas(areas.map(a =>
            a.id === id ? { ...a, [field]: value } : a
        ));
    };

    // Toggle area expansion
    const toggleArea = (id: string) => {
        setAreas(areas.map(a =>
            a.id === id ? { ...a, expanded: !a.expanded } : a
        ));
    };

    // Toggle discipline
    const toggleDiscipline = (areaId: string, discipline: string) => {
        setAreas(areas.map(a => {
            if (a.id !== areaId) return a;

            const disciplines = a.disciplines.includes(discipline)
                ? a.disciplines.filter(d => d !== discipline)
                : [...a.disciplines, discipline];

            return { ...a, disciplines };
        }));
    };

    // Save quote mutation
    const saveQuoteMutation = useMutation({
        mutationFn: async () => {
            if (!pricing) throw new Error("No pricing calculated");

            // Validate areas have square footage
            const validAreas = areas.filter(a => parseInt(a.squareFeet) > 0);
            if (validAreas.length === 0) {
                throw new Error("At least one area must have square footage greater than 0");
            }

            // Enrich areas with product SKUs
            const areasWithProducts = await Promise.all(
                areas.map(area => enrichAreaWithProducts({
                    buildingType: area.buildingType,
                    disciplines: area.disciplines,
                    lod: area.lod,
                    scope: area.scope,
                    squareFeet: area.squareFeet,
                    name: area.name,
                }))
            );

            // Generate SKU manifest
            const lineItemSkus = await generateQuoteSkus({
                areas: areasWithProducts as any, // Type assertion - enriched areas include all required fields
                services,
                risks,
                paymentTerms,
            });

            const quoteData = {
                leadId: leadId || null,
                areas: areasWithProducts,
                services,
                risks,
                paymentTerms,
                totalClientPrice: pricing.totalClientPrice.toString(),
                totalUpteamCost: pricing.totalUpteamCost.toString(),
                status: "draft" as const,
                pricingBreakdown: pricing,
                lineItemSkus,
                customLineItems: hasCustomizedPricing ? customLineItems : null,
                isCustomized: hasCustomizedPricing,
            };

            if (quoteId) {
                return apiRequest("PATCH", `/api/cpq/quotes/${quoteId}`, quoteData);
            } else {
                return apiRequest("POST", "/api/cpq/quotes", quoteData);
            }
        },
        onSuccess: () => {
            toast({
                title: "Quote saved",
                description: "Your quote has been saved successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/cpq/quotes"] });
            if (onClose) onClose();
        },
        onError: (error: Error) => {
            toast({
                title: "Error saving quote",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 p-4 border-b bg-background sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-lg font-semibold">Configure Your Project</h1>
                        {lead && <p className="text-sm text-muted-foreground">{lead.clientName}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                        ${totalPrice.toLocaleString() || "0"}
                    </div>
                    <div className="text-xs text-muted-foreground">Estimated Total</div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Project Location */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Project location (e.g., Brooklyn, NY)"
                                value={projectLocation}
                                onChange={(e) => setProjectLocation(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Areas */}
                {areas.map((area, index) => (
                    <Card key={area.id} className="relative">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                    <Input
                                        value={area.name}
                                        onChange={(e) => updateArea(area.id, "name", e.target.value)}
                                        className="font-semibold max-w-xs"
                                    />
                                    <Badge variant="outline" className="ml-2">
                                        Area {index + 1}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    {pricing && (
                                        <div className="text-sm font-semibold text-green-600">
                                            ${(pricing.items
                                                .filter(item => item.label.includes(area.name))
                                                .reduce((sum, item) => sum + item.value, 0))
                                                .toLocaleString()}
                                        </div>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => toggleArea(area.id)}
                                    >
                                        {area.expanded ? (
                                            <ChevronUp className="h-4 w-4" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4" />
                                        )}
                                    </Button>
                                    {areas.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeArea(area.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>

                        {area.expanded && (
                            <CardContent className="space-y-4">
                                {/* Building Type & Square Feet */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Building Type</Label>
                                        <Select
                                            value={area.buildingType}
                                            onValueChange={(value) => updateArea(area.id, "buildingType", value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {BUILDING_TYPES.map((type) => (
                                                    <SelectItem key={type.id} value={type.id}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Square Footage</Label>
                                        <Input
                                            type="number"
                                            placeholder="Enter size"
                                            value={area.squareFeet}
                                            onChange={(e) => updateArea(area.id, "squareFeet", e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* LOD & Scope */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Level of Detail (LOD)</Label>
                                        <Select
                                            value={area.lod}
                                            onValueChange={(value) => updateArea(area.id, "lod", value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LOD_OPTIONS.map((lod) => (
                                                    <SelectItem key={lod.id} value={lod.id}>
                                                        {lod.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Scope</Label>
                                        <Select
                                            value={area.scope}
                                            onValueChange={(value) => updateArea(area.id, "scope", value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SCOPE_OPTIONS.map((scope) => (
                                                    <SelectItem key={scope.id} value={scope.id}>
                                                        {scope.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Disciplines */}
                                <div>
                                    <Label>Disciplines</Label>
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        {DISCIPLINES.map((discipline) => (
                                            <div key={discipline.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`${area.id}-${discipline.id}`}
                                                    checked={area.disciplines.includes(discipline.id)}
                                                    onCheckedChange={() => toggleDiscipline(area.id, discipline.id)}
                                                />
                                                <label
                                                    htmlFor={`${area.id}-${discipline.id}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {discipline.label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                ))}

                {/* Add Area Button */}
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={addArea}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Area
                </Button>

                {/* Landscape Section */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TreeDeciduous className="h-4 w-4" />
                                Landscape
                            </CardTitle>
                            <div className="flex items-center gap-3">
                                {includeLandscape && landscapePrice > 0 && (
                                    <span className="text-sm font-semibold text-green-600">
                                        ${landscapePrice.toLocaleString()}
                                    </span>
                                )}
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="include-landscape"
                                        checked={includeLandscape}
                                        onCheckedChange={(checked) => setIncludeLandscape(!!checked)}
                                    />
                                    <Label htmlFor="include-landscape" className="text-sm">Include</Label>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    {includeLandscape && (
                        <CardContent className="space-y-4">
                            {/* Landscape Type */}
                            <div>
                                <Label className="mb-3 block">Landscape Type</Label>
                                <RadioGroup
                                    value={landscapeType}
                                    onValueChange={(value) => setLandscapeType(value as "built" | "natural")}
                                    className="flex gap-6"
                                >
                                    {LANDSCAPE_TYPES.map((type) => (
                                        <div key={type.id} className="flex items-center gap-2">
                                            <RadioGroupItem value={type.id} id={`landscape-${type.id}`} />
                                            <Label htmlFor={`landscape-${type.id}`} className="cursor-pointer">
                                                <span className="font-medium">{type.label}</span>
                                                <p className="text-xs text-muted-foreground">{type.description}</p>
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>

                            {/* Acreage */}
                            <div>
                                <Label htmlFor="landscape-acres">Acreage</Label>
                                <Input
                                    id="landscape-acres"
                                    type="number"
                                    placeholder="Enter acres (e.g., 5)"
                                    value={landscapeAcres}
                                    onChange={(e) => setLandscapeAcres(e.target.value)}
                                    className="mt-1"
                                />
                                {landscapeAcres && parseFloat(landscapeAcres) > 0 && landscapePrice === LANDSCAPE_MINIMUM && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Minimum charge of ${LANDSCAPE_MINIMUM} applied
                                    </p>
                                )}
                            </div>

                            {/* LOD Selection */}
                            <div>
                                <Label className="mb-3 block">Level of Detail</Label>
                                <RadioGroup
                                    value={landscapeLod}
                                    onValueChange={setLandscapeLod}
                                    className="space-y-2"
                                >
                                    {LANDSCAPE_LOD_OPTIONS.map((lod) => (
                                        <div key={lod.id} className="flex items-start gap-2">
                                            <RadioGroupItem value={lod.id} id={`landscape-lod-${lod.id}`} className="mt-0.5" />
                                            <Label htmlFor={`landscape-lod-${lod.id}`} className="cursor-pointer">
                                                <span className="font-medium">{lod.label}</span>
                                                <p className="text-xs text-muted-foreground">{lod.description}</p>
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Payment Terms */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Payment Terms</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="net_15">Net 15</SelectItem>
                                <SelectItem value="net_30">Net 30</SelectItem>
                                <SelectItem value="net_45">Net 45</SelectItem>
                                <SelectItem value="50_50">50/50 Split</SelectItem>
                                <SelectItem value="25_75">25/75 Split</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="border-t p-4 bg-background">
                <div className="flex gap-3 justify-end">
                    {hasCustomizedPricing && (
                        <Badge variant="secondary">✏️ Customized</Badge>
                    )}
                    <Button
                        variant="outline"
                        onClick={async () => {
                            if (!pricing) return;
                            const lineItemSkus = await generateQuoteSkus({ areas, services, risks, paymentTerms });
                            const editableItems = generateEditableLineItems(pricing, lineItemSkus);
                            setCustomLineItems(editableItems);
                            setShowLineItemEditor(true);
                        }}
                        disabled={!pricing}
                    >
                        <PenTool className="h-4 w-4 mr-2" />
                        Customize Pricing
                    </Button>
                    <Button
                        onClick={() => saveQuoteMutation.mutate()}
                        disabled={saveQuoteMutation.isPending || !pricing}
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saveQuoteMutation.isPending ? "Saving..." : "Save Quote"}
                    </Button>
                </div>
            </div>

            {/* Line Item Editor */}
            {showLineItemEditor && customLineItems && pricing && (
                <LineItemEditor
                    initialLineItems={customLineItems}
                    calculatedPricing={pricing}
                    onSave={(items, total) => {
                        setCustomLineItems(items);
                        setHasCustomizedPricing(true);
                        setShowLineItemEditor(false);
                        toast({
                            title: "Line items customized",
                            description: `Custom total: $${total.toLocaleString()}`,
                        });
                    }}
                    onCancel={() => setShowLineItemEditor(false)}
                />
            )}
        </div>
    );
}
