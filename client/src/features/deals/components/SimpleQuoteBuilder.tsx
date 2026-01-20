/**
 * SimpleQuoteBuilder - CPQ Quote Configuration Editor
 * 
 * Full CPQ configuration support including:
 * - Areas with disciplines, LOD, and scope
 * - Travel configuration (standard/Brooklyn dispatch)
 * - Risk premiums (occupied, hazardous, no_power)
 * - Services (Matterport, elevations)
 * - Payment terms
 * - JSON import from external CPQ
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertTriangle,
    Building2,
    Calculator,
    Car,
    ChevronDown,
    ChevronUp,
    DollarSign,
    ExternalLink,
    FileJson,
    Loader2,
    MapPin,
    MessageCircle,
    Plus,
    Save,
    Send,
    Sparkles,
    Trash2,
    TreePine,
    Upload,
    X,
    Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Lead, CpqQuote } from "@shared/schema";
import { CPQ_BUILDING_TYPES, CPQ_PAYMENT_TERMS, CPQ_PAYMENT_TERMS_DISPLAY } from "@shared/schema";

// ===== TYPE DEFINITIONS =====

// Discipline configuration
interface DisciplineConfig {
    enabled: boolean;
    lod: "200" | "300" | "350";
    scope?: "full" | "interior" | "exterior" | "mixed";
    // For mixed scope - different LODs for interior/exterior
    mixedInteriorLod?: "200" | "300" | "350";
    mixedExteriorLod?: "200" | "300" | "350";
    clientPrice?: number;
    upteamCost?: number;
}

// Full area configuration matching CPQ spec
export interface CPQArea {
    id: string;
    name: string;
    buildingType: string;
    squareFeet: number;
    acres?: number; // For landscape types (14, 15)
    expanded?: boolean;

    // Discipline configurations
    disciplines: {
        arch?: DisciplineConfig;
        mepf?: DisciplineConfig;
        structure?: DisciplineConfig;
        site?: DisciplineConfig;
    };

    // Calculated totals
    clientPrice: number;
    upteamCost: number;
}

// Travel configuration
interface TravelConfig {
    dispatchLocation: "troy" | "woodstock" | "boise" | "brooklyn" | "fly_out";
    distance: number;
    brooklynTier?: "tierA" | "tierB" | "tierC";
    travelCost: number;
    scanDayFee: number;
}

// Risk configuration
interface RiskConfig {
    occupied: boolean;
    hazardous: boolean;
    no_power: boolean;
}

// Services configuration
interface ServicesConfig {
    matterport: boolean;
    matterportSqft?: number;
    additionalElevations: number;
}

// Complete CPQ import data
export interface CPQImportData {
    areas?: CPQArea[];
    travel?: Partial<TravelConfig>;
    risks?: string[];
    services?: Partial<ServicesConfig>;
    paymentTerms?: string;
    subtotal?: number;
    riskPremium?: number;
    travelCost?: number;
    servicesCost?: number;
    paymentPremium?: number;
    totalPrice?: number;
    totalCost?: number;
    source?: string;
}

interface SimpleQuoteBuilderProps {
    lead: Lead;
    leadId: number;
    onQuoteSaved?: () => void;
    existingQuotes?: CpqQuote[];
}

// ===== CONSTANTS (from CPQ spec) =====

const MIN_SQFT_FLOOR = 3000;
const UPTEAM_MULTIPLIER_FALLBACK = 0.65;

// Default base rates
const BASE_RATES: Record<string, number> = {
    arch: 2.50,
    mepf: 3.00,
    structure: 2.00,
    site: 1.50,
};

// LOD multipliers
const LOD_MULTIPLIERS: Record<string, number> = {
    "200": 1.0,
    "300": 1.3,
    "350": 1.5,
};

// Scope portions
const SCOPE_PORTIONS: Record<string, number> = {
    full: 1.0,
    interior: 0.65,
    exterior: 0.35,
};

// Risk premiums (Architecture only)
const RISK_PREMIUMS: Record<string, number> = {
    occupied: 0.15,
    hazardous: 0.25,
    no_power: 0.20,
};

// Travel rates
const TRAVEL_RATES = {
    standard: 3,
    brooklyn: 4,
    brooklynThreshold: 20,
    scanDayFeeThreshold: 75,
    scanDayFee: 300,
};

const BROOKLYN_BASE_FEES: Record<string, number> = {
    tierC: 150,
    tierB: 300,
    tierA: 0,
};

// Payment term premiums
const PAYMENT_PREMIUMS: Record<string, number> = {
    partner: 0,
    owner: 0,
    "50/50": 0,
    net15: 0,
    net30: 0.05,
    net45: 0.07,
    net60: 0.10,
    net90: 0.15,
    standard: 0,
};

// Fixed rates
const ACT_RATE_PER_SQFT = 2.00;
const MATTERPORT_RATE_PER_SQFT = 0.10;
const TIER_A_THRESHOLD = 50000;
const SQFT_PER_ACRE = 43560;

// Landscape per-acre rates (from CPQ spec)
// Built Landscape (Type 14)
const BUILT_LANDSCAPE_RATES: Record<string, Record<string, number>> = {
    "0": { "200": 875, "300": 1000, "350": 1250 },   // < 5 acres
    "1": { "200": 625, "300": 750, "350": 1000 },    // 5-20 acres
    "2": { "200": 375, "300": 500, "350": 750 },     // 20-50 acres
    "3": { "200": 250, "300": 375, "350": 500 },     // 50-100 acres
    "4": { "200": 160, "300": 220, "350": 260 },     // 100+ acres
};

// Natural Landscape (Type 15)
const NATURAL_LANDSCAPE_RATES: Record<string, Record<string, number>> = {
    "0": { "200": 625, "300": 750, "350": 1000 },    // < 5 acres
    "1": { "200": 375, "300": 500, "350": 750 },     // 5-20 acres
    "2": { "200": 250, "300": 375, "350": 500 },     // 20-50 acres
    "3": { "200": 200, "300": 275, "350": 325 },     // 50-100 acres
    "4": { "200": 140, "300": 200, "350": 240 },     // 100+ acres
};

// Get landscape acreage tier
function getLandscapeAcreageTierIndex(acres: number): string {
    if (acres >= 100) return "4";
    if (acres >= 50) return "3";
    if (acres >= 20) return "2";
    if (acres >= 5) return "1";
    return "0";
}

// Check if building type is landscape
function isLandscapeType(buildingTypeId: string): boolean {
    return buildingTypeId === "14" || buildingTypeId === "15";
}

// Check if building type is ACT
function isACTType(buildingTypeId: string): boolean {
    return buildingTypeId === "16";
}

// Check if building type is Matterport only
function isMatterportType(buildingTypeId: string): boolean {
    return buildingTypeId === "17";
}

// Elevation tiered pricing
function calculateElevationPrice(count: number): number {
    if (count <= 0) return 0;
    let total = 0;
    let remaining = count;

    const tier1 = Math.min(remaining, 10);
    total += tier1 * 25;
    remaining -= tier1;

    if (remaining > 0) {
        const tier2 = Math.min(remaining, 10);
        total += tier2 * 20;
        remaining -= tier2;
    }

    if (remaining > 0) {
        const tier3 = Math.min(remaining, 80);
        total += tier3 * 15;
        remaining -= tier3;
    }

    if (remaining > 0) {
        const tier4 = Math.min(remaining, 200);
        total += tier4 * 10;
        remaining -= tier4;
    }

    if (remaining > 0) {
        total += remaining * 5;
    }

    return total;
}

// ===== COMPONENT =====

export default function SimpleQuoteBuilder({
    lead,
    leadId,
    onQuoteSaved,
    existingQuotes,
}: SimpleQuoteBuilderProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [areas, setAreas] = useState<CPQArea[]>([]);
    const [travel, setTravel] = useState<TravelConfig>({
        dispatchLocation: "troy",
        distance: 0,
        travelCost: 0,
        scanDayFee: 0,
    });
    const [risks, setRisks] = useState<RiskConfig>({
        occupied: false,
        hazardous: false,
        no_power: false,
    });
    const [services, setServices] = useState<ServicesConfig>({
        matterport: false,
        additionalElevations: 0,
    });
    const [paymentTerms, setPaymentTerms] = useState<string>("standard");
    const [manualTotalOverride, setManualTotalOverride] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importJson, setImportJson] = useState("");
    const [importError, setImportError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState({
        areas: true,
        landscape: false,
        travel: false,
        risks: false,
        services: false,
    });

    // Landscape areas state
    interface LandscapeArea {
        id: string;
        name: string;
        type: "built" | "natural";
        acres: string;
        lod: "200" | "300" | "350";
    }
    const [landscapeAreas, setLandscapeAreas] = useState<LandscapeArea[]>([]);

    const addLandscapeArea = () => {
        const newId = `landscape-${Date.now()}`;
        setLandscapeAreas(prev => [...prev, {
            id: newId,
            name: `Landscape ${prev.length + 1}`,
            type: "built",
            acres: "",
            lod: "300"
        }]);
    };

    const updateLandscapeArea = (id: string, updates: Partial<LandscapeArea>) => {
        setLandscapeAreas(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const removeLandscapeArea = (id: string) => {
        setLandscapeAreas(prev => prev.filter(a => a.id !== id));
    };

    // AI Chat state
    interface ChatMessage {
        role: "user" | "assistant";
        content: string;
        timestamp: Date;
    }
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatLoading, setIsChatLoading] = useState(false);

    // Initialize from lead data
    useEffect(() => {
        if (lead && areas.length === 0) {
            const sqft = (lead as any).sqft || (lead as any).estimatedSqft || 15000;
            const buildingType = (lead as any).buildingType?.toString() || "4";

            const initialArea = createArea(
                "1",
                lead.projectName || "Main Building",
                buildingType,
                sqft
            );
            setAreas([initialArea]);
        }
    }, [lead]);

    // Calculate area pricing
    const calculateAreaPricing = useCallback((area: CPQArea): { clientPrice: number; upteamCost: number } => {
        let totalClient = 0;
        let totalUpteam = 0;

        // Special case: Landscape types (14, 15) use per-acre pricing
        if (isLandscapeType(area.buildingType)) {
            const acres = area.acres || (area.squareFeet / SQFT_PER_ACRE);
            const tierIndex = getLandscapeAcreageTierIndex(acres);
            const rates = area.buildingType === "14" ? BUILT_LANDSCAPE_RATES : NATURAL_LANDSCAPE_RATES;
            const lod = area.disciplines.arch?.lod || "300";
            const perAcreRate = rates[tierIndex]?.[lod] || 500;

            totalClient = acres * perAcreRate;
            totalUpteam = totalClient * UPTEAM_MULTIPLIER_FALLBACK;
            return { clientPrice: totalClient, upteamCost: totalUpteam };
        }

        // Special case: ACT (type 16) uses fixed $2/sqft
        if (isACTType(area.buildingType)) {
            const effectiveSqft = Math.max(area.squareFeet, MIN_SQFT_FLOOR);
            const scopePortion = SCOPE_PORTIONS[area.disciplines.arch?.scope || "full"] || 1.0;
            totalClient = effectiveSqft * ACT_RATE_PER_SQFT * scopePortion;
            totalUpteam = totalClient * UPTEAM_MULTIPLIER_FALLBACK;
            return { clientPrice: totalClient, upteamCost: totalUpteam };
        }

        // Special case: Matterport only (type 17) uses fixed $0.10/sqft
        if (isMatterportType(area.buildingType)) {
            const effectiveSqft = Math.max(area.squareFeet, MIN_SQFT_FLOOR);
            totalClient = effectiveSqft * MATTERPORT_RATE_PER_SQFT;
            totalUpteam = totalClient * UPTEAM_MULTIPLIER_FALLBACK;
            return { clientPrice: totalClient, upteamCost: totalUpteam };
        }

        // Standard calculation for all other building types
        const effectiveSqft = Math.max(area.squareFeet, MIN_SQFT_FLOOR);
        const activeRisks = Object.entries(risks).filter(([_, v]) => v).map(([k]) => k);
        const riskMultiplier = 1 + activeRisks.reduce((sum, r) => sum + (RISK_PREMIUMS[r] || 0), 0);

        Object.entries(area.disciplines).forEach(([discipline, config]) => {
            if (!config?.enabled) return;

            const baseRate = BASE_RATES[discipline] || 2.50;

            // Handle mixed scope (creates two line items: interior + exterior)
            if (config.scope === "mixed") {
                const interiorLod = config.mixedInteriorLod || config.lod || "300";
                const exteriorLod = config.mixedExteriorLod || config.lod || "300";

                // Interior portion (65%)
                const interiorMultiplier = LOD_MULTIPLIERS[interiorLod] || 1.0;
                let interiorPrice = effectiveSqft * baseRate * interiorMultiplier * 0.65;
                if (discipline === "arch") interiorPrice *= riskMultiplier;

                // Exterior portion (35%)
                const exteriorMultiplier = LOD_MULTIPLIERS[exteriorLod] || 1.0;
                let exteriorPrice = effectiveSqft * baseRate * exteriorMultiplier * 0.35;
                if (discipline === "arch") exteriorPrice *= riskMultiplier;

                totalClient += interiorPrice + exteriorPrice;
                totalUpteam += (interiorPrice + exteriorPrice) * UPTEAM_MULTIPLIER_FALLBACK;
            } else {
                // Standard scope calculation
                const lodMultiplier = LOD_MULTIPLIERS[config.lod] || 1.0;
                const scopePortion = SCOPE_PORTIONS[config.scope || "full"] || 1.0;

                let clientPrice = effectiveSqft * baseRate * lodMultiplier * scopePortion;

                // Apply risk premium to Architecture only
                if (discipline === "arch") {
                    clientPrice *= riskMultiplier;
                }

                const upteamCost = clientPrice * UPTEAM_MULTIPLIER_FALLBACK;

                totalClient += clientPrice;
                totalUpteam += upteamCost;
            }
        });

        return { clientPrice: totalClient, upteamCost: totalUpteam };
    }, [risks]);

    // Calculate travel cost
    const calculateTravelCost = useCallback((config: TravelConfig, totalSqft: number): { travelCost: number; scanDayFee: number } => {
        if (config.dispatchLocation === "brooklyn") {
            const tier = totalSqft >= 50000 ? "tierA" : totalSqft >= 10000 ? "tierB" : "tierC";
            const baseCost = BROOKLYN_BASE_FEES[tier];
            const extraMiles = Math.max(0, config.distance - TRAVEL_RATES.brooklynThreshold);
            const extraCost = extraMiles * TRAVEL_RATES.brooklyn;
            return { travelCost: baseCost + extraCost, scanDayFee: 0 };
        } else {
            const baseCost = config.distance * TRAVEL_RATES.standard;
            const scanDayFee = config.distance >= TRAVEL_RATES.scanDayFeeThreshold ? TRAVEL_RATES.scanDayFee : 0;
            return { travelCost: baseCost, scanDayFee };
        }
    }, []);

    // Calculate services cost
    const calculateServicesCost = useCallback((config: ServicesConfig, totalSqft: number): number => {
        let total = 0;

        if (config.matterport) {
            const sqft = config.matterportSqft || totalSqft;
            total += Math.max(sqft, MIN_SQFT_FLOOR) * 0.10;
        }

        total += calculateElevationPrice(config.additionalElevations);

        return total;
    }, []);

    // Calculate totals
    const totals = useMemo(() => {
        // Recalculate each area's pricing
        const updatedAreas = areas.map(area => {
            const { clientPrice, upteamCost } = calculateAreaPricing(area);
            return { ...area, clientPrice, upteamCost };
        });

        const areasTotal = updatedAreas.reduce((sum, a) => sum + a.clientPrice, 0);
        const areasUpteam = updatedAreas.reduce((sum, a) => sum + a.upteamCost, 0);
        const totalSqft = areas.reduce((sum, a) => sum + a.squareFeet, 0);

        // Calculate travel
        const travelResult = calculateTravelCost(travel, totalSqft);
        const travelTotal = travelResult.travelCost + travelResult.scanDayFee;

        // Calculate services
        const servicesTotal = calculateServicesCost(services, totalSqft);

        // Calculate risk premium display
        const activeRisks = Object.entries(risks).filter(([_, v]) => v).map(([k]) => k);
        const riskPercent = activeRisks.reduce((sum, r) => sum + ((RISK_PREMIUMS[r] || 0) * 100), 0);

        // Subtotal before payment terms
        const subtotal = areasTotal + travelTotal + servicesTotal;

        // Payment premium
        const paymentPremiumRate = PAYMENT_PREMIUMS[paymentTerms] || 0;
        const paymentPremium = subtotal * paymentPremiumRate;

        // Final total
        const calculatedTotal = subtotal + paymentPremium;
        const finalTotal = manualTotalOverride !== null ? manualTotalOverride : calculatedTotal;

        return {
            areas: updatedAreas,
            areasTotal,
            areasUpteam,
            totalSqft,
            travelTotal,
            servicesTotal,
            riskPercent,
            subtotal,
            paymentPremium,
            paymentPremiumRate,
            calculatedTotal,
            finalTotal,
            hasOverride: manualTotalOverride !== null,
        };
    }, [areas, travel, risks, services, paymentTerms, manualTotalOverride, calculateAreaPricing, calculateTravelCost, calculateServicesCost]);

    // Create a new area with defaults
    const createArea = (id: string, name: string, buildingType: string, sqft: number): CPQArea => ({
        id,
        name,
        buildingType,
        squareFeet: sqft,
        expanded: true,
        disciplines: {
            arch: { enabled: true, lod: "300", scope: "full" },
        },
        clientPrice: 0,
        upteamCost: 0,
    });

    // Add new area
    const addArea = useCallback(() => {
        const newId = (Math.max(0, ...areas.map(a => parseInt(a.id))) + 1).toString();
        setAreas(prev => [...prev, createArea(newId, `Area ${newId}`, "4", 0)]);
    }, [areas]);

    // Remove area
    const removeArea = useCallback((id: string) => {
        if (areas.length > 1) {
            setAreas(prev => prev.filter(a => a.id !== id));
        }
    }, [areas.length]);

    // Update area
    const updateArea = useCallback((id: string, updates: Partial<CPQArea>) => {
        setAreas(prev => prev.map(area => {
            if (area.id !== id) return area;
            return { ...area, ...updates };
        }));
    }, []);

    // Toggle discipline
    const toggleDiscipline = useCallback((areaId: string, discipline: keyof CPQArea["disciplines"]) => {
        setAreas(prev => prev.map(area => {
            if (area.id !== areaId) return area;

            const current = area.disciplines[discipline];
            const newDisciplines = { ...area.disciplines };

            if (current?.enabled) {
                newDisciplines[discipline] = { ...current, enabled: false };
            } else {
                newDisciplines[discipline] = {
                    enabled: true,
                    lod: "300",
                    scope: discipline === "arch" ? "full" : undefined,
                };
            }

            return { ...area, disciplines: newDisciplines };
        }));
    }, []);

    // Update discipline config
    const updateDiscipline = useCallback((
        areaId: string,
        discipline: keyof CPQArea["disciplines"],
        updates: Partial<DisciplineConfig>
    ) => {
        setAreas(prev => prev.map(area => {
            if (area.id !== areaId) return area;

            const current = area.disciplines[discipline] || { enabled: false, lod: "300" };
            return {
                ...area,
                disciplines: {
                    ...area.disciplines,
                    [discipline]: { ...current, ...updates },
                },
            };
        }));
    }, []);

    // Handle JSON import
    const handleImport = useCallback(() => {
        setImportError(null);

        try {
            const data: CPQImportData = JSON.parse(importJson);

            // Import areas
            if (data.areas && Array.isArray(data.areas) && data.areas.length > 0) {
                setAreas(data.areas.map((area, idx) => ({
                    id: area.id || (idx + 1).toString(),
                    name: area.name || `Area ${idx + 1}`,
                    buildingType: area.buildingType || "4",
                    squareFeet: area.squareFeet || 0,
                    expanded: true,
                    disciplines: area.disciplines || { arch: { enabled: true, lod: "300", scope: "full" } },
                    clientPrice: area.clientPrice || 0,
                    upteamCost: area.upteamCost || 0,
                })));
            }

            // Import travel
            if (data.travel) {
                setTravel(prev => ({
                    ...prev,
                    dispatchLocation: (data.travel?.dispatchLocation as any) || "troy",
                    distance: data.travel?.distance || 0,
                    travelCost: data.travel?.travelCost || prev.travelCost,
                    scanDayFee: data.travel?.scanDayFee || 0,
                }));
            }

            // Import risks
            if (data.risks && Array.isArray(data.risks)) {
                setRisks({
                    occupied: data.risks.includes("occupied"),
                    hazardous: data.risks.includes("hazardous"),
                    no_power: data.risks.includes("no_power"),
                });
            }

            // Import services
            if (data.services) {
                setServices(prev => ({
                    ...prev,
                    matterport: data.services?.matterport || false,
                    additionalElevations: data.services?.additionalElevations || 0,
                }));
            }

            // Import payment terms
            if (data.paymentTerms) {
                setPaymentTerms(data.paymentTerms);
            }

            // Import total override
            if (data.totalPrice !== undefined) {
                setManualTotalOverride(data.totalPrice);
            }

            toast({
                title: "Import Successful",
                description: `Imported ${data.areas?.length || 0} areas from CPQ data`,
            });

            setImportDialogOpen(false);
            setImportJson("");
        } catch (err) {
            setImportError(err instanceof Error ? err.message : "Invalid JSON format");
        }
    }, [importJson, toast]);

    // Handle file upload
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setImportJson(content);
        };
        reader.readAsText(file);
        event.target.value = "";
    }, []);

    // Save quote
    const handleSave = useCallback(async () => {
        if (areas.length === 0 || areas.every(a => a.squareFeet === 0)) {
            toast({
                title: "Cannot Save",
                description: "Please add at least one area with square footage",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);

        try {
            const quoteData = {
                leadId,
                totalPrice: totals.finalTotal,
                totalCost: totals.areasUpteam + (totals.travelTotal * 0.8) + (totals.servicesTotal * 0.7),
                grossMargin: totals.finalTotal - (totals.areasUpteam + (totals.travelTotal * 0.8)),
                grossMarginPercent: ((totals.finalTotal - totals.areasUpteam) / totals.finalTotal) * 100,
                lineItems: [
                    ...totals.areas.flatMap(area =>
                        Object.entries(area.disciplines)
                            .filter(([_, config]) => config?.enabled)
                            .map(([disc, config]) => ({
                                id: `${area.id}-${disc}`,
                                label: `${area.name} - ${disc.toUpperCase()} (LOD ${config?.lod || "300"})`,
                                category: "discipline",
                                clientPrice: config?.clientPrice || area.clientPrice / Object.values(area.disciplines).filter(d => d?.enabled).length,
                                upteamCost: config?.upteamCost || area.upteamCost / Object.values(area.disciplines).filter(d => d?.enabled).length,
                            }))
                    ),
                    ...(totals.travelTotal > 0 ? [{
                        id: "travel",
                        label: `Travel - ${travel.dispatchLocation} (${travel.distance} mi)`,
                        category: "travel",
                        clientPrice: totals.travelTotal,
                        upteamCost: totals.travelTotal * 0.8,
                    }] : []),
                    ...(totals.servicesTotal > 0 ? [{
                        id: "services",
                        label: "Additional Services",
                        category: "service",
                        clientPrice: totals.servicesTotal,
                        upteamCost: totals.servicesTotal * 0.7,
                    }] : []),
                    ...(totals.paymentPremium > 0 ? [{
                        id: "payment-premium",
                        label: `Payment Terms Premium (${paymentTerms})`,
                        category: "adjustment",
                        clientPrice: totals.paymentPremium,
                        upteamCost: 0,
                    }] : []),
                ],
                subtotals: {
                    modeling: totals.areasTotal,
                    travel: totals.travelTotal,
                    services: totals.servicesTotal,
                    paymentPremium: totals.paymentPremium,
                },
                integrityStatus: "pass",
                integrityFlags: [],
                requestData: {
                    areas: areas.map(a => ({
                        ...a,
                        disciplines: Object.entries(a.disciplines)
                            .filter(([_, v]) => v?.enabled)
                            .map(([k]) => k),
                    })),
                    travel,
                    risks,
                    services,
                    paymentTerms,
                    manualTotalOverride,
                    quoteMode: "cpq_import",
                },
            };

            const response = await apiRequest("POST", `/api/leads/${leadId}/cpq-quotes`, quoteData);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to save quote");
            }

            queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "cpq-quotes"] });
            queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });

            toast({
                title: "Quote Saved",
                description: `Quote saved: $${totals.finalTotal.toLocaleString()}`,
            });

            onQuoteSaved?.();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to save quote",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    }, [areas, travel, risks, services, paymentTerms, manualTotalOverride, totals, leadId, queryClient, toast, onQuoteSaved]);

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // AI Chat - Send message
    const sendChatMessage = async () => {
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: chatInput.trim(),
            timestamp: new Date()
        };
        setChatMessages(prev => [...prev, userMessage]);
        setChatInput("");
        setIsChatLoading(true);

        try {
            const response = await apiRequest("POST", "/api/cpq/chat", {
                message: userMessage.content,
                quoteState: {
                    areas: areas.map(a => ({
                        id: a.id,
                        name: a.name,
                        buildingType: a.buildingType,
                        squareFeet: a.squareFeet.toString(),
                        disciplines: Object.entries(a.disciplines)
                            .filter(([_, v]) => v?.enabled)
                            .map(([k]) => k)
                    })),
                    landscapeAreas: landscapeAreas.map(a => ({
                        id: a.id,
                        name: a.name,
                        type: a.type,
                        acres: a.acres,
                        lod: a.lod
                    })),
                    dispatchLocation: travel.dispatchLocation,
                    distance: travel.distance,
                    risks: Object.entries(risks).filter(([_, v]) => v).map(([k]) => k),
                    paymentTerms,
                },
                leadContext: {
                    projectName: lead.projectName,
                    clientName: lead.clientName,
                    projectAddress: lead.projectAddress
                },
                conversationHistory: chatMessages.slice(-6).map(m => ({
                    role: m.role,
                    content: m.content
                }))
            });

            const data = await response.json();

            // Apply actions from AI
            if (data.actions && Array.isArray(data.actions)) {
                data.actions.forEach((action: any) => {
                    switch (action.type) {
                        case "toggleDiscipline":
                            if (action.areaId && action.discipline) {
                                // Find area - if areaId is "1", find first area
                                const targetArea = areas.find(a => a.id === action.areaId) || areas[0];
                                if (targetArea) {
                                    toggleDiscipline(targetArea.id, action.discipline);
                                }
                            }
                            break;
                        case "updateArea":
                            if (action.areaId && action.updates) {
                                const targetArea = areas.find(a => a.id === action.areaId) || areas[0];
                                if (targetArea) {
                                    setAreas(prev => prev.map(a =>
                                        a.id === targetArea.id ? { ...a, ...action.updates } : a
                                    ));
                                }
                            }
                            break;
                        case "addArea":
                            addArea();
                            break;
                        case "addLandscape":
                            addLandscapeArea();
                            // Update the newly added landscape with provided values
                            setTimeout(() => {
                                setLandscapeAreas(prev => {
                                    if (prev.length > 0) {
                                        const lastId = prev[prev.length - 1].id;
                                        return prev.map(a => a.id === lastId ? {
                                            ...a,
                                            name: action.name || a.name,
                                            type: action.landscapeType || a.type,
                                            acres: action.acres || a.acres,
                                            lod: action.lod || a.lod,
                                        } : a);
                                    }
                                    return prev;
                                });
                            }, 100);
                            break;
                        case "toggleRisk":
                            if (action.risk) {
                                setRisks(prev => ({
                                    ...prev,
                                    [action.risk]: !prev[action.risk as keyof RiskConfig]
                                }));
                            }
                            break;
                        case "setDispatchLocation":
                            if (action.location) {
                                setTravel(prev => ({ ...prev, dispatchLocation: action.location }));
                            }
                            break;
                        case "setDistance":
                            if (action.distance !== undefined) {
                                setTravel(prev => ({ ...prev, distance: action.distance }));
                            }
                            break;
                        case "setPaymentTerms":
                            if (action.terms) {
                                setPaymentTerms(action.terms);
                            }
                            break;
                        case "toggleMatterport":
                            setServices(prev => ({
                                ...prev,
                                matterport: action.enabled !== undefined ? action.enabled : !prev.matterport
                            }));
                            break;
                        case "setAdditionalElevations":
                            if (action.count !== undefined) {
                                setServices(prev => ({
                                    ...prev,
                                    additionalElevations: action.count
                                }));
                            }
                            break;
                    }
                });
            }

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: data.response || "I processed your request.",
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            console.error("Chat error:", error);
            setChatMessages(prev => [...prev, {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date()
            }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <>
            <ScrollArea className="h-full">
                <div className="space-y-4 p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-semibold">CPQ Quote Editor</h3>
                            <Badge variant="outline" className="text-xs">
                                {totals.totalSqft.toLocaleString()} sqft
                            </Badge>
                            {totals.totalSqft >= TIER_A_THRESHOLD && (
                                <Badge className="bg-amber-500 text-white text-xs">
                                    Tier A
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <a
                                    href="https://cpq.scan2plan.dev"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Open CPQ
                                </a>
                            </Button>
                            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <FileJson className="w-4 h-4 mr-2" />
                                        Import CPQ
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Import from External CPQ</DialogTitle>
                                        <DialogDescription>
                                            Paste JSON output from your CPQ application, or upload a JSON file.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4">
                                        <div>
                                            <Label>Upload JSON File</Label>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".json"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />
                                            <Button
                                                variant="outline"
                                                className="w-full mt-2"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Choose File
                                            </Button>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t" />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-background px-2 text-muted-foreground">Or paste JSON</span>
                                            </div>
                                        </div>

                                        <div>
                                            <Label>JSON Data</Label>
                                            <textarea
                                                className="w-full h-48 mt-2 p-3 border rounded-md font-mono text-xs"
                                                placeholder='{"areas": [{"name": "Main", "squareFeet": 50000, "disciplines": {"arch": {"enabled": true, "lod": "300"}}}]}'
                                                value={importJson}
                                                onChange={(e) => setImportJson(e.target.value)}
                                            />
                                        </div>

                                        {importError && (
                                            <p className="text-sm text-destructive">{importError}</p>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleImport} disabled={!importJson.trim()}>
                                            Import
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save Quote
                            </Button>
                        </div>
                    </div>

                    {/* Areas Section */}
                    <Collapsible open={expandedSections.areas} onOpenChange={() => toggleSection("areas")}>
                        <Card>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Building2 className="w-4 h-4" />
                                            Project Areas
                                            <Badge variant="secondary" className="ml-2">{areas.length}</Badge>
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-primary">
                                                ${totals.areasTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                            {expandedSections.areas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="space-y-4 pt-0">
                                    {totals.areas.map((area, index) => (
                                        <div
                                            key={area.id}
                                            className="p-4 rounded-lg border bg-muted/30 space-y-4"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">Area {index + 1}</span>
                                                    <Badge variant="outline" className="text-xs">
                                                        ${area.clientPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </Badge>
                                                </div>
                                                {areas.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeArea(area.id)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Basic Info */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="col-span-2">
                                                    <Label className="text-xs">Area Name</Label>
                                                    <Input
                                                        value={area.name}
                                                        onChange={(e) => updateArea(area.id, { name: e.target.value })}
                                                        placeholder="Main Building"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-xs">Building Type</Label>
                                                    <Select
                                                        value={area.buildingType}
                                                        onValueChange={(value) => updateArea(area.id, { buildingType: value })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(CPQ_BUILDING_TYPES).map(([value, label]) => (
                                                                <SelectItem key={value} value={value}>
                                                                    {label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div>
                                                    {isLandscapeType(area.buildingType) ? (
                                                        <>
                                                            <Label className="text-xs">Acres</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.1"
                                                                value={area.acres || ""}
                                                                onChange={(e) => updateArea(area.id, {
                                                                    acres: parseFloat(e.target.value) || 0,
                                                                    squareFeet: Math.round((parseFloat(e.target.value) || 0) * SQFT_PER_ACRE)
                                                                })}
                                                                placeholder="5.0"
                                                            />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Label className="text-xs">Square Footage</Label>
                                                            <Input
                                                                type="number"
                                                                value={area.squareFeet || ""}
                                                                onChange={(e) => updateArea(area.id, { squareFeet: parseInt(e.target.value) || 0 })}
                                                                placeholder="50,000"
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Special type notices */}
                                            {isACTType(area.buildingType) && (
                                                <div className="px-3 py-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600">
                                                    ACT pricing: $2.00/sqft fixed rate
                                                </div>
                                            )}
                                            {isMatterportType(area.buildingType) && (
                                                <div className="px-3 py-2 rounded bg-purple-500/10 border border-purple-500/30 text-xs text-purple-600">
                                                    Matterport only: $0.10/sqft fixed rate
                                                </div>
                                            )}
                                            {isLandscapeType(area.buildingType) && (
                                                <div className="px-3 py-2 rounded bg-green-500/10 border border-green-500/30 text-xs text-green-600">
                                                    Landscape: Per-acre pricing (LOD-based rates)
                                                </div>
                                            )}

                                            {/* Disciplines */}
                                            <div>
                                                <Label className="text-xs mb-2 block">Disciplines</Label>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {(["arch", "mepf", "structure", "site"] as const).map((disc) => {
                                                        const config = area.disciplines[disc];
                                                        const isEnabled = config?.enabled;

                                                        return (
                                                            <div
                                                                key={disc}
                                                                className={`p-3 rounded-lg border ${isEnabled ? "bg-primary/5 border-primary/30" : "bg-muted/50"}`}
                                                            >
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Checkbox
                                                                        checked={isEnabled}
                                                                        onCheckedChange={() => toggleDiscipline(area.id, disc)}
                                                                    />
                                                                    <span className="text-sm font-medium uppercase">{disc === "site" ? "GRADE" : disc}</span>
                                                                </div>

                                                                {isEnabled && (
                                                                    <div className="space-y-2">
                                                                        <Select
                                                                            value={config?.lod || "300"}
                                                                            onValueChange={(v) => updateDiscipline(area.id, disc, { lod: v as "200" | "300" | "350" })}
                                                                        >
                                                                            <SelectTrigger className="h-8">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="200">LOD 200</SelectItem>
                                                                                <SelectItem value="300">LOD 300</SelectItem>
                                                                                <SelectItem value="350">LOD 350</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>

                                                                        {disc === "arch" && (
                                                                            <>
                                                                                <Select
                                                                                    value={config?.scope || "full"}
                                                                                    onValueChange={(v) => updateDiscipline(area.id, disc, { scope: v as "full" | "interior" | "exterior" | "mixed" })}
                                                                                >
                                                                                    <SelectTrigger className="h-8">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="full">Full</SelectItem>
                                                                                        <SelectItem value="interior">Interior (65%)</SelectItem>
                                                                                        <SelectItem value="exterior">Exterior (35%)</SelectItem>
                                                                                        <SelectItem value="mixed">Mixed (Int+Ext)</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>

                                                                                {/* Mixed scope - separate LODs for interior/exterior */}
                                                                                {config?.scope === "mixed" && (
                                                                                    <div className="grid grid-cols-2 gap-1">
                                                                                        <div>
                                                                                            <Label className="text-[10px] text-muted-foreground">Int LOD</Label>
                                                                                            <Select
                                                                                                value={config?.mixedInteriorLod || "300"}
                                                                                                onValueChange={(v) => updateDiscipline(area.id, disc, { mixedInteriorLod: v as "200" | "300" | "350" })}
                                                                                            >
                                                                                                <SelectTrigger className="h-7 text-xs">
                                                                                                    <SelectValue />
                                                                                                </SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    <SelectItem value="200">200</SelectItem>
                                                                                                    <SelectItem value="300">300</SelectItem>
                                                                                                    <SelectItem value="350">350</SelectItem>
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                        </div>
                                                                                        <div>
                                                                                            <Label className="text-[10px] text-muted-foreground">Ext LOD</Label>
                                                                                            <Select
                                                                                                value={config?.mixedExteriorLod || "300"}
                                                                                                onValueChange={(v) => updateDiscipline(area.id, disc, { mixedExteriorLod: v as "200" | "300" | "350" })}
                                                                                            >
                                                                                                <SelectTrigger className="h-7 text-xs">
                                                                                                    <SelectValue />
                                                                                                </SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    <SelectItem value="200">200</SelectItem>
                                                                                                    <SelectItem value="300">300</SelectItem>
                                                                                                    <SelectItem value="350">350</SelectItem>
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <Button variant="outline" onClick={addArea} className="w-full">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Area
                                    </Button>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>

                    {/* Landscape Section */}
                    <Collapsible open={expandedSections.landscape} onOpenChange={() => toggleSection("landscape")}>
                        <Card>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <TreePine className="w-4 h-4" />
                                            Landscape
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{landscapeAreas.length} areas</Badge>
                                            {expandedSections.landscape ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="space-y-4 pt-0">
                                    {landscapeAreas.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No landscape areas. Click below to add one.
                                        </p>
                                    ) : (
                                        landscapeAreas.map((area) => (
                                            <div key={area.id} className="p-3 border rounded-lg space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Input
                                                        placeholder="Landscape Name"
                                                        value={area.name}
                                                        onChange={(e) => updateLandscapeArea(area.id, { name: e.target.value })}
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeLandscapeArea(area.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <Label className="text-xs">Type</Label>
                                                        <Select
                                                            value={area.type}
                                                            onValueChange={(v: "built" | "natural") => updateLandscapeArea(area.id, { type: v })}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="built">Built (Manicured)</SelectItem>
                                                                <SelectItem value="natural">Natural (Wooded)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Acres</Label>
                                                        <Input
                                                            type="number"
                                                            placeholder="5"
                                                            value={area.acres}
                                                            onChange={(e) => updateLandscapeArea(area.id, { acres: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">LOD</Label>
                                                        <Select
                                                            value={area.lod}
                                                            onValueChange={(v: "200" | "300" | "350") => updateLandscapeArea(area.id, { lod: v })}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="200">LOD 200</SelectItem>
                                                                <SelectItem value="300">LOD 300</SelectItem>
                                                                <SelectItem value="350">LOD 350</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <Button variant="outline" onClick={addLandscapeArea} className="w-full">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Landscape
                                    </Button>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>

                    {/* Travel Section */}
                    <Collapsible open={expandedSections.travel} onOpenChange={() => toggleSection("travel")}>
                        <Card>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Car className="w-4 h-4" />
                                            Travel
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-primary">
                                                ${totals.travelTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                            {expandedSections.travel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="pt-0">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <Label className="text-xs">Dispatch Location</Label>
                                            <Select
                                                value={travel.dispatchLocation}
                                                onValueChange={(v) => setTravel(prev => ({ ...prev, dispatchLocation: v as any }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="troy">Troy, NY</SelectItem>
                                                    <SelectItem value="woodstock">Woodstock, GA</SelectItem>
                                                    <SelectItem value="boise">Boise, ID</SelectItem>
                                                    <SelectItem value="brooklyn">Brooklyn, NY</SelectItem>
                                                    <SelectItem value="fly_out">Fly Out</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label className="text-xs">Distance (miles)</Label>
                                            <Input
                                                type="number"
                                                value={travel.distance || ""}
                                                onChange={(e) => setTravel(prev => ({ ...prev, distance: parseInt(e.target.value) || 0 }))}
                                                placeholder="0"
                                            />
                                        </div>

                                        <div>
                                            <Label className="text-xs">Calculated Cost</Label>
                                            <div className="h-10 px-3 flex items-center rounded-md border bg-muted font-semibold">
                                                ${totals.travelTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>

                    {/* Risk Premiums Section */}
                    <Collapsible open={expandedSections.risks} onOpenChange={() => toggleSection("risks")}>
                        <Card>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Risk Premiums
                                            {totals.riskPercent > 0 && (
                                                <Badge variant="destructive" className="ml-2">+{totals.riskPercent}%</Badge>
                                            )}
                                        </CardTitle>
                                        {expandedSections.risks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="pt-0">
                                    <p className="text-xs text-muted-foreground mb-3">Risk premiums apply to Architecture discipline only</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="flex items-center gap-2 p-3 rounded-lg border">
                                            <Checkbox
                                                checked={risks.occupied}
                                                onCheckedChange={(c) => setRisks(prev => ({ ...prev, occupied: !!c }))}
                                            />
                                            <div>
                                                <span className="text-sm font-medium">Occupied</span>
                                                <p className="text-xs text-muted-foreground">+15%</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 p-3 rounded-lg border">
                                            <Checkbox
                                                checked={risks.hazardous}
                                                onCheckedChange={(c) => setRisks(prev => ({ ...prev, hazardous: !!c }))}
                                            />
                                            <div>
                                                <span className="text-sm font-medium">Hazardous</span>
                                                <p className="text-xs text-muted-foreground">+25%</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 p-3 rounded-lg border">
                                            <Checkbox
                                                checked={risks.no_power}
                                                onCheckedChange={(c) => setRisks(prev => ({ ...prev, no_power: !!c }))}
                                            />
                                            <div>
                                                <span className="text-sm font-medium">No Power</span>
                                                <p className="text-xs text-muted-foreground">+20%</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>

                    {/* Services Section */}
                    <Collapsible open={expandedSections.services} onOpenChange={() => toggleSection("services")}>
                        <Card>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Zap className="w-4 h-4" />
                                            Additional Services
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-primary">
                                                ${totals.servicesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                            {expandedSections.services ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="pt-0">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2 p-3 rounded-lg border">
                                            <Checkbox
                                                checked={services.matterport}
                                                onCheckedChange={(c) => setServices(prev => ({ ...prev, matterport: !!c }))}
                                            />
                                            <div>
                                                <span className="text-sm font-medium">Matterport</span>
                                                <p className="text-xs text-muted-foreground">$0.10/sqft</p>
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-xs">Additional Elevations</Label>
                                            <Input
                                                type="number"
                                                value={services.additionalElevations || ""}
                                                onChange={(e) => setServices(prev => ({ ...prev, additionalElevations: parseInt(e.target.value) || 0 }))}
                                                placeholder="0"
                                            />
                                            {services.additionalElevations > 0 && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    = ${calculateElevationPrice(services.additionalElevations).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>

                    {/* Quote Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Quote Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Areas Subtotal</span>
                                <span>${totals.areasTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>

                            {totals.travelTotal > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Travel</span>
                                    <span>${totals.travelTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {totals.servicesTotal > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Services</span>
                                    <span>${totals.servicesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            <Separator />

                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>

                            {/* Payment Terms */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm text-muted-foreground">Payment Terms</Label>
                                    <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                                        <SelectTrigger className="w-40 h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CPQ_PAYMENT_TERMS.filter(t => t !== "other").map((term) => (
                                                <SelectItem key={term} value={term}>
                                                    {CPQ_PAYMENT_TERMS_DISPLAY[term]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {totals.paymentPremium > 0 && (
                                    <span className="text-sm">+${totals.paymentPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                )}
                            </div>

                            <Separator />

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-lg">Total</span>
                                    {totals.hasOverride && (
                                        <Badge variant="secondary" className="text-xs">Override</Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!totals.hasOverride ? (
                                        <span className="text-2xl font-bold text-primary">
                                            ${totals.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    ) : (
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className="w-36 text-right font-bold text-lg"
                                            value={manualTotalOverride || ""}
                                            onChange={(e) => setManualTotalOverride(parseFloat(e.target.value) || null)}
                                        />
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setManualTotalOverride(totals.hasOverride ? null : totals.calculatedTotal)}
                                    >
                                        {totals.hasOverride ? "Auto" : "Override"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>

            {/* AI Chat Panel - Floating */}
            {
                isChatOpen && (
                    <div className="fixed bottom-20 right-6 w-96 h-[500px] bg-background border rounded-lg shadow-xl z-50 flex flex-col">
                        <div className="flex items-center justify-between p-3 border-b bg-primary/5">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="font-medium">Quote Assistant</span>
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setIsChatOpen(false)}
                                className="h-7 w-7"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <ScrollArea className="flex-1 p-3">
                            {chatMessages.length === 0 ? (
                                <div className="text-center text-muted-foreground text-sm py-8">
                                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Hi! I can help you configure this quote.</p>
                                    <p className="mt-2 text-xs">Try saying:</p>
                                    <ul className="mt-1 text-xs space-y-1">
                                        <li>"Add MEP to this quote"</li>
                                        <li>"Change to LOD 350"</li>
                                        <li>"Add occupied building risk"</li>
                                    </ul>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {chatMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[85%] p-2 rounded-lg text-sm ${msg.role === "user"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted"
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted p-2 rounded-lg">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </ScrollArea>

                        <div className="p-3 border-t">
                            <div className="flex gap-2">
                                <Input
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Ask about pricing..."
                                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                                    disabled={isChatLoading}
                                />
                                <Button
                                    size="icon"
                                    onClick={sendChatMessage}
                                    disabled={isChatLoading || !chatInput.trim()}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Chat Toggle Button - Floating */}
            <Button
                size="icon"
                className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40"
                onClick={() => setIsChatOpen(!isChatOpen)}
            >
                {isChatOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
            </Button>
        </>
    );
}
