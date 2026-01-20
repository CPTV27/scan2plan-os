/**
 * CPQ Calculator Component - Embedded Quote Builder
 * 
 * Client-side pricing calculator for creating and editing quotes.
 * All calculations happen in the browser for instant feedback.
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Calculator as CalculatorIcon,
  Building2,
  MapPin,
  FileText,
  DollarSign,
  Plane,
  Mail,
  Copy,
  AlertCircle,
  Link,
  Loader2,
  PenTool,
  ChevronDown,
  Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { BoundaryDrawer } from "@/components/BoundaryDrawer";
import type { Lead, CpqQuote } from "@shared/schema";
import { CPQ_PAYMENT_TERMS, CPQ_PAYMENT_TERMS_DISPLAY } from "@shared/schema";
import { enrichAreaWithProducts, generateQuoteSkus } from "@/lib/productResolver";
import { LineItemEditor, type QuoteLineItem } from "./LineItemEditor";
import { generateEditableLineItems, lineItemsToSkuManifest } from "./lineItemUtils";
import {
  calculatePricing,
  calculateTravelCost,
  BUILDING_TYPES,
  LANDSCAPE_TYPES,
  DISCIPLINES,
  LOD_OPTIONS,
  SCOPE_OPTIONS,
  RISK_FACTORS,
  SERVICE_RATES,
  FACADE_TYPES,
  calculateMarginPercent,
  passesMarginGate,
  getMarginGateError,
  FY26_GOALS,
  TIER_A_THRESHOLD,
  TIER_A_MARGINS,
  ACRES_TO_SQFT,
  calculateTierAPricing,
  calculateTotalSqft,
  getAreaSqft,
  isTierAProject,
  isLandscapeBuildingType,
  normalizeDispatchLocation,
  toUppercaseDispatchLocation,
  isDispatchLocation,
  type Area,
  type TravelConfig,
  type PricingResult,
  type BoundaryCoordinate,
  type Facade,
} from "./pricing";

// Pricing mode type
type PricingMode = "standard" | "landscape" | "tierA";

interface CalculatorProps {
  leadId?: number;
  quoteId?: number;
  onClose?: () => void;
}

export default function CPQCalculator({ leadId, quoteId, onClose }: CalculatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pricing mode (standard areas, landscape areas, or Tier A)
  const [pricingMode, setPricingMode] = useState<PricingMode>("standard");

  // Line Item Editor state
  const [showLineItemEditor, setShowLineItemEditor] = useState(false);
  const [customLineItems, setCustomLineItems] = useState<QuoteLineItem[] | null>(null);
  const [hasCustomizedPricing, setHasCustomizedPricing] = useState(false);

  // Form state - areas use buildingType (14-15 = landscape, others = building)
  const [areas, setAreas] = useState<Area[]>([
    {
      id: "1",
      name: "Area 1",
      buildingType: "1", // Default to Commercial - Standard
      squareFeet: "",
      lod: "200",
      disciplines: ["architecture"],
      scope: "full",
    },
  ]);
  const [services, setServices] = useState<Record<string, number>>({});
  const [travel, setTravel] = useState<TravelConfig>({ dispatchLocation: "woodstock", distance: 0 });
  const [risks, setRisks] = useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = useState("standard");
  const [projectNotes, setProjectNotes] = useState("");

  // Filter areas by type for display - uses buildingType to determine landscape (14-15)
  const standardAreas = useMemo(() => areas.filter(a => !isLandscapeBuildingType(a.buildingType)), [areas]);
  const landscapeAreas = useMemo(() => areas.filter(a => isLandscapeBuildingType(a.buildingType)), [areas]);

  // Building features
  const [hasBasement, setHasBasement] = useState(false);
  const [hasAttic, setHasAttic] = useState(false);

  // Acoustic ceiling tile scanning
  const [actScanning, setActScanning] = useState<"yes" | "no" | "other" | "ask_client">("no");
  const [actScanningNotes, setActScanningNotes] = useState("");

  // Scanning & Registration Only
  const [scanningOnly, setScanningOnly] = useState<"none" | "full_day" | "half_day" | "ask_client">("none");

  // Site status (for RFI)
  const [siteStatus, setSiteStatus] = useState<"vacant" | "occupied" | "construction" | "ask_client">("vacant");

  // MEP scope (for RFI)
  const [mepScope, setMepScope] = useState<"full" | "partial" | "none" | "ask_client">("full");

  // Custom travel cost override
  const [customTravelCost, setCustomTravelCost] = useState<string>("");

  // Distance calculation loading state
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  // Boundary drawing state for landscape areas
  const [boundaryDrawerAreaId, setBoundaryDrawerAreaId] = useState<string | null>(null);

  // Price adjustment for margin gate compliance
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState<number>(0);

  // Margin target slider (35%-60%, default 45% matches guardrail)
  const [marginTarget, setMarginTarget] = useState<number>(0.45);

  // Audit counter - used to force recalculation when Re-run Audit is clicked
  const [auditCounter, setAuditCounter] = useState(0);

  // Internal cost tracking / Tier A Pricing
  const [tierAScanningCost, setTierAScanningCost] = useState<string>("");
  const [tierAScanningCostOther, setTierAScanningCostOther] = useState<string>("");
  const [tierAModelingCost, setTierAModelingCost] = useState<string>("");
  const [tierAMargin, setTierAMargin] = useState<string>("");
  const [assumedMargin, setAssumedMargin] = useState<string>("");
  const [profitabilityCaveats, setProfitabilityCaveats] = useState("");

  // === PROJECT DETAILS ===
  const [specificBuilding, setSpecificBuilding] = useState("");
  const [typeOfBuilding, setTypeOfBuilding] = useState("");

  // === DELIVERABLES ===
  const [interiorCadElevations, setInteriorCadElevations] = useState("");
  const [bimDeliverable, setBimDeliverable] = useState<string[]>([]);
  const [bimDeliverableOther, setBimDeliverableOther] = useState("");
  const [bimVersion, setBimVersion] = useState("");
  const [customTemplate, setCustomTemplate] = useState<"yes" | "no" | "other">("no");
  const [customTemplateOther, setCustomTemplateOther] = useState("");

  // === ACT CEILING (enhanced) ===
  const [aboveBelowACT, setAboveBelowACT] = useState<"above" | "below" | "both" | "other" | "">("");
  const [aboveBelowACTOther, setAboveBelowACTOther] = useState("");
  const [actSqft, setActSqft] = useState("");

  // === INTERNAL NOTES ===
  const [sqftAssumptions, setSqftAssumptions] = useState("");
  const [assumedGrossMargin, setAssumedGrossMargin] = useState("");
  const [caveatsProfitability, setCaveatsProfitability] = useState("");
  const [mixedScope, setMixedScope] = useState("");
  const [insuranceRequirements, setInsuranceRequirements] = useState("");

  // === CONTACTS ===
  const [accountContact, setAccountContact] = useState("");
  const [accountContactEmail, setAccountContactEmail] = useState("");
  const [accountContactPhone, setAccountContactPhone] = useState("");
  const [designProContact, setDesignProContact] = useState("");
  const [designProCompanyContact, setDesignProCompanyContact] = useState("");
  const [otherContact, setOtherContact] = useState("");
  const [proofLinks, setProofLinks] = useState("");

  // === TIMELINE (quote-specific - CRM fields like lead source, probability are in DealWorkspace) ===
  const [estimatedTimeline, setEstimatedTimeline] = useState("");
  const [timelineNotes, setTimelineNotes] = useState("");

  // Calculate total sqft for Tier A detection (uses new helper function)
  const totalSqft = useMemo(() => calculateTotalSqft(areas), [areas]);

  // Detect if project qualifies for Tier A pricing (auto-suggest)
  const qualifiesForTierA = isTierAProject(totalSqft);

  // Actual Tier A mode is either manually selected OR auto-detected
  const isTierA = pricingMode === "tierA";

  // Calculate Tier A pricing when enabled
  const tierAPricingResult = useMemo(() => {
    if (!isTierA) return null;
    return calculateTierAPricing(
      {
        scanningCost: tierAScanningCost as any,
        scanningCostOther: parseFloat(tierAScanningCostOther) || undefined,
        modelingCost: parseFloat(tierAModelingCost) || 0,
        margin: tierAMargin as any,
      },
      travel.distance || 0
    );
  }, [isTierA, tierAScanningCost, tierAScanningCostOther, tierAModelingCost, tierAMargin, travel.distance]);

  // Fetch lead data if leadId provided
  const { data: lead } = useQuery<Lead>({
    queryKey: ["/api/leads", leadId],
    enabled: !!leadId,
  });

  // Fetch existing quote if quoteId provided
  const { data: existingQuote } = useQuery<CpqQuote>({
    queryKey: ["/api/cpq/quotes", quoteId],
    enabled: !!quoteId,
  });

  // Load lead data into form
  useEffect(() => {
    if (lead) {
      // Pre-fill from lead data
      if (lead.sqft) {
        setAreas((prev) => [
          {
            ...prev[0],
            squareFeet: lead.sqft?.toString() || "",
            name: lead.projectName || "Main Building",
          },
        ]);
      }
      if (lead.distance) {
        setTravel({
          dispatchLocation: lead.dispatchLocation?.toLowerCase() || "woodstock",
          distance: lead.distance,
        });
      }

      // Auto-populate from Google Intel if available (only when NOT editing existing quote)
      // When editing an existing quote, preserve user-edited values
      if (!quoteId) {
        const googleIntel = lead.googleIntel as any;
        if (googleIntel) {
          // Use Google travel distance if available
          if (googleIntel.travelInsights?.available && googleIntel.travelInsights?.distanceMiles) {
            setTravel({
              dispatchLocation: lead.dispatchLocation?.toLowerCase() || "woodstock",
              distance: Math.round(googleIntel.travelInsights.distanceMiles),
            });
          }
          // Use Google building insights for SQFT if no lead.sqft
          if (googleIntel.buildingInsights?.available && googleIntel.buildingInsights?.squareFeet && !lead.sqft) {
            setAreas((prev) => [
              {
                ...prev[0],
                squareFeet: googleIntel.buildingInsights.squareFeet.toString(),
                name: lead.projectName || "Main Building",
              },
            ]);
          }
        }
      }
    }
  }, [lead]);

  // Load existing quote data
  useEffect(() => {
    if (existingQuote) {
      if (existingQuote.areas) {
        setAreas(existingQuote.areas as Area[]);
      }
      if (existingQuote.services) {
        setServices(existingQuote.services as Record<string, number>);
      }
      if (existingQuote.travel) {
        const travelData = existingQuote.travel as TravelConfig & { customCost?: number; miles?: number };
        // Handle both "distance" (new format) and "miles" (legacy database format)
        const distanceValue = travelData.distance ?? travelData.miles ?? 0;
        setTravel({
          dispatchLocation: travelData.dispatchLocation?.toLowerCase() || "woodstock",
          distance: distanceValue
        });
        if (travelData.customCost) {
          setCustomTravelCost(travelData.customCost.toString());
        }
      }
      if (existingQuote.risks) {
        setRisks(existingQuote.risks as string[]);
      }
      setProjectNotes(existingQuote.notes || "");
      setPaymentTerms(existingQuote.paymentTerms || "standard");

      // Load new CPQ fields
      const quote = existingQuote as any;
      if (quote.buildingFeatures) {
        setHasBasement(quote.buildingFeatures.hasBasement || false);
        setHasAttic(quote.buildingFeatures.hasAttic || false);
      }
      if (quote.actScanning) {
        setActScanning(quote.actScanning);
      }
      if (quote.actScanningNotes) {
        setActScanningNotes(quote.actScanningNotes);
      }
      if (quote.scanningOnly) {
        setScanningOnly(quote.scanningOnly);
      }
      if (quote.siteStatus) {
        setSiteStatus(quote.siteStatus);
      }
      if (quote.mepScope) {
        setMepScope(quote.mepScope);
      }
      if (quote.internalCosts) {
        if (quote.internalCosts.tierAScanningCost != null) {
          setTierAScanningCost(quote.internalCosts.tierAScanningCost.toString());
        }
        if (quote.internalCosts.tierAModelingCost != null) {
          setTierAModelingCost(quote.internalCosts.tierAModelingCost.toString());
        }
        if (quote.internalCosts.assumedMargin) {
          setAssumedMargin(quote.internalCosts.assumedMargin);
        }
        if (quote.internalCosts.profitabilityCaveats) {
          setProfitabilityCaveats(quote.internalCosts.profitabilityCaveats);
        }
      }
      // Load price adjustment
      if (quote.priceAdjustmentPercent != null) {
        setPriceAdjustmentPercent(quote.priceAdjustmentPercent);
      }

      // Load scoping data
      if (quote.scopingData) {
        const sd = quote.scopingData;
        // Project Details
        if (sd.specificBuilding) setSpecificBuilding(sd.specificBuilding);
        if (sd.typeOfBuilding) setTypeOfBuilding(sd.typeOfBuilding);
        // Deliverables
        if (sd.interiorCadElevations) setInteriorCadElevations(sd.interiorCadElevations);
        if (sd.bimDeliverable) setBimDeliverable(sd.bimDeliverable);
        if (sd.bimDeliverableOther) setBimDeliverableOther(sd.bimDeliverableOther);
        if (sd.bimVersion) setBimVersion(sd.bimVersion);
        if (sd.customTemplate) setCustomTemplate(sd.customTemplate);
        if (sd.customTemplateOther) setCustomTemplateOther(sd.customTemplateOther);
        // ACT Ceiling
        if (sd.aboveBelowACT) setAboveBelowACT(sd.aboveBelowACT);
        if (sd.aboveBelowACTOther) setAboveBelowACTOther(sd.aboveBelowACTOther);
        if (sd.actSqft) setActSqft(sd.actSqft);
        // Internal Notes
        if (sd.sqftAssumptions) setSqftAssumptions(sd.sqftAssumptions);
        if (sd.assumedGrossMargin) setAssumedGrossMargin(sd.assumedGrossMargin);
        if (sd.caveatsProfitability) setCaveatsProfitability(sd.caveatsProfitability);
        if (sd.mixedScope) setMixedScope(sd.mixedScope);
        if (sd.insuranceRequirements) setInsuranceRequirements(sd.insuranceRequirements);
        // Contacts
        if (sd.accountContact) setAccountContact(sd.accountContact);
        if (sd.accountContactEmail) setAccountContactEmail(sd.accountContactEmail);
        if (sd.accountContactPhone) setAccountContactPhone(sd.accountContactPhone);
        if (sd.designProContact) setDesignProContact(sd.designProContact);
        if (sd.designProCompanyContact) setDesignProCompanyContact(sd.designProCompanyContact);
        if (sd.otherContact) setOtherContact(sd.otherContact);
        if (sd.proofLinks) setProofLinks(sd.proofLinks);
        // Timeline (CRM fields like source, probability are managed in DealWorkspace)
        if (sd.estimatedTimeline) setEstimatedTimeline(sd.estimatedTimeline);
        if (sd.timelineNotes) setTimelineNotes(sd.timelineNotes);
      }
    }
  }, [existingQuote]);

  // Auto-calculate distance when quote loads with missing distance but has project address
  useEffect(() => {
    // Dispatch location addresses (supports both uppercase and lowercase keys)
    const dispatchAddresses: Record<string, string> = {
      woodstock: "3272 Rt 212, Bearsville, NY 12409",
      brooklyn: "176 Borinquen Place, Brooklyn, NY 11211",
      troy: "188 1st St, Troy, NY 12180",
    };

    // Only run if we have a lead with address, travel dispatch but no distance
    if (!lead?.projectAddress) return;
    // Case-insensitive fly_out check for backwards compatibility
    if (!travel?.dispatchLocation || isDispatchLocation(travel.dispatchLocation, "fly_out")) return;
    if (travel.distance && travel.distance > 0) return;
    if (isCalculatingDistance) return;

    const calculateMissingDistance = async () => {
      // Normalize to lowercase for lookup
      const normalizedLocation = normalizeDispatchLocation(travel.dispatchLocation);
      const originAddress = dispatchAddresses[normalizedLocation];
      if (!originAddress) return;

      setIsCalculatingDistance(true);
      try {
        const response = await apiRequest("POST", "/api/travel/calculate", {
          destination: lead.projectAddress,
          origin: originAddress,
        });

        const distanceResult = await response.json() as { distanceMiles?: number; durationText?: string };
        if (distanceResult.distanceMiles) {
          setTravel({
            dispatchLocation: travel.dispatchLocation,
            distance: Math.round(distanceResult.distanceMiles),
          });
        }
      } catch (error) {
        // Silently fail - user can enter manually
        console.debug("[CPQ] Auto distance calculation failed:", error);
      } finally {
        setIsCalculatingDistance(false);
      }
    };

    calculateMissingDistance();
  }, [lead?.projectAddress, travel?.dispatchLocation, travel?.distance, isCalculatingDistance]);

  // PostMessage listener for CRM integration - receive CPQ_SCOPING_PAYLOAD
  useEffect(() => {
    // Allowed origins for postMessage security
    const ALLOWED_ORIGINS = [
      window.location.origin,
      "https://scan2plan.io",
      "https://www.scan2plan.io",
      "https://app.gohighlevel.com",
      "https://scan2planos.com",
      "https://crm.scan2plan.io",
    ];

    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      if (!ALLOWED_ORIGINS.includes(event.origin)) {
        console.warn("[CPQ] Blocked postMessage from untrusted origin:", event.origin);
        return;
      }

      // Validate message type
      if (event.data?.type !== "CPQ_SCOPING_PAYLOAD") return;

      console.log("[CPQ] Received scoping payload from CRM:", event.data);
      const payload = event.data.payload;
      if (!payload || typeof payload !== "object") return;

      // Populate scoping fields from CRM payload
      if (payload.specificBuilding) setSpecificBuilding(payload.specificBuilding);
      if (payload.typeOfBuilding) setTypeOfBuilding(payload.typeOfBuilding);
      if (payload.interiorCadElevations) setInteriorCadElevations(payload.interiorCadElevations);
      if (payload.bimDeliverable) setBimDeliverable(payload.bimDeliverable);
      if (payload.bimDeliverableOther) setBimDeliverableOther(payload.bimDeliverableOther);
      if (payload.bimVersion) setBimVersion(payload.bimVersion);
      if (payload.customTemplate) setCustomTemplate(payload.customTemplate);
      if (payload.customTemplateOther) setCustomTemplateOther(payload.customTemplateOther);
      if (payload.aboveBelowACT) setAboveBelowACT(payload.aboveBelowACT);
      if (payload.aboveBelowACTOther) setAboveBelowACTOther(payload.aboveBelowACTOther);
      if (payload.actSqft) setActSqft(payload.actSqft);
      if (payload.sqftAssumptions) setSqftAssumptions(payload.sqftAssumptions);
      if (payload.assumedGrossMargin) setAssumedGrossMargin(payload.assumedGrossMargin);
      if (payload.caveatsProfitability) setCaveatsProfitability(payload.caveatsProfitability);
      if (payload.mixedScope) setMixedScope(payload.mixedScope);
      if (payload.insuranceRequirements) setInsuranceRequirements(payload.insuranceRequirements);
      if (payload.accountContact) setAccountContact(payload.accountContact);
      if (payload.accountContactEmail) setAccountContactEmail(payload.accountContactEmail);
      if (payload.accountContactPhone) setAccountContactPhone(payload.accountContactPhone);
      if (payload.designProContact) setDesignProContact(payload.designProContact);
      if (payload.designProCompanyContact) setDesignProCompanyContact(payload.designProCompanyContact);
      if (payload.otherContact) setOtherContact(payload.otherContact);
      if (payload.proofLinks) setProofLinks(payload.proofLinks);
      // CRM fields (source, probability, projectStatus) are managed in DealWorkspace
      if (payload.estimatedTimeline) setEstimatedTimeline(payload.estimatedTimeline);
      if (payload.timelineNotes) setTimelineNotes(payload.timelineNotes);

      // Handle areas if provided
      if (payload.areas && Array.isArray(payload.areas)) {
        setAreas(payload.areas);
      }

      // Handle travel if provided
      if (payload.travel) {
        setTravel(payload.travel);
      }

      toast({
        title: "Scoping data received",
        description: "Project details have been populated from CRM.",
      });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast]);

  // Dispatch location addresses for distance calculation (lowercase keys)
  const DISPATCH_LOCATIONS: Record<string, string> = {
    woodstock: "3272 Rt 212, Bearsville, NY 12409",
    brooklyn: "176 Borinquen Place, Brooklyn, NY 11211",
    troy: "188 1st St, Troy, NY 12180",
  };

  // Calculate distance when dispatch location changes
  const handleDispatchLocationChange = async (locationCode: string) => {
    // For fly-out jobs, distance doesn't apply - set to 0 (case-insensitive check)
    if (isDispatchLocation(locationCode, "fly_out")) {
      setTravel({ dispatchLocation: locationCode, distance: 0 });
      toast({
        title: "Fly-out selected",
        description: "Travel costs will be calculated based on flight/lodging expenses.",
      });
      return;
    }

    setTravel({ dispatchLocation: locationCode, distance: travel?.distance || 0 });

    // Only calculate if we have a project address
    if (!lead?.projectAddress) {
      return;
    }

    // Normalize to lowercase for address lookup
    const normalizedCode = normalizeDispatchLocation(locationCode);
    const originAddress = DISPATCH_LOCATIONS[normalizedCode];
    if (!originAddress) return;

    setIsCalculatingDistance(true);
    try {
      const response = await apiRequest("POST", "/api/travel/calculate", {
        destination: lead.projectAddress,
        origin: originAddress,
      });

      const distanceResult = await response.json() as { distanceMiles?: number; durationText?: string; message?: string };
      if (distanceResult.distanceMiles) {
        setTravel({
          dispatchLocation: locationCode,
          distance: Math.round(distanceResult.distanceMiles),
        });
        toast({
          title: "Distance calculated",
          description: `${Math.round(distanceResult.distanceMiles)} miles from ${locationCode} (${distanceResult.durationText || ""})`,
        });
      } else if (distanceResult.message) {
        toast({
          title: "Distance not available",
          description: distanceResult.message + ". You can enter distance manually.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Failed to calculate distance:", error);
      toast({
        title: "Distance calculation failed",
        description: error?.message?.includes("400")
          ? "Could not find a route. Please enter the distance manually."
          : "Could not calculate distance. You can enter it manually.",
        variant: "destructive",
      });
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Calculate base pricing in real-time (before adjustment)
  const basePricing: PricingResult = useMemo(() => {
    return calculatePricing(areas, services, travel, risks, paymentTerms, marginTarget);
  }, [areas, services, travel, risks, paymentTerms, marginTarget, auditCounter]);

  // Calculate adjusted pricing with markup percentage
  const pricing: PricingResult = useMemo(() => {
    if (priceAdjustmentPercent === 0) return basePricing;

    const adjustmentAmount = Math.round(basePricing.totalClientPrice * (priceAdjustmentPercent / 100) * 100) / 100;
    const adjustedTotal = Math.round((basePricing.totalClientPrice + adjustmentAmount) * 100) / 100;
    const adjustedProfit = Math.round((adjustedTotal - basePricing.totalUpteamCost) * 100) / 100;

    // Add adjustment as a visible line item
    const adjustmentLineItem = {
      label: `Price Adjustment (+${priceAdjustmentPercent}%)`,
      value: adjustmentAmount,
      upteamCost: 0, // Adjustment is pure margin
    };

    return {
      ...basePricing,
      items: [...basePricing.items, adjustmentLineItem],
      subtotal: Math.round((basePricing.subtotal + adjustmentAmount) * 100) / 100,
      totalClientPrice: adjustedTotal,
      profitMargin: adjustedProfit,
    };
  }, [basePricing, priceAdjustmentPercent]);

  // Calculate margin status for GM Hard Gate
  // In Tier A mode, use Tier A pricing for margin gate check
  const marginPercent = useMemo(() => {
    if (isTierA && tierAPricingResult && tierAPricingResult.clientPrice > 0) {
      // Tier A margin: (clientPrice - subtotal) / clientPrice * 100
      return ((tierAPricingResult.clientPrice - tierAPricingResult.subtotal) / tierAPricingResult.clientPrice) * 100;
    }
    return calculateMarginPercent(pricing);
  }, [pricing, isTierA, tierAPricingResult]);

  const marginGateError = useMemo(() => {
    if (isTierA && tierAPricingResult && tierAPricingResult.clientPrice > 0) {
      const tierAMarginPercent = ((tierAPricingResult.clientPrice - tierAPricingResult.subtotal) / tierAPricingResult.clientPrice) * 100;
      if (tierAMarginPercent >= FY26_GOALS.MARGIN_FLOOR * 100) return null;
      return `Margin below ${(FY26_GOALS.MARGIN_FLOOR * 100).toFixed(0)}% Governance Gate.`;
    }
    return getMarginGateError(pricing);
  }, [pricing, isTierA, tierAPricingResult]);

  const isMarginBelowGate = useMemo(() => {
    if (isTierA && tierAPricingResult && tierAPricingResult.clientPrice > 0) {
      // Tier A: check if margin >= 40%
      const tierAMarginPercent = ((tierAPricingResult.clientPrice - tierAPricingResult.subtotal) / tierAPricingResult.clientPrice) * 100;
      return tierAMarginPercent < FY26_GOALS.MARGIN_FLOOR * 100;
    }
    return !passesMarginGate(pricing);
  }, [pricing, isTierA, tierAPricingResult]);

  // Calculate the minimum adjustment needed to reach 40% margin
  const requiredAdjustmentPercent = useMemo(() => {
    if (!isMarginBelowGate || priceAdjustmentPercent > 0) return 0;
    // To achieve 40% margin: (price - cost) / price = 0.4
    // price = cost / 0.6
    const targetPrice = basePricing.totalUpteamCost / (1 - FY26_GOALS.MARGIN_FLOOR);
    const requiredIncrease = ((targetPrice / basePricing.totalClientPrice) - 1) * 100;
    return Math.ceil(requiredIncrease * 10) / 10; // Round up to 1 decimal place
  }, [basePricing, isMarginBelowGate, priceAdjustmentPercent]);

  // Preview travel cost based on current settings
  const travelCostPreview = useMemo(() => {
    // Case-insensitive fly_out check for backwards compatibility
    if (!travel || isDispatchLocation(travel.dispatchLocation, "fly_out")) return null;
    if (customTravelCost && !isNaN(parseFloat(customTravelCost))) {
      return { cost: parseFloat(customTravelCost), isCustom: true };
    }
    const projectTotalSqft = calculateTotalSqft(areas);
    const cost = calculateTravelCost(
      travel.distance || 0,
      travel.dispatchLocation,
      projectTotalSqft
    );
    return { cost, isCustom: false };
  }, [travel, customTravelCost, areas]);

  // RFI (Request for Information) detection - "I don't know" selections
  const rfiFields = useMemo(() => {
    const fields: { key: string; label: string; question: string }[] = [];

    if (actScanning === "ask_client") {
      fields.push({
        key: "actScanning",
        label: "Acoustic Ceiling Tile Scanning",
        question: "Do you need scanning above and below acoustic ceiling tiles, or just the finished ceiling surface?",
      });
    }
    if (scanningOnly === "ask_client") {
      fields.push({
        key: "scanningOnly",
        label: "Scanning & Registration Scope",
        question: "Do you need just raw point cloud data (Scanning & Registration Only), or full Scan-to-BIM modeling?",
      });
    }
    if (siteStatus === "ask_client") {
      fields.push({
        key: "siteStatus",
        label: "Site Status",
        question: "Is the site currently vacant, occupied, or under construction?",
      });
    }
    if (mepScope === "ask_client") {
      fields.push({
        key: "mepScope",
        label: "MEP Scope",
        question: "Do you need MEP (Mechanical/Electrical/Plumbing) modeled, or just the architecture?",
      });
    }

    return fields;
  }, [actScanning, scanningOnly, siteStatus, mepScope]);

  const hasRfiItems = rfiFields.length > 0;

  // Calculate what services are included in the quote
  const includedServices = useMemo(() => {
    const items: { name: string; testId: string }[] = [];

    // Check disciplines across all areas
    const allDisciplines = new Set<string>();
    areas.forEach((area) => {
      area.disciplines.forEach((d) => allDisciplines.add(d));
    });

    // Map discipline IDs to human-readable names
    const disciplineLabels: Record<string, string> = {
      architecture: "Architecture Modeling",
      mepf: "MEP Modeling",
      structure: "Structural Modeling",
      site: "Site Modeling",
    };

    // Add discipline items
    if (allDisciplines.has("architecture")) {
      items.push({ name: "Architecture Modeling", testId: "service-included-architecture" });
    }
    if (allDisciplines.has("mepf")) {
      items.push({ name: "MEP Modeling", testId: "service-included-mep" });
    }
    if (allDisciplines.has("structure")) {
      items.push({ name: "Structural Modeling", testId: "service-included-structure" });
    }
    if (allDisciplines.has("site")) {
      items.push({ name: "Site Modeling", testId: "service-included-site" });
    }

    // Check for CAD deliverables - either through includeCadDeliverable or bimDeliverable
    const hasCadDeliverable = areas.some((area) => area.includeCadDeliverable) ||
      bimDeliverable.length > 0 ||
      interiorCadElevations;
    if (hasCadDeliverable) {
      items.push({ name: "CAD Deliverables", testId: "service-included-cad" });
    }

    // Check ACT Scanning
    if (actScanning === "yes") {
      items.push({ name: "ACT Scanning (Above & Below Ceiling)", testId: "service-included-act" });
    }

    // Check Scanning Only modes
    if (scanningOnly === "full_day") {
      items.push({ name: "Scanning & Registration - Full Day", testId: "service-included-scanning-full" });
    } else if (scanningOnly === "half_day") {
      items.push({ name: "Scanning & Registration - Half Day", testId: "service-included-scanning-half" });
    }

    // Check additional services
    const serviceLabels: Record<string, string> = {
      matterport: "Matterport Capture",
      georeferencing: "Georeferencing",
      scanningFullDay: "Scanning - Full Day",
      scanningHalfDay: "Scanning - Half Day",
    };

    Object.entries(services).forEach(([serviceId, value]) => {
      if (value && value > 0) {
        const label = serviceLabels[serviceId] || serviceId;
        items.push({
          name: label,
          testId: `service-included-${serviceId.toLowerCase()}`
        });
      }
    });

    return items;
  }, [areas, bimDeliverable, interiorCadElevations, actScanning, scanningOnly, services]);

  // Generate RFI email body
  const rfiEmailBody = useMemo(() => {
    if (!hasRfiItems) return "";

    const leadName = lead?.contactName || "[Client Name]";
    const projectName = lead?.projectName || "your project";

    return `Hi ${leadName},

I'm working on your quote for the ${projectName} scanning project. To ensure we give you the most accurate price, could you clarify a few details?

${rfiFields.map((field) => `- ${field.question}`).join("\n")}

Once I have these details, I'll finalize your quote right away.

Thanks!`.trim();
  }, [hasRfiItems, rfiFields, lead]);

  const canSaveQuote = !isMarginBelowGate && !hasRfiItems;

  // Save quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async () => {
      // GM HARD GATE CHECK - Block proposal generation if margin < 40%
      if (marginGateError) {
        throw new Error(marginGateError);
      }

      // Safely build travel data with custom cost
      // Convert dispatch location to uppercase for persistence (legacy format for downstream systems)
      let travelData = travel ? {
        ...travel,
        dispatchLocation: toUppercaseDispatchLocation(travel.dispatchLocation),
      } : null;
      if (customTravelCost) {
        const customCost = parseFloat(customTravelCost);
        if (!isNaN(customCost)) {
          travelData = travelData
            ? { ...travelData, customCost }
            : { dispatchLocation: "WOODSTOCK", distance: 0, customCost };
        }
      }

      // Ensure areas have kind field for backwards compatibility
      const areasWithKind = areas.map(area => ({
        ...area,
        kind: area.kind || (isLandscapeBuildingType(area.buildingType) ? "landscape" : "standard"),
      }));

      // Enrich areas with product SKUs for QuickBooks sync
      const areasWithProducts = await Promise.all(
        areasWithKind.map(area => enrichAreaWithProducts(area))
      );

      // Generate complete SKU manifest for quote
      const lineItemSkus = await generateQuoteSkus({
        areas: areasWithKind,
        services,
        risks,
        paymentTerms
      });

      // Parse Tier A costs - use "other" input value when "other" is selected
      const parseTierACost = (val: string) => {
        if (!val) return null;
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
      };

      // Get effective Tier A scanning cost (use "other" input if "other" selected)
      const effectiveTierAScanningCost = tierAScanningCost === "other"
        ? tierAScanningCostOther
        : tierAScanningCost;

      const quoteData = {
        leadId: leadId || null,
        areas: areasWithProducts, // Use enriched areas with SKU data
        services,
        travel: travelData,
        risks,
        paymentTerms,
        notes: projectNotes,
        totalClientPrice: pricing.totalClientPrice.toString(),
        totalUpteamCost: pricing.totalUpteamCost.toString(),
        status: "draft" as const,
        // Additional fields
        buildingFeatures: { hasBasement, hasAttic },
        actScanning,
        actScanningNotes,
        scanningOnly,
        siteStatus,
        mepScope,
        internalCosts: {
          tierAScanningCost: parseTierACost(effectiveTierAScanningCost),
          tierAModelingCost: parseTierACost(tierAModelingCost),
          assumedMargin,
          profitabilityCaveats,
        },
        priceAdjustmentPercent: priceAdjustmentPercent > 0 ? priceAdjustmentPercent : null,
        // Full pricing result stored in pricingBreakdown field for QBO estimate sync
        pricingBreakdown: {
          items: pricing.items,
          subtotal: pricing.subtotal,
          totalClientPrice: pricing.totalClientPrice,
          totalUpteamCost: pricing.totalUpteamCost,
          profitMargin: pricing.profitMargin,
          disciplineTotals: pricing.disciplineTotals,
        },
        // SKU manifest for QuickBooks Service Item mapping
        lineItemSkus,
        // Scoping Data - All new fields
        scopingData: {
          // Project Details
          specificBuilding,
          typeOfBuilding,
          // Deliverables
          interiorCadElevations,
          bimDeliverable,
          bimDeliverableOther,
          bimVersion,
          customTemplate,
          customTemplateOther,
          // ACT Ceiling
          aboveBelowACT,
          aboveBelowACTOther,
          actSqft,
          // Internal Notes
          sqftAssumptions,
          assumedGrossMargin,
          caveatsProfitability,
          mixedScope,
          insuranceRequirements,
          // Contacts
          accountContact,
          accountContactEmail,
          accountContactPhone,
          designProContact,
          designProCompanyContact,
          otherContact,
          proofLinks,
          // Timeline (CRM fields managed in DealWorkspace)
          estimatedTimeline,
          timelineNotes,
        },
      };

      if (quoteId) {
        return apiRequest("PATCH", `/api/cpq/quotes/${quoteId}`, quoteData);
      } else if (leadId) {
        return apiRequest("POST", `/api/leads/${leadId}/cpq-quotes`, quoteData);
      } else {
        return apiRequest("POST", "/api/cpq/quotes", quoteData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Quote saved",
        description: "Your quote has been saved successfully.",
      });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      }
    },
    onError: (error: Error) => {
      console.error("[CPQ Save Error]", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate client magic link mutation
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);

  const generateLinkMutation = useMutation({
    mutationFn: async (savedQuoteId: number) => {
      const response = await apiRequest("POST", `/api/cpq-quotes/${savedQuoteId}/generate-link`, {});
      return response.json();
    },
    onSuccess: (data: { token: string; link: string; expiresAt: string }) => {
      const fullLink = `${window.location.origin}${data.link}`;
      setGeneratedLink(fullLink);
      setLinkExpiresAt(data.expiresAt);
      navigator.clipboard.writeText(fullLink);
      toast({
        title: "Link copied!",
        description: "Magic link has been copied to clipboard. Valid for 7 days.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate link",
        variant: "destructive",
      });
    },
  });

  // Save quote with RFI fields and generate link
  const saveAndGenerateLinkMutation = useMutation({
    mutationFn: async () => {
      // Build quote data with RFI fields
      // Convert dispatch location to uppercase for persistence (legacy format)
      let travelData = travel ? {
        ...travel,
        dispatchLocation: toUppercaseDispatchLocation(travel.dispatchLocation),
      } : null;
      if (customTravelCost && !isNaN(parseFloat(customTravelCost))) {
        travelData = travelData
          ? { ...travelData, customCost: parseFloat(customTravelCost) }
          : { dispatchLocation: "WOODSTOCK", distance: 0, customCost: parseFloat(customTravelCost) };
      }

      // Ensure areas have kind field for backwards compatibility
      const areasWithKind = areas.map(area => ({
        ...area,
        kind: area.kind || (isLandscapeBuildingType(area.buildingType) ? "landscape" : "standard"),
      }));

      // Enrich areas with product SKUs for QuickBooks sync
      const areasWithProducts = await Promise.all(
        areasWithKind.map(area => enrichAreaWithProducts(area))
      );

      // Generate complete SKU manifest for quote
      const lineItemSkus = await generateQuoteSkus({
        areas: areasWithKind,
        services,
        risks,
        paymentTerms
      });

      const quoteData = {
        leadId: leadId || null,
        areas: areasWithProducts, // Use enriched areas with SKU data
        services,
        travel: travelData,
        risks,
        paymentTerms,
        notes: projectNotes,
        totalClientPrice: pricing.totalClientPrice.toString(),
        totalUpteamCost: pricing.totalUpteamCost.toString(),
        status: "draft" as const,
        buildingFeatures: { hasBasement, hasAttic },
        actScanning,
        actScanningNotes,
        scanningOnly,
        siteStatus,
        mepScope,
        priceAdjustmentPercent: priceAdjustmentPercent > 0 ? priceAdjustmentPercent : null,
        pricingBreakdown: {
          items: pricing.items,
          subtotal: pricing.subtotal,
          totalClientPrice: pricing.totalClientPrice,
          totalUpteamCost: pricing.totalUpteamCost,
          profitMargin: pricing.profitMargin,
          disciplineTotals: pricing.disciplineTotals,
        },
        // SKU manifest for QuickBooks Service Item mapping
        lineItemSkus,
        // Scoping Data - All new fields
        scopingData: {
          specificBuilding,
          typeOfBuilding,
          interiorCadElevations,
          bimDeliverable,
          bimDeliverableOther,
          bimVersion,
          customTemplate,
          customTemplateOther,
          aboveBelowACT,
          aboveBelowACTOther,
          actSqft,
          sqftAssumptions,
          assumedGrossMargin,
          caveatsProfitability,
          mixedScope,
          insuranceRequirements,
          accountContact,
          accountContactEmail,
          accountContactPhone,
          designProContact,
          designProCompanyContact,
          otherContact,
          proofLinks,
          // Timeline (CRM fields managed in DealWorkspace)
          estimatedTimeline,
          timelineNotes,
        },
      };

      let savedQuote;
      if (quoteId) {
        savedQuote = await apiRequest("PATCH", `/api/cpq/quotes/${quoteId}`, quoteData);
      } else if (leadId) {
        savedQuote = await apiRequest("POST", `/api/leads/${leadId}/cpq-quotes`, quoteData);
      } else {
        savedQuote = await apiRequest("POST", "/api/cpq/quotes", quoteData);
      }

      const quoteResult = await savedQuote.json();
      return quoteResult;
    },
    onSuccess: (savedQuote) => {
      // Now generate the link for the saved quote
      generateLinkMutation.mutate(savedQuote.id);
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving quote",
        description: error.message || "Failed to save quote for link generation",
        variant: "destructive",
      });
    },
  });

  // Area management
  // Add a new area - isLandscape determines if building type 14 (landscape) is used
  const addArea = (isLandscape: boolean = false) => {
    const newId = Date.now().toString();
    // Landscape uses buildingType "14" (Landscape - Site/Civil)
    const buildingType = isLandscape ? "14" : "1";
    setAreas([
      ...areas,
      {
        id: newId,
        name: isLandscape ? `Landscape ${landscapeAreas.length + 1}` : `Area ${standardAreas.length + 1}`,
        buildingType,
        squareFeet: "",
        lod: "200",
        disciplines: isLandscape ? ["site"] : ["architecture"],
        scope: "full",
        // Keep kind field for backwards compatibility with downstream consumers
        kind: isLandscape ? "landscape" : "standard",
      },
    ]);
  };

  const removeArea = (id: string) => {
    if (areas.length > 1) {
      setAreas(areas.filter((a) => a.id !== id));
    }
  };

  const updateArea = (id: string, field: keyof Area, value: any) => {
    setAreas(areas.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const toggleDiscipline = (areaId: string, discipline: string) => {
    setAreas(
      areas.map((a) => {
        if (a.id !== areaId) return a;
        const current = a.disciplines || [];
        if (current.includes(discipline)) {
          return { ...a, disciplines: current.filter((d) => d !== discipline) };
        } else {
          return { ...a, disciplines: [...current, discipline] };
        }
      })
    );
  };

  const toggleRisk = (riskId: string) => {
    if (risks.includes(riskId)) {
      setRisks(risks.filter((r) => r !== riskId));
    } else {
      setRisks([...risks, riskId]);
    }
  };

  const updateService = (serviceId: string, quantity: number) => {
    setServices({ ...services, [serviceId]: quantity });
  };

  // Update boundary for a landscape area and auto-set acres from calculated area
  const updateAreaBoundary = useCallback((areaId: string, boundary: BoundaryCoordinate[], calculatedAcres: number, boundaryImageUrl: string) => {
    setAreas(areas.map(a => {
      if (a.id !== areaId) return a;
      return {
        ...a,
        boundary,
        boundaryImageUrl,
        squareFeet: calculatedAcres.toFixed(2), // Store acres in squareFeet field for landscape areas
      };
    }));
    setBoundaryDrawerAreaId(null);
  }, [areas]);

  // Get the area being edited for boundary drawing
  const boundaryDrawerArea = boundaryDrawerAreaId
    ? areas.find(a => a.id === boundaryDrawerAreaId)
    : null;

  // Fetch project coordinates for boundary drawing
  const locationPreviewUrl = lead?.projectAddress
    ? `/api/location/preview?address=${encodeURIComponent(lead.projectAddress)}`
    : null;

  const { data: locationData } = useQuery<{ coordinates?: { lat: number; lng: number } }>({
    queryKey: [locationPreviewUrl],
    enabled: !!locationPreviewUrl,
  });

  // Get project coordinates from location preview
  const projectCoordinates = locationData?.coordinates || null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-calculator">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <CalculatorIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">
              {quoteId ? "Edit Quote" : "New Quote"}
              {lead && ` - ${lead.clientName}`}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isMarginBelowGate && (
            <Badge variant="destructive" className="text-xs" data-testid="badge-margin-gate-warning">
              Margin below 40% gate
            </Badge>
          )}
          {hasCustomizedPricing && (
            <Badge variant="secondary" className="text-xs">
              ✏️ Customized
            </Badge>
          )}
          <Button
            onClick={async () => {
              const editableItems = generateEditableLineItems(pricing, await generateQuoteSkus({ areas, services, risks, paymentTerms }));
              setCustomLineItems(editableItems);
              setShowLineItemEditor(true);
            }}
            variant="outline"
            disabled={!pricing || pricing.items.length === 0}
            data-testid="button-customize-line-items"
          >
            <PenTool className="h-4 w-4 mr-2" />
            Customize Line Items
          </Button>
          <Button
            onClick={() => saveQuoteMutation.mutate()}
            disabled={saveQuoteMutation.isPending || !canSaveQuote}
            data-testid="button-save-quote"
            title={hasRfiItems ? "Answer all 'I don't know' items before saving" : isMarginBelowGate ? "Adjust pricing to meet 40% minimum margin" : undefined}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveQuoteMutation.isPending ? "Saving..." : "Save Quote"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Form */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 max-w-3xl">
            {/* Pricing Mode Toggle - Tier A option */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-medium">Pricing Mode</h2>
                <Badge variant={qualifiesForTierA ? "default" : "secondary"} data-testid="badge-total-sqft">
                  {totalSqft.toLocaleString()} sqft total
                  {qualifiesForTierA && !isTierA && (
                    <span className="ml-1 text-xs">(Tier A eligible)</span>
                  )}
                </Badge>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={pricingMode !== "tierA" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPricingMode("standard")}
                  data-testid="button-mode-standard"
                >
                  <Building2 className="h-4 w-4 mr-1" />
                  Areas
                  {areas.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{areas.length}</Badge>
                  )}
                </Button>
                <Button
                  variant={pricingMode === "tierA" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPricingMode("tierA")}
                  data-testid="button-mode-tier-a"
                  className={qualifiesForTierA && pricingMode !== "tierA" ? "border-primary" : ""}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Tier A Pricing
                  {qualifiesForTierA && pricingMode !== "tierA" && (
                    <Badge variant="destructive" className="ml-2">Suggested</Badge>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Combined Areas Section (Building + Landscape) */}
            {pricingMode !== "tierA" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-lg font-medium flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Project Areas
                  </h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => addArea(false)} data-testid="button-add-standard-area">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Building
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => addArea(true)} data-testid="button-add-landscape-area">
                      <Plus className="h-4 w-4 mr-1" />
                      <MapPin className="h-4 w-4 mr-1" />
                      Add Landscape
                    </Button>
                  </div>
                </div>

                {areas.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No project areas added yet.</p>
                      <p className="text-sm mt-1">Add buildings (sqft) or landscape areas (acres).</p>
                      <div className="flex gap-2 justify-center mt-4">
                        <Button variant="outline" size="sm" onClick={() => addArea(false)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Building
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => addArea(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Landscape
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {areas.map((area, index) => {
                  // Calculate type-specific index for test IDs - uses buildingType to determine landscape
                  const isLandscape = isLandscapeBuildingType(area.buildingType);
                  const kindIndex = areas.slice(0, index).filter(a => isLandscapeBuildingType(a.buildingType) === isLandscape).length;

                  return (
                    <Card key={area.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={area.name}
                              onChange={(e) => updateArea(area.id, "name", e.target.value)}
                              className="font-medium max-w-[200px]"
                              data-testid={isLandscape ? `input-landscape-name-${kindIndex}` : `input-area-name-${kindIndex}`}
                            />
                            <Badge variant={isLandscape ? "secondary" : "outline"}>
                              {isLandscape ? (
                                <><MapPin className="h-3 w-3 mr-1" />Landscape</>
                              ) : (
                                <><Building2 className="h-3 w-3 mr-1" />Building</>
                              )}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeArea(area.id)}
                            data-testid={isLandscape ? `button-remove-landscape-${kindIndex}` : `button-remove-area-${kindIndex}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Building-specific fields */}
                        {!isLandscape && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Building Type</Label>
                                <Select
                                  value={area.buildingType}
                                  onValueChange={(v) => updateArea(area.id, "buildingType", v)}
                                >
                                  <SelectTrigger data-testid={`select-building-type-${kindIndex}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {BUILDING_TYPES.filter(bt => bt.id !== "14" && bt.id !== "15").map((bt) => (
                                      <SelectItem key={bt.id} value={bt.id}>
                                        {bt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Square Footage</Label>
                                <Input
                                  type="number"
                                  value={area.squareFeet}
                                  onChange={(e) => updateArea(area.id, "squareFeet", e.target.value)}
                                  placeholder="e.g., 50000"
                                  data-testid={`input-sqft-${kindIndex}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Level of Detail</Label>
                                <Select value={area.lod} onValueChange={(v) => updateArea(area.id, "lod", v)}>
                                  <SelectTrigger data-testid={`select-lod-${kindIndex}`}>
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
                              <div className="space-y-2">
                                <Label>Scope</Label>
                                <Select
                                  value={area.scope || "full"}
                                  onValueChange={(v) => updateArea(area.id, "scope", v)}
                                >
                                  <SelectTrigger data-testid={`select-scope-${kindIndex}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SCOPE_OPTIONS.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Mixed LOD option - appears for Full scope only */}
                            {(area.scope === "full" || !area.scope) && (
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground" data-testid={`toggle-mixed-lod-${kindIndex}`}>
                                    <span className="text-sm">Mixed LOD (Int/Ext)</span>
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-2">
                                  <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/50">
                                    <div className="space-y-2">
                                      <Label className="text-xs">Interior LOD</Label>
                                      <Select
                                        value={area.mixedInteriorLod || area.lod || "200"}
                                        onValueChange={(v) => updateArea(area.id, "mixedInteriorLod", v)}
                                      >
                                        <SelectTrigger data-testid={`select-interior-lod-${kindIndex}`}>
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
                                    <div className="space-y-2">
                                      <Label className="text-xs">Exterior LOD</Label>
                                      <Select
                                        value={area.mixedExteriorLod || area.lod || "200"}
                                        onValueChange={(v) => updateArea(area.id, "mixedExteriorLod", v)}
                                      >
                                        <SelectTrigger data-testid={`select-exterior-lod-${kindIndex}`}>
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
                                    <p className="col-span-2 text-xs text-muted-foreground">
                                      Set different LODs for interior (65%) and exterior (35%) portions
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            <div className="space-y-2">
                              <Label>Disciplines</Label>
                              <div className="flex flex-wrap gap-2">
                                {DISCIPLINES.map((d) => (
                                  <Badge
                                    key={d.id}
                                    variant={area.disciplines?.includes(d.id) ? "default" : "outline"}
                                    className="cursor-pointer toggle-elevate"
                                    onClick={() => toggleDiscipline(area.id, d.id)}
                                    data-testid={`badge-discipline-${d.id}-${kindIndex}`}
                                  >
                                    {d.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`cad-${area.id}`}
                                checked={area.includeCadDeliverable || false}
                                onCheckedChange={(checked) =>
                                  updateArea(area.id, "includeCadDeliverable", checked)
                                }
                                data-testid={`checkbox-cad-${kindIndex}`}
                              />
                              <Label htmlFor={`cad-${area.id}`} className="text-sm">
                                Include CAD Deliverable
                              </Label>
                            </div>
                          </>
                        )}

                        {/* Landscape-specific fields */}
                        {isLandscape && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Landscape Type</Label>
                                <Select
                                  value={area.buildingType}
                                  onValueChange={(v) => updateArea(area.id, "buildingType", v)}
                                >
                                  <SelectTrigger data-testid={`select-landscape-type-${kindIndex}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LANDSCAPE_TYPES.map((lt) => (
                                      <SelectItem key={lt.id} value={lt.id}>
                                        {lt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Acres</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={area.squareFeet}
                                  onChange={(e) => updateArea(area.id, "squareFeet", e.target.value)}
                                  placeholder="e.g., 5"
                                  data-testid={`input-acres-${kindIndex}`}
                                />
                                {area.squareFeet && (
                                  <p className="text-xs text-muted-foreground">
                                    = {getAreaSqft(area).toLocaleString()} sqft
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Boundary Preview and Controls */}
                            {area.boundaryImageUrl && area.boundary && area.boundary.length >= 3 && (
                              <div className="rounded-md overflow-hidden border bg-muted aspect-square max-w-sm mx-auto">
                                <img
                                  src={area.boundaryImageUrl}
                                  alt="Boundary preview"
                                  className="w-full h-full object-cover"
                                  data-testid={`img-boundary-preview-${kindIndex}`}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">Site Discipline</Badge>
                                <span className="text-xs text-muted-foreground">
                                  Landscape areas use site discipline only
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {area.boundary && area.boundary.length >= 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {area.boundary.length} points
                                  </Badge>
                                )}
                                {projectCoordinates && (
                                  <Button
                                    type="button"
                                    variant={area.boundary && area.boundary.length >= 3 ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setBoundaryDrawerAreaId(area.id)}
                                    data-testid={`button-draw-boundary-${kindIndex}`}
                                  >
                                    <PenTool className="w-3 h-3 mr-1" />
                                    {area.boundary && area.boundary.length >= 3 ? "Edit Boundary" : "Draw Boundary"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Tier A Pricing Section */}
            {pricingMode === "tierA" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Tier A Pricing
                  </h2>
                  <Badge variant="secondary">{totalSqft.toLocaleString()} sqft total</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Large project pricing methodology. Formula: (Scanning + Modeling) x Margin = Client Price
                </p>
                <Card className="border-primary/30">
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Scanning Cost</Label>
                        <Select
                          value={tierAScanningCost}
                          onValueChange={setTierAScanningCost}
                        >
                          <SelectTrigger data-testid="select-tier-a-scanning">
                            <SelectValue placeholder="Select cost" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3500">$3,500</SelectItem>
                            <SelectItem value="7000">$7,000</SelectItem>
                            <SelectItem value="10500">$10,500</SelectItem>
                            <SelectItem value="15000">$15,000</SelectItem>
                            <SelectItem value="18500">$18,500</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {tierAScanningCost === "other" && (
                          <Input
                            type="number"
                            value={tierAScanningCostOther}
                            onChange={(e) => setTierAScanningCostOther(e.target.value)}
                            placeholder="Enter custom cost"
                            data-testid="input-tier-a-scanning-other"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Modeling Cost</Label>
                        <Input
                          type="number"
                          value={tierAModelingCost}
                          onChange={(e) => setTierAModelingCost(e.target.value)}
                          placeholder="Enter modeling cost"
                          data-testid="input-tier-a-modeling"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Margin Multiplier</Label>
                      <Select
                        value={tierAMargin}
                        onValueChange={setTierAMargin}
                      >
                        <SelectTrigger data-testid="select-tier-a-margin">
                          <SelectValue placeholder="Select margin" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIER_A_MARGINS).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {tierAPricingResult && tierAPricingResult.clientPrice > 0 && (
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Scanning Cost:</span>
                            <span>${tierAPricingResult.scanningCost.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Modeling Cost:</span>
                            <span>${tierAPricingResult.modelingCost.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>${tierAPricingResult.subtotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Margin ({tierAPricingResult.marginLabel}):</span>
                            <span>x{tierAPricingResult.margin}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>Client Price:</span>
                            <span className="text-primary">${tierAPricingResult.clientPrice.toLocaleString()}</span>
                          </div>
                          {tierAPricingResult.travelCost > 0 && (
                            <>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Travel ($4/mi over 20mi):</span>
                                <span>+${tierAPricingResult.travelCost.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-bold text-lg">
                                <span>Total with Travel:</span>
                                <span className="text-primary">${tierAPricingResult.totalWithTravel.toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <Separator />

            {/* Travel Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Travel
                {(lead?.googleIntel as any)?.travelInsights?.available && (
                  <Badge variant="outline" className="text-xs font-normal ml-2">
                    via Google Maps
                  </Badge>
                )}
              </h2>
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dispatch Origin</Label>
                      <Select
                        value={normalizeDispatchLocation(travel?.dispatchLocation || "woodstock")}
                        onValueChange={handleDispatchLocationChange}
                        disabled={isCalculatingDistance}
                      >
                        <SelectTrigger data-testid="select-dispatch-location">
                          <SelectValue placeholder="Select dispatch origin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="woodstock">Woodstock (3272 Rt 212, Bearsville)</SelectItem>
                          <SelectItem value="brooklyn">Brooklyn (176 Borinquen Pl)</SelectItem>
                          <SelectItem value="troy">Troy (188 1st St)</SelectItem>
                          <SelectItem value="fly_out">Out of State (Fly-out)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!isDispatchLocation(travel?.dispatchLocation || "", "fly_out") && (
                      <div className="space-y-2">
                        <Label>Distance (miles)</Label>
                        <Input
                          type="number"
                          value={travel?.distance || ""}
                          onChange={(e) =>
                            setTravel({
                              dispatchLocation: travel?.dispatchLocation || "woodstock",
                              distance: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder={isCalculatingDistance ? "Calculating..." : "Auto-calculated"}
                          disabled={isCalculatingDistance}
                          data-testid="input-travel-distance"
                        />
                      </div>
                    )}
                    {isDispatchLocation(travel?.dispatchLocation || "", "fly_out") && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Travel Mode</Label>
                        <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/50">
                          <Plane className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Flight + Lodging</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>{isDispatchLocation(travel?.dispatchLocation || "", "fly_out") ? "Fly-out Travel Cost" : "Custom Travel Cost (optional)"}</Label>
                    <Input
                      type="number"
                      value={customTravelCost}
                      onChange={(e) => setCustomTravelCost(e.target.value)}
                      placeholder={isDispatchLocation(travel?.dispatchLocation || "", "fly_out") ? "Enter total flight + lodging cost" : "Leave empty to use calculated cost"}
                      data-testid="input-custom-travel-cost"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isDispatchLocation(travel?.dispatchLocation || "", "fly_out")
                        ? "Include airfare, lodging, rental car, and per diem"
                        : "Override the calculated mileage-based travel cost"
                      }
                    </p>
                  </div>
                  {travelCostPreview && (
                    <div className="p-3 bg-muted/50 rounded-md border" data-testid="travel-cost-preview">
                      <div className="flex justify-between items-center">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Calculated Travel Cost: </span>
                          <span className="font-semibold text-foreground">
                            ${travelCostPreview.cost.toLocaleString()}
                          </span>
                          {travelCostPreview.isCustom && (
                            <Badge variant="outline" className="ml-2 text-xs">Custom</Badge>
                          )}
                        </div>
                        {travel?.dispatchLocation?.toLowerCase().includes("brooklyn") && (travel?.distance || 0) > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {calculateTotalSqft(areas) >= 50000 ? "Tier A (No base)" :
                              calculateTotalSqft(areas) >= 10000 ? "Tier B ($300 base)" : "Tier C ($150 base)"}
                          </Badge>
                        )}
                      </div>
                      {!travelCostPreview.isCustom && travel?.distance === 0 && (
                        <p className="text-xs text-amber-600 mt-1">Enter distance to calculate travel cost</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Building Features */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Building Features</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-basement"
                    checked={hasBasement}
                    onCheckedChange={(checked) => setHasBasement(checked === true)}
                    data-testid="checkbox-has-basement"
                  />
                  <Label htmlFor="has-basement">Has Basement</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-attic"
                    checked={hasAttic}
                    onCheckedChange={(checked) => setHasAttic(checked === true)}
                    data-testid="checkbox-has-attic"
                  />
                  <Label htmlFor="has-attic">Has Attic</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Site Status */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Site Status</h2>
              <Select value={siteStatus} onValueChange={(v) => setSiteStatus(v as typeof siteStatus)}>
                <SelectTrigger data-testid="select-site-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="construction">Under Construction</SelectItem>
                  <SelectItem value="ask_client">I don't know (Ask Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* MEP Scope */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">MEP Scope</h2>
              <Select value={mepScope} onValueChange={(v) => setMepScope(v as typeof mepScope)}>
                <SelectTrigger data-testid="select-mep-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full MEP Modeling</SelectItem>
                  <SelectItem value="partial">Partial (Major systems only)</SelectItem>
                  <SelectItem value="none">Architecture Only (No MEP)</SelectItem>
                  <SelectItem value="ask_client">I don't know (Ask Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Acoustic Ceiling Tile Scanning */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Scanning Above & Below Acoustic Ceiling Tile?</h2>
              <Select value={actScanning} onValueChange={(v) => setActScanning(v as typeof actScanning)}>
                <SelectTrigger data-testid="select-act-scanning">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="ask_client">I don't know (Ask Client)</SelectItem>
                </SelectContent>
              </Select>
              {actScanning === "other" && (
                <Input
                  value={actScanningNotes}
                  onChange={(e) => setActScanningNotes(e.target.value)}
                  placeholder="Describe ACT scanning requirements..."
                  data-testid="input-act-notes"
                />
              )}
            </div>

            <Separator />

            {/* Scanning & Registration Only */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Scanning & Registration Only</h2>
              <Select value={scanningOnly} onValueChange={(v) => setScanningOnly(v as typeof scanningOnly)}>
                <SelectTrigger data-testid="select-scanning-only">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Full Scan-to-BIM)</SelectItem>
                  <SelectItem value="full_day">Full Day (up to 10 hrs on-site)</SelectItem>
                  <SelectItem value="half_day">Half Day (up to 4 hrs on-site)</SelectItem>
                  <SelectItem value="ask_client">I don't know (Ask Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Payment Terms */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Payment Terms</h2>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger data-testid="select-payment-terms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CPQ_PAYMENT_TERMS.filter(term => term !== "other").map((term) => (
                    <SelectItem key={term} value={term}>
                      {CPQ_PAYMENT_TERMS_DISPLAY[term]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Risk Factors */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Risk Factors</h2>
              <div className="flex flex-wrap gap-2">
                {RISK_FACTORS.map((risk) => (
                  <Badge
                    key={risk.id}
                    variant={risks.includes(risk.id) ? "destructive" : "outline"}
                    className="cursor-pointer toggle-elevate"
                    onClick={() => toggleRisk(risk.id)}
                    data-testid={`badge-risk-${risk.id}`}
                  >
                    {risk.label} (+{(risk.premium * 100).toFixed(0)}%)
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Additional Services */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Additional Services</h2>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(SERVICE_RATES).map(([id, service]) => (
                  <div key={id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <Label>{service.label}</Label>
                      <p className="text-xs text-muted-foreground">
                        ${service.rate}/{service.unit}
                      </p>
                    </div>
                    <Input
                      type="number"
                      value={services[id] || ""}
                      onChange={(e) => updateService(id, parseInt(e.target.value) || 0)}
                      className="w-20"
                      min="0"
                      data-testid={`input-service-${id}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Project Notes
              </h2>
              <textarea
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                className="w-full min-h-[100px] p-3 border rounded-md bg-background resize-y"
                placeholder="Add any notes about this project..."
                data-testid="textarea-project-notes"
              />
            </div>

            <Separator />

            {/* Project Details Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Project Details</h2>
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Specific Building/Area</Label>
                      <Input
                        value={specificBuilding}
                        onChange={(e) => setSpecificBuilding(e.target.value)}
                        placeholder="e.g., Building A - East Wing"
                        data-testid="input-specific-building"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type of Building</Label>
                      <Input
                        value={typeOfBuilding}
                        onChange={(e) => setTypeOfBuilding(e.target.value)}
                        placeholder="e.g., 5-story commercial office"
                        data-testid="input-type-of-building"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Deliverables Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Deliverables</h2>
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Interior CAD Elevations</Label>
                      <Input
                        type="number"
                        value={interiorCadElevations}
                        onChange={(e) => setInteriorCadElevations(e.target.value)}
                        placeholder="e.g., 15"
                        data-testid="input-interior-cad-elevations"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>BIM Version</Label>
                      <Input
                        value={bimVersion}
                        onChange={(e) => setBimVersion(e.target.value)}
                        placeholder="e.g., Revit 2024"
                        data-testid="input-bim-version"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>BIM Deliverable Format</Label>
                    <div className="flex flex-wrap gap-2">
                      {["Revit", "Archicad", "Sketchup", "Rhino", "Other"].map((format) => (
                        <Badge
                          key={format}
                          variant={bimDeliverable.includes(format) ? "default" : "outline"}
                          className="cursor-pointer toggle-elevate"
                          onClick={() => {
                            setBimDeliverable(prev =>
                              prev.includes(format)
                                ? prev.filter(f => f !== format)
                                : [...prev, format]
                            );
                          }}
                          data-testid={`badge-bim-${format.toLowerCase()}`}
                        >
                          {format}
                        </Badge>
                      ))}
                    </div>
                    {bimDeliverable.includes("Other") && (
                      <Input
                        value={bimDeliverableOther}
                        onChange={(e) => setBimDeliverableOther(e.target.value)}
                        placeholder="Specify other BIM format..."
                        className="mt-2"
                        data-testid="input-bim-other"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Template</Label>
                    <Select value={customTemplate} onValueChange={(v) => setCustomTemplate(v as typeof customTemplate)}>
                      <SelectTrigger data-testid="select-custom-template">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No (Standard S2P Template)</SelectItem>
                        <SelectItem value="yes">Yes (Client Template)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {customTemplate === "other" && (
                      <Input
                        value={customTemplateOther}
                        onChange={(e) => setCustomTemplateOther(e.target.value)}
                        placeholder="Describe template requirements..."
                        className="mt-2"
                        data-testid="input-custom-template-other"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* ACT Ceiling Details (Enhanced) */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">ACT Ceiling Details</h2>
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Above/Below ACT Scope</Label>
                      <Select value={aboveBelowACT} onValueChange={(v) => setAboveBelowACT(v as typeof aboveBelowACT)}>
                        <SelectTrigger data-testid="select-above-below-act">
                          <SelectValue placeholder="Select scope..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="above">Above Only</SelectItem>
                          <SelectItem value="below">Below Only</SelectItem>
                          <SelectItem value="both">Both Above & Below</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {aboveBelowACT === "other" && (
                        <Input
                          value={aboveBelowACTOther}
                          onChange={(e) => setAboveBelowACTOther(e.target.value)}
                          placeholder="Describe ACT scope..."
                          className="mt-2"
                          data-testid="input-act-scope-other"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>ACT Ceiling Square Footage</Label>
                      <Input
                        type="number"
                        value={actSqft}
                        onChange={(e) => setActSqft(e.target.value)}
                        placeholder="e.g., 5000"
                        data-testid="input-act-sqft"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Internal Notes Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Internal Notes & Assumptions</h2>
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Assumed Gross Margin</Label>
                    <Input
                      value={assumedGrossMargin}
                      onChange={(e) => setAssumedGrossMargin(e.target.value)}
                      placeholder="e.g., 45%"
                      data-testid="input-assumed-gross-margin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Square Footage Assumptions</Label>
                    <Textarea
                      value={sqftAssumptions}
                      onChange={(e) => setSqftAssumptions(e.target.value)}
                      placeholder="Describe how square footage was determined..."
                      data-testid="textarea-sqft-assumptions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Profitability Caveats</Label>
                    <Textarea
                      value={caveatsProfitability}
                      onChange={(e) => setCaveatsProfitability(e.target.value)}
                      placeholder="Any concerns about profitability..."
                      data-testid="textarea-caveats-profitability"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mixed Scope Description</Label>
                    <Input
                      value={mixedScope}
                      onChange={(e) => setMixedScope(e.target.value)}
                      placeholder="Describe mixed scope if applicable..."
                      data-testid="input-mixed-scope"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Insurance Requirements</Label>
                    <Textarea
                      value={insuranceRequirements}
                      onChange={(e) => setInsuranceRequirements(e.target.value)}
                      placeholder="Describe insurance requirements if applicable..."
                      data-testid="textarea-insurance-requirements"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Timeline Section (CRM fields like lead source, probability are managed in Deal Details) */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Timeline</h2>
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Estimated Timeline</Label>
                      <Select value={estimatedTimeline} onValueChange={setEstimatedTimeline}>
                        <SelectTrigger data-testid="select-estimated-timeline">
                          <SelectValue placeholder="Select timeline..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1week">1 Week</SelectItem>
                          <SelectItem value="2weeks">2 Weeks</SelectItem>
                          <SelectItem value="3weeks">3 Weeks</SelectItem>
                          <SelectItem value="4weeks">4 Weeks</SelectItem>
                          <SelectItem value="5weeks">5 Weeks</SelectItem>
                          <SelectItem value="6weeks">6 Weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timeline Notes</Label>
                      <Textarea
                        value={timelineNotes}
                        onChange={(e) => setTimelineNotes(e.target.value)}
                        placeholder="Any timeline notes or caveats..."
                        rows={3}
                        data-testid="textarea-timeline-notes"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </ScrollArea>

        {/* Right Panel - Pricing Summary + RFI Assistant */}
        <div className="w-80 border-l bg-muted/20 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Pricing Summary</h2>
          </div>

          {/* RFI Assistant - Shows when "I don't know" is selected */}
          {hasRfiItems && (
            <div className="p-4 border-b">
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-orange-800 dark:text-orange-200 flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Clarification Needed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    You selected "I don't know" for {rfiFields.length} {rfiFields.length === 1 ? "item" : "items"}.
                    Send this RFI email to the client:
                  </p>
                  <div className="space-y-1">
                    {rfiFields.map((field) => (
                      <Badge
                        key={field.key}
                        variant="outline"
                        className="text-xs mr-1 mb-1 border-orange-300 dark:border-orange-700"
                      >
                        {field.label}
                      </Badge>
                    ))}
                  </div>
                  <Textarea
                    readOnly
                    value={rfiEmailBody}
                    className="bg-white dark:bg-background text-xs h-40 font-mono resize-none"
                    data-testid="textarea-rfi-email"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300"
                      onClick={() => {
                        navigator.clipboard.writeText(rfiEmailBody);
                        toast({
                          title: "Copied to clipboard",
                          description: "RFI email text has been copied. Paste it into your email client.",
                        });
                      }}
                      data-testid="button-copy-rfi"
                    >
                      <Mail className="mr-1 h-3 w-3" />
                      Copy Email
                    </Button>
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600"
                      onClick={() => saveAndGenerateLinkMutation.mutate()}
                      disabled={saveAndGenerateLinkMutation.isPending || generateLinkMutation.isPending}
                      data-testid="button-generate-link"
                    >
                      {saveAndGenerateLinkMutation.isPending || generateLinkMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Link className="mr-1 h-3 w-3" />
                      )}
                      Client Link
                    </Button>
                  </div>
                  {generatedLink && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-700 dark:text-green-300 mb-1">Link generated and copied!</p>
                      <code className="text-xs text-green-800 dark:text-green-200 break-all">{generatedLink}</code>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Active for 7 days
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-orange-600 dark:text-orange-400 text-center">
                    Quote cannot be saved until all questions are answered
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Margin Target Slider - Always Visible */}
          <div className="p-4 border-b">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Margin Target</Label>
                <span className="text-sm font-semibold text-primary" data-testid="text-margin-target-value">
                  {(marginTarget * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[marginTarget * 100]}
                onValueChange={(value) => setMarginTarget(value[0] / 100)}
                min={35}
                max={60}
                step={1}
                className="w-full"
                data-testid="slider-margin-target"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>35%</span>
                <span className="text-amber-600 dark:text-amber-400">45% (recommended)</span>
                <span>60%</span>
              </div>
            </div>
          </div>

          {/* Margin Guardrail Warnings */}
          {pricing.marginWarnings && pricing.marginWarnings.length > 0 && (
            <div className="p-4 border-b space-y-2">
              {pricing.marginWarnings.map((warning, index) => (
                <div
                  key={index}
                  data-testid={`margin-warning-${warning.code.toLowerCase().replace(/_/g, "-")}`}
                  className={
                    warning.code === "BELOW_FLOOR"
                      ? "p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                      : "p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                  }
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      className={`h-4 w-4 mt-0.5 flex-shrink-0 ${warning.code === "BELOW_FLOOR"
                        ? "text-red-600 dark:text-red-400"
                        : "text-amber-600 dark:text-amber-400"
                        }`}
                    />
                    <div className="flex-1">
                      <p
                        className={`text-xs font-medium ${warning.code === "BELOW_FLOOR"
                          ? "text-red-800 dark:text-red-200"
                          : "text-amber-800 dark:text-amber-200"
                          }`}
                      >
                        {warning.code === "BELOW_FLOOR" ? "Critical Margin Warning" : "Margin Warning"}
                      </p>
                      <p
                        className={`text-xs mt-1 ${warning.code === "BELOW_FLOOR"
                          ? "text-red-700 dark:text-red-300"
                          : "text-amber-700 dark:text-amber-300"
                          }`}
                      >
                        {warning.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {/* Show Tier A pricing items when in Tier A mode */}
              {isTierA && tierAPricingResult && tierAPricingResult.clientPrice > 0 ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="truncate flex-1 mr-2">Scanning Cost</span>
                    <span className="font-mono">${tierAPricingResult.scanningCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="truncate flex-1 mr-2">Modeling Cost</span>
                    <span className="font-mono">${tierAPricingResult.modelingCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span className="truncate flex-1 mr-2">Margin Multiplier ({tierAPricingResult.marginLabel})</span>
                    <span className="font-mono">×{tierAPricingResult.margin}</span>
                  </div>
                  {tierAPricingResult.travelCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="truncate flex-1 mr-2">Travel</span>
                      <span className="font-mono">${tierAPricingResult.travelCost.toLocaleString()}</span>
                    </div>
                  )}
                </>
              ) : (
                /* Standard pricing items */
                pricing.items
                  .filter((item) => !item.isTotal)
                  .map((item, index) => {
                    // Determine if this is an area-based item that should show per-sqft pricing
                    const isAreaBased =
                      // Area discipline items (contain " LOD " and area info)
                      item.label.includes(" LOD ") ||
                      // Area-related services (CAD, Elevations, Facades)
                      item.label.includes("CAD Deliverable") ||
                      item.label.includes("Additional Elevations") ||
                      item.label.includes("Facade:");

                    // Exclude travel, risk premiums, and other non-area items
                    const isExcluded =
                      item.label.includes("Travel (") ||
                      item.label.includes("Risk Premium:") ||
                      item.label.includes("Price Adjustment");

                    const shouldShowPerSqft = isAreaBased && !isExcluded && totalSqft > 0;

                    const perSqftRate = shouldShowPerSqft
                      ? Math.abs(item.value) / totalSqft
                      : 0;

                    return (
                      <div
                        key={index}
                        className={`space-y-0.5 ${item.isDiscount ? "text-green-600" : ""
                          }`}
                      >
                        {/* Main price line */}
                        <div className="flex justify-between text-sm">
                          <span className="truncate flex-1 mr-2">{item.label}</span>
                          <span className="font-mono">
                            {item.isDiscount ? "-" : ""}${Math.abs(item.value).toLocaleString()}
                          </span>
                        </div>

                        {/* Per-sqft pricing line (if applicable) */}
                        {shouldShowPerSqft && (
                          <div
                            className="flex justify-end text-xs text-muted-foreground pr-1"
                            data-testid={`text-per-sqft-${index}`}
                          >
                            <span className="font-mono">
                              ${perSqftRate.toFixed(2)}/sqft
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
              {/* Show areas summary when no items yet */}
              {!isTierA && pricing.items.length === 0 && areas.length > 0 && (
                <div className="text-sm text-muted-foreground italic">
                  Add disciplines to areas to see pricing
                </div>
              )}
              {!isTierA && pricing.items.length === 0 && areas.length === 0 && (
                <div className="text-sm text-muted-foreground italic">
                  Add building or landscape areas to begin
                </div>
              )}
            </div>
          </ScrollArea>

          {/* What's Included Section */}
          {includedServices.length > 0 && (
            <div className="p-4 border-t border-b">
              <Collapsible defaultOpen data-testid="collapsible-whats-included">
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium hover:text-foreground transition-colors">
                  <span className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 transition-transform" />
                    What's Included
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-2">
                  {includedServices.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                      data-testid={service.testId}
                    >
                      <Check className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{service.name}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          <div className="p-4 border-t bg-background space-y-3">
            {/* Show Tier A totals when in Tier A mode */}
            {isTierA && tierAPricingResult && tierAPricingResult.clientPrice > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal (Cost)</span>
                  <span className="font-mono">${tierAPricingResult.subtotal.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="font-mono">${tierAPricingResult.totalWithTravel.toLocaleString()}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className={`font-mono ${isMarginBelowGate ? 'text-red-600' : 'text-green-600'}`}>
                      ${(tierAPricingResult.clientPrice - tierAPricingResult.subtotal).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-end text-xs text-muted-foreground">
                    <span className="font-mono" data-testid="text-markup-percentage">
                      {((tierAPricingResult.clientPrice - tierAPricingResult.subtotal) / tierAPricingResult.subtotal * 100).toFixed(1)}% markup
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-mono">${pricing.subtotal.toLocaleString()}</span>
                </div>
                {/* Itemized Internal Costs */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span className="flex items-center gap-1">
                      <ChevronDown className="w-3 h-3" />
                      Internal Cost Breakdown
                    </span>
                    <span className="font-mono">${pricing.totalUpteamCost.toLocaleString()}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-1 text-xs">
                    {pricing.disciplineTotals?.architecture > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="pl-4">Up Team</span>
                        <span className="font-mono">${Math.round(pricing.disciplineTotals.architecture * 0.65).toLocaleString()}</span>
                      </div>
                    )}
                    {pricing.disciplineTotals?.mep > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="pl-4">MEP</span>
                        <span className="font-mono">${Math.round(pricing.disciplineTotals.mep * 0.65).toLocaleString()}</span>
                      </div>
                    )}
                    {pricing.disciplineTotals?.structural > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="pl-4">Structural</span>
                        <span className="font-mono">${Math.round(pricing.disciplineTotals.structural * 0.65).toLocaleString()}</span>
                      </div>
                    )}
                    {pricing.disciplineTotals?.site > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="pl-4">Site</span>
                        <span className="font-mono">${Math.round(pricing.disciplineTotals.site * 0.65).toLocaleString()}</span>
                      </div>
                    )}
                    {pricing.disciplineTotals?.travel > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="pl-4">Travel</span>
                        <span className="font-mono">${Math.round(pricing.disciplineTotals.travel * 0.65).toLocaleString()}</span>
                      </div>
                    )}
                    {pricing.disciplineTotals?.services > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="pl-4">Services</span>
                        <span className="font-mono">${Math.round(pricing.disciplineTotals.services * 0.65).toLocaleString()}</span>
                      </div>
                    )}
                    {pricing.disciplineTotals?.risk > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="pl-4">Risk Premium</span>
                        <span className="font-mono">${Math.round(pricing.disciplineTotals.risk * 0.65).toLocaleString()}</span>
                      </div>
                    )}
                    {pricing.scanningEstimate && pricing.scanningEstimate.totalSqft > 0 && (
                      <>
                        <div className="flex justify-between text-muted-foreground pt-1 border-t border-muted">
                          <span className="pl-4">Scanning ({pricing.scanningEstimate.scanDays} day{pricing.scanningEstimate.scanDays > 1 ? 's' : ''} @ ${pricing.scanningEstimate.dailyRate}/day)</span>
                          <span className="font-mono">${pricing.scanningEstimate.scanningCost.toLocaleString()}</span>
                        </div>
                        {pricing.scanningEstimate.hotelPerDiemDays > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span className="pl-4">Hotel + Per Diem ({pricing.scanningEstimate.hotelPerDiemDays} night{pricing.scanningEstimate.hotelPerDiemDays > 1 ? 's' : ''} @ $300/day)</span>
                            <span className="font-mono">${pricing.scanningEstimate.hotelPerDiemCost.toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between text-muted-foreground pt-1 border-t border-muted">
                      <span className="pl-4">Overhead (15%)</span>
                      <span className="font-mono">${Math.round(pricing.totalUpteamCost * 0.15).toLocaleString()}</span>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="font-mono">${pricing.totalClientPrice.toLocaleString()}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className={`font-mono ${isMarginBelowGate ? 'text-red-600' : 'text-green-600'}`}>
                      ${pricing.profitMargin.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-end text-xs text-muted-foreground">
                    <span className="font-mono" data-testid="text-markup-percentage">
                      {(pricing.profitMargin / pricing.totalUpteamCost * 100).toFixed(1)}% markup
                    </span>
                  </div>
                </div>
              </>
            )}
            {isMarginBelowGate && (
              <div className="text-xs text-red-600 mt-1" data-testid="text-margin-gate-error">
                Margin must be at least {(FY26_GOALS.MARGIN_FLOOR * 100).toFixed(0)}% to save quote
              </div>
            )}
            {/* Integrity Check Card */}
            <div className="mt-4 p-3 border rounded-md bg-card" data-testid="integrity-check-status">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-sm font-medium">Integrity Check</span>
                <Badge
                  variant={isMarginBelowGate ? "destructive" : "default"}
                  className={!isMarginBelowGate ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  data-testid={isMarginBelowGate ? "badge-integrity-failed" : "badge-integrity-passed"}
                >
                  {isMarginBelowGate ? "Failed" : "Passed"}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAuditCounter(auditCounter + 1)}
                className="w-full"
                data-testid="button-rerun-audit"
              >
                Re-run Audit
              </Button>
            </div>
            {/* Price Adjustment Control */}
            {(isMarginBelowGate || priceAdjustmentPercent > 0) && (
              <div className="mt-4 p-3 border rounded-md bg-muted/30 space-y-3" data-testid="price-adjustment-section">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Price Adjustment</Label>
                  {requiredAdjustmentPercent > 0 && priceAdjustmentPercent === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPriceAdjustmentPercent(requiredAdjustmentPercent)}
                      data-testid="button-apply-min-adjustment"
                    >
                      Apply +{requiredAdjustmentPercent}% (minimum)
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={priceAdjustmentPercent || ""}
                    onChange={(e) => setPriceAdjustmentPercent(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24"
                    data-testid="input-price-adjustment"
                  />
                  <span className="text-sm text-muted-foreground">% markup</span>
                  {priceAdjustmentPercent > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPriceAdjustmentPercent(0)}
                      data-testid="button-clear-adjustment"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {priceAdjustmentPercent > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Base price: ${basePricing.totalClientPrice.toLocaleString()} + ${(pricing.totalClientPrice - basePricing.totalClientPrice).toLocaleString()} adjustment
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Boundary Drawer Modal for Landscape Areas */}
      {boundaryDrawerArea && projectCoordinates && (
        <BoundaryDrawer
          open={!!boundaryDrawerAreaId}
          onOpenChange={(open) => {
            if (!open) setBoundaryDrawerAreaId(null);
          }}
          coordinates={projectCoordinates}
          address={lead?.projectAddress || ""}
          initialBoundary={boundaryDrawerArea.boundary}
          onSave={(boundary, acres, imageUrl) => updateAreaBoundary(boundaryDrawerAreaId!, boundary, acres, imageUrl)}
        />
      )}

      {/* Line Item Editor - Full Screen Overlay */}
      {showLineItemEditor && customLineItems && (
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
