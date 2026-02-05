import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuoteAutosave } from "@/hooks/use-quote-autosave";
import { AutosaveStatus } from "@/components/AutosaveStatus";
import type { Quote } from "@shared/schema";
import { BUILDING_TYPES } from "@/features/cpq/pricing";
import { Button } from "@/components/ui/button";
import { Plus, Save, Download, FileText, ExternalLink, Loader2 } from "lucide-react";
import JSZip from "jszip";
import {
  generateScopePDF,
  generateQuoteClientPDF,
  generateQuoteInternalPDF,
  generateCRMPDF,
  generateScopeQuotePDF,
} from "@/cpq/lib/pdfExport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import AreaInput from "@/cpq/components/AreaInput";
import DisciplineSelector from "@/cpq/components/DisciplineSelector";
import RiskFactors from "@/cpq/components/RiskFactors";
import TravelCalculator from "@/cpq/components/TravelCalculator";
import AdditionalServices from "@/cpq/components/AdditionalServices";
import PricingSummary from "@/cpq/components/PricingSummary";
import CRMFields from "@/cpq/components/CRMFields";
import VersionControl from "@/cpq/components/VersionControl";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Facade {
  id: string;
  label: string;
}

interface CustomLineItem {
  id: string;
  name: string;
  pricePerSqft: string;
  sqft: string;
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
  customLineItems: CustomLineItem[];
  // Above Ceiling Tiles and Below Floor scanning
  includeAboveCeiling: boolean;
  aboveCeilingSqft: string;
  includeBelowFloor: boolean;
  belowFloorSqft: string;
  // Sub-section pricing tier inheritance
  isSubSection?: boolean;
  parentAreaId?: string;
}

interface PricingLineItem {
  label: string;
  value: number;
  editable?: boolean;
  isDiscount?: boolean;
  isTotal?: boolean;
  isAreaHeader?: boolean;
  upteamCost?: number;
}

interface CalculatorProps {
  quoteId?: string;
  initialData?: {
    clientName?: string;
    projectName?: string;
    projectAddress?: string;
  };
  isEmbedded?: boolean;
  onQuoteSaved?: (quoteId?: string) => void;
  onVersionSelect?: (quoteId: string) => void;
  leadId?: number;
}

export default function Calculator({ quoteId: propQuoteId, initialData, isEmbedded = false, onQuoteSaved, onVersionSelect, leadId }: CalculatorProps = {}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [, params] = useRoute("/new-cpq/calculator/:id");
  const quoteId = propQuoteId || params?.id;

  const { data: existingQuote, isLoading: isLoadingQuote } = useQuery<Quote>({
    queryKey: ["/api", "quotes", quoteId],
    enabled: !!quoteId,
  });

  // Fetch pricing matrix from database
  const { data: pricingRates, isLoading: isLoadingPricing } = useQuery<any[]>({
    queryKey: ["/api/pricing-matrix"],
  });

  // Fetch upteam pricing matrix from database
  const { data: upteamPricingRates, isLoading: isLoadingUpteamPricing } = useQuery<any[]>({
    queryKey: ["/api/upteam-pricing-matrix"],
  });

  // Fetch CAD pricing matrix from database
  const { data: cadPricingRates } = useQuery<any[]>({
    queryKey: ["/api/cad-pricing-matrix"],
  });

  // Fetch pricing parameters from database
  const { data: pricingParametersData } = useQuery<any[]>({
    queryKey: ["/api/pricing-parameters"],
  });

  const [scopingMode] = useState(true);
  const [isCreatingPandaDoc, setIsCreatingPandaDoc] = useState(false);
  const [projectDetails, setProjectDetails] = useState({
    clientName: initialData?.clientName || "",
    projectName: initialData?.projectName || "",
    projectAddress: initialData?.projectAddress || "",
    specificBuilding: "",
    typeOfBuilding: "",
    hasBasement: false,
    hasAttic: false,
    notes: "",
  });
  const [areas, setAreas] = useState<Area[]>([
    { id: "1", name: "", buildingType: "", squareFeet: "", scope: "full", disciplines: [], disciplineLods: {}, mixedInteriorLod: "300", mixedExteriorLod: "300", numberOfRoofs: 0, facades: [], gradeAroundBuilding: false, gradeLod: "300", includeCad: false, additionalElevations: 0, customLineItems: [], includeAboveCeiling: false, aboveCeilingSqft: "", includeBelowFloor: false, belowFloorSqft: "" },
  ]);
  const [risks, setRisks] = useState<string[]>([]);
  const [dispatch, setDispatch] = useState("troy");
  const [distance, setDistance] = useState<number | null>(null);
  const [distanceCalculated, setDistanceCalculated] = useState(false);
  const distanceCalculatedLocallyRef = useRef(false); // Track if user calculated distance in this session
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [customTravelCost, setCustomTravelCost] = useState<number | null>(null);
  const [services, setServices] = useState<Record<string, number>>({});
  const [tierAEnabled, setTierAEnabled] = useState(false);
  const [scopingData, setScopingData] = useState({
    aboveBelowACT: "",
    aboveBelowACTOther: "",
    actSqft: "",
    bimDeliverable: [] as string[],
    bimDeliverableOther: "",
    bimVersion: "",
    customTemplate: "",
    customTemplateOther: "",
    customTemplateFiles: [] as any[],
    sqftAssumptions: "",
    sqftAssumptionsFiles: [] as any[],
    assumedGrossMargin: "",
    caveatsProfitability: "",
    projectNotes: "",
    scopingDocuments: [] as any[],
    mixedScope: "",
    insuranceRequirements: "",
    tierAScanningCost: "",
    tierAScanningCostOther: "",
    tierAModelingCost: "",
    tierAMargin: "",
    estimatedTimeline: "",
    timelineOther: "",
    timelineNotes: "",
    paymentTerms: "",
    paymentTermsOther: "",
    paymentNotes: "",
    accountContact: "",
    accountContactEmail: "",
    accountContactPhone: "",
    phoneNumber: "",
    designProContact: "",
    designProCompanyContact: "",
    otherContact: "",
    proofLinks: "",
    ndaFiles: [] as any[],
    source: "",
    sourceNote: "",
    assist: "",
    probabilityOfClosing: "50",
    projectStatus: "",
    projectStatusOther: "",
  });

  const handleProjectDetailChange = (field: string, value: string | boolean) => {
    setProjectDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleAreaChange = (id: string, field: keyof Area, value: string | boolean | number | Facade[] | CustomLineItem[]) => {
    setAreas((prev) =>
      prev.map((area) => {
        if (area.id !== id) return area;

        let processedValue: any = value;
        if (field === "additionalElevations" && typeof value === "string") {
          processedValue = parseInt(value) || 0;
        }

        const updatedArea = { ...area, [field]: processedValue };

        if (field === "buildingType" && typeof value === "string") {
          const isLandscape = value === "14" || value === "15";

          if (isLandscape) {
            updatedArea.disciplines = ["site"];
            updatedArea.disciplineLods = { site: updatedArea.disciplineLods.site || "300" };
            updatedArea.includeCad = false;
            updatedArea.additionalElevations = 0;
          }
        }

        return updatedArea;
      })
    );
  };

  const addArea = () => {
    setAreas((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", buildingType: "", squareFeet: "", scope: "full", disciplines: [], disciplineLods: {}, mixedInteriorLod: "300", mixedExteriorLod: "300", numberOfRoofs: 0, facades: [], gradeAroundBuilding: false, gradeLod: "300", includeCad: false, additionalElevations: 0, customLineItems: [], includeAboveCeiling: false, aboveCeilingSqft: "", includeBelowFloor: false, belowFloorSqft: "" },
    ]);
  };

  const removeArea = (id: string) => {
    setAreas((prev) => prev.filter((area) => area.id !== id));
  };

  const handleAreaDisciplineChange = (areaId: string, disciplineId: string, checked: boolean) => {
    setAreas((prev) =>
      prev.map((area) => {
        if (area.id !== areaId) return area;

        const newDisciplines = checked
          ? area.disciplines.includes(disciplineId)
            ? area.disciplines // Already exists, don't add duplicate
            : [...area.disciplines, disciplineId]
          : area.disciplines.filter((d) => d !== disciplineId);

        const newLods = { ...area.disciplineLods };
        if (checked && !newLods[disciplineId]) {
          newLods[disciplineId] = "300";
        }

        return { ...area, disciplines: newDisciplines, disciplineLods: newLods };
      })
    );
  };

  const handleAreaLodChange = (areaId: string, disciplineId: string, value: string) => {
    setAreas((prev) =>
      prev.map((area) => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          disciplineLods: { ...area.disciplineLods, [disciplineId]: value },
        };
      })
    );
  };

  const handleScopingDataChange = (field: string, value: string) => {
    setScopingData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRiskChange = (riskId: string, checked: boolean) => {
    setRisks((prev) =>
      checked
        ? prev.includes(riskId)
          ? prev // Already exists, don't add duplicate
          : [...prev, riskId]
        : prev.filter((r) => r !== riskId)
    );
  };

  const handleServiceChange = (serviceId: string, quantity: number) => {
    setServices((prev) => ({ ...prev, [serviceId]: quantity }));
  };

  const handleCalculateDistance = async () => {
    if (!projectDetails.projectAddress || !dispatch) {
      toast({
        title: "Missing information",
        description: "Please enter both a dispatch location and project address",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingDistance(true);
    try {
      const response = await apiRequest("POST", "/api/calculate-distance", {
        origin: dispatch,
        destination: projectDetails.projectAddress,
      });
      const data = await response.json();
      setDistance(data.distance);
      setDistanceCalculated(true);
      distanceCalculatedLocallyRef.current = true; // Mark as calculated in this session
      toast({
        title: "Distance calculated",
        description: `${data.distance} miles from ${dispatch} to project location`,
      });
    } catch (error) {
      setDistanceCalculated(false);
      toast({
        title: "Error calculating distance",
        description: "Could not calculate distance. Please check the address and try again.",
        variant: "destructive",
      });
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  useEffect(() => {
    if (existingQuote) {
      setProjectDetails({
        clientName: existingQuote.clientName || "",
        projectName: existingQuote.projectName,
        projectAddress: existingQuote.projectAddress,
        specificBuilding: existingQuote.specificBuilding || "",
        typeOfBuilding: existingQuote.typeOfBuilding,
        hasBasement: existingQuote.hasBasement ?? false,
        hasAttic: existingQuote.hasAttic ?? false,
        notes: existingQuote.notes || "",
      });
      setAreas(existingQuote.areas as Area[]);
      setRisks(existingQuote.risks as string[]);
      setDispatch(existingQuote.dispatchLocation);
      // Only update distance state if not locally calculated in this session
      if (!distanceCalculatedLocallyRef.current) {
        setDistance(existingQuote.distance);
        setDistanceCalculated(existingQuote.distance !== null && existingQuote.distance !== undefined);
      }
      setCustomTravelCost(existingQuote.customTravelCost ? parseFloat(existingQuote.customTravelCost) : null);
      setServices(existingQuote.services as Record<string, number>);

      const legacyPaymentTerms = (existingQuote as any).paymentTerms;

      if (existingQuote.scopingData) {
        const loadedScopingData = { ...(existingQuote.scopingData as any) };
        if (legacyPaymentTerms && !loadedScopingData.paymentTerms) {
          loadedScopingData.paymentTerms = legacyPaymentTerms;
        }
        setScopingData(loadedScopingData);
      } else if (legacyPaymentTerms) {
        setScopingData(prev => ({
          ...prev,
          paymentTerms: legacyPaymentTerms
        }));
      }
    } else if (initialData && !quoteId) {
      // Only apply initial data if we're not loading an existing quote
      setProjectDetails(prev => ({
        ...prev,
        clientName: initialData.clientName || prev.clientName,
        projectName: initialData.projectName || prev.projectName,
        projectAddress: initialData.projectAddress || prev.projectAddress,
      }));
    }
  }, [existingQuote, initialData, quoteId]);

  const mapLineItemToSKU = (label: string, area?: any): { sku: string; productName: string; category: string; salesDescription: string } => {
    const lowerLabel = label.toLowerCase();

    // Determine building type (residential vs commercial)
    const isResidential = area?.buildingType?.toString() === "1" ||
      ["1", "2", "3", "4", "5", "6"].includes(area?.buildingType?.toString() || "");
    const buildingType = isResidential ? "Residential" : "Commercial";
    const skuType = isResidential ? "RES" : "COM";

    // Determine scope suffix for SKU and product name
    let skuScope = "";
    let nameScope = "";
    if (area?.scope === "interior") {
      skuScope = " INT";
      nameScope = " (INT-ONLY)";
    } else if (area?.scope === "exterior" || area?.scope === "facades") {
      skuScope = " EXT";
      nameScope = " (EXT-ONLY)";
    }

    // Determine LoD from label
    let lod = "300";
    if (lowerLabel.includes("lod 200") || lowerLabel.includes("200")) lod = "200";
    else if (lowerLabel.includes("lod 350") || lowerLabel.includes("350")) lod = "350";

    // Sales descriptions from QuickBooks product list
    const s2pDescription = `Scan2Plan ${buildingType} Service - BIM existing conditions documentation including LiDAR point cloud capture, registration, modeling, QC and project management.`;

    // Main service line items (Architecture/BIM) - exact QB names
    if (lowerLabel.includes("architecture") || lowerLabel.includes("bim") ||
      (lowerLabel.includes("area") && !lowerLabel.includes("mepf") && !lowerLabel.includes("structural"))) {
      const sku = skuScope
        ? `S2P ${skuType}${skuScope} ${lod}`
        : `S2P ${skuType} ${lod}`;
      const productName = nameScope
        ? `Scan2Plan ${buildingType} - LoD ${lod}${nameScope}`
        : `Scan2Plan ${buildingType} - LoD ${lod}`;
      return { sku, productName, category: "S2P", salesDescription: s2pDescription };
    }

    // MEPF - exact QB names with sales descriptions
    if (lowerLabel.includes("mepf") || lowerLabel.includes("mechanical") || lowerLabel.includes("electrical")) {
      const mepfDesc = lod === "200"
        ? "Any visible mechanical, electrical, plumbing, HVAC and fire safety components will be included in the BIM and/or working drawings. Adds generic systems with approximate size/location for space-claim and early coordination."
        : lod === "350"
          ? "Any visible mechanical, electrical, plumbing, HVAC and fire safety components will be included in the BIM and/or working drawings. Adds connections, supports, and interface features for clash resolution."
          : "Any visible mechanical, electrical, plumbing, HVAC and fire safety components will be included in the BIM and/or working drawings. Adds accurately sized/placed elements suitable for measured quantities and CDs.";
      return { sku: `AD MEPF ${lod}`, productName: `MEPF LoD ${lod}`, category: "Added Disciplines", salesDescription: mepfDesc };
    }

    // Structural - exact QB names
    if (lowerLabel.includes("structural") || lowerLabel.includes("structure")) {
      const strDesc = lod === "200"
        ? "Any visible structural components will be included in the BIM and/or working drawings. Adds generic systems with approximate size/location for space-claim and early coordination."
        : lod === "350"
          ? "Any visible structural components will be included in the BIM and/or working drawings. Adds connections, supports, and interface features for clash resolution."
          : "Any visible structural components will be included in the BIM and/or working drawings. Adds accurately sized/placed elements suitable for measured quantities and CDs.";
      return { sku: `AD STR MOD ${lod}`, productName: `Structural Modeling - LoD ${lod}`, category: "Added Disciplines", salesDescription: strDesc };
    }

    // Grade/Site - exact QB names
    if (lowerLabel.includes("grade") || lowerLabel.includes("site") || lowerLabel.includes("topography")) {
      const gradeDesc = lod === "200"
        ? "Scan2Plan Grade Service includes modeling and drafting of the building grade 20' surrounding the building. Basic topography with approx dimensions of features and buildings."
        : lod === "350"
          ? "Scan2Plan Grade Service includes modeling and drafting of the building grade 20' surrounding the building. Detailed topography including land development features, finishes, flower beds, shrubbery, trees."
          : "Scan2Plan Grade Service includes modeling and drafting of the building grade 20' surrounding the building. Basic topography with details like type, pattern and basic ground features.";
      return { sku: `AD GRADE ${lod}`, productName: `Grade - LoD ${lod}`, category: "Added Disciplines", salesDescription: gradeDesc };
    }

    // CAD packages - exact QB names (no LoD in product name)
    if (lowerLabel.includes("cad")) {
      if (lowerLabel.includes("interior package")) return { sku: "CAD INT PKG", productName: "CAD Interior Package", category: "CAD", salesDescription: "CAD Interior Package - Floor Plan(s), Up to 6 sections or interior elevations, Reflected Ceiling Plan(s). Delivered as .dwg & .pdf." };
      if (lowerLabel.includes("standard package")) return { sku: "CAD STD PKG", productName: "CAD Standard Package", category: "CAD", salesDescription: "CAD Standard Package - Floor Plans, Up to 4 sections or interior elevations, Exterior Elevations, Roof Plan. Delivered as .dwg & .pdf." };
      if (lowerLabel.includes("section")) return { sku: "CAD SEC", productName: "CAD Sections", category: "CAD", salesDescription: "CAD Sections (per sheet) - dwg & pdf" };
      if (lowerLabel.includes("interior elevation")) return { sku: "CAD INT ELEV", productName: "CAD Interior Elevations", category: "CAD", salesDescription: "CAD Interior Elevations (per sheet) - dwg & pdf" };
      if (lowerLabel.includes("mepf")) return { sku: "CAD MEPF STD PKG", productName: "CAD + MEPF Standard Package", category: "CAD", salesDescription: "CAD + MEPF Standard Package - Floor Plans, Reflected Ceiling Plans, Up to 4 sections or interior elevations, Exterior Elevations, Roof Plan." };
      if (lowerLabel.includes("structure") && lowerLabel.includes("mepf")) return { sku: "CAD STC MEPF PKG", productName: "CAD + Structure + MEPF + Site Package", category: "CAD", salesDescription: "CAD + Structure + MEPF + Site Package" };
      if (lowerLabel.includes("structure")) return { sku: "CAD STC STD PKG", productName: "CAD + Structure Standard Package", category: "CAD", salesDescription: "CAD + Structure Standard Package - Floor Plans, Reflected Ceiling Plans, Up to 4 sections or interior elevations, Exterior Elevations, Roof Plan." };
      return { sku: "CAD STD PKG", productName: "CAD Standard Package", category: "CAD", salesDescription: "CAD Standard Package - Floor Plans, Up to 4 sections or interior elevations, Exterior Elevations, Roof Plan. Delivered as .dwg & .pdf." };
    }

    // Landscape - exact QB names
    if (lowerLabel.includes("landscape")) {
      const landDesc = "Scan2Plan Landscape Service includes modeling and drafting of the property's current topographic features. Deliverables include Total Square Footage Audit, Colorized Point Cloud (.rcp format), Revit Model, CAD site plan.";
      return { sku: `S2P LNDSCP ${lod}`, productName: `Landscape Service - LoD ${lod}`, category: "S2P", salesDescription: landDesc };
    }

    // Matterport - exact QB name
    if (lowerLabel.includes("matterport") || lowerLabel.includes("virtual tour")) {
      return { sku: "AO MAT 3D TOUR", productName: "Matterport 3D Tour", category: "Add Ons", salesDescription: "High resolution 360 photo documentation and virtual tour walkthrough. Includes 3D dollhouse, floor plan views, and site-specific custom annotations." };
    }

    // Travel - use LiDAR Scanning as there's no Travel product in QB
    if (lowerLabel.includes("travel")) {
      return { sku: "S2P LID SCN PNT CLD REG", productName: "LiDAR Scanning and Point Cloud Registration", category: "S2P", salesDescription: "LiDAR capture and point cloud registration. Deliverables include Colorized Point Cloud (.rcp format), Registration Report, Actual Square Footage Audit." };
    }

    // Risk factors / Price Mods - exact QB names
    if (lowerLabel.includes("occupied")) return { sku: "PM OCC", productName: "Occupied", category: "Price Mods", salesDescription: "Occupied building premium" };
    if (lowerLabel.includes("no power")) return { sku: "PM NO POW", productName: "No Power", category: "Price Mods", salesDescription: "No Power premium" };
    if (lowerLabel.includes("fire") || lowerLabel.includes("flood")) return { sku: "PM FIR FLD", productName: "Fire / Flood", category: "Price Mods", salesDescription: "Fire / Flood damage premium" };
    if (lowerLabel.includes("expedited")) return { sku: "PM EXP SER", productName: "Expedited Service", category: "Price Mods", salesDescription: "Expedited Service" };
    if (lowerLabel.includes("discount")) return { sku: "PM DIS", productName: "Discount", category: "Price Mods", salesDescription: "Discount" };
    if (lowerLabel.includes("credit card")) return { sku: "PM CRE CRD", productName: "Credit Card 3%", category: "Price Mods", salesDescription: "Credit Card 3%" };
    if (lowerLabel.includes("net 60")) return { sku: "PM NET 60", productName: "Net 60", category: "Price Mods", salesDescription: "NET 60" };
    if (lowerLabel.includes("net 90")) return { sku: "PM NET 90", productName: "Net 90", category: "Price Mods", salesDescription: "NET 90" };
    if (lowerLabel.includes("50%") || lowerLabel.includes("completion")) return { sku: "PM 50% DUE", productName: "Estimated 50% Due at Project Completion", category: "Price Mods", salesDescription: "Estimated 50% Due at Project Completion" };
    if (lowerLabel.includes("credit")) return { sku: "PM CRE", productName: "Credit", category: "Price Mods", salesDescription: "Credit" };

    // Add Ons - exact QB names
    if (lowerLabel.includes("georeferenc")) return { sku: "AO GEOREF", productName: "Georeferencing", category: "Add Ons", salesDescription: "Georeferencing (Survey-grade): Point cloud data coordinates Georeferenced using GNSS System. Establish shared coordinates tied to civil survey control (EPSG/State Plane)." };
    if (lowerLabel.includes("ifc") || lowerLabel.includes("dxf")) return { sku: "AO IFC DXF", productName: "IFC / DXF Model", category: "Add Ons", salesDescription: "Converted from Revit (.rvt) into .ifc or .dxf file format." };
    if (lowerLabel.includes("rhino")) return { sku: "AO RHINO MDL", productName: "Rhino Model", category: "Add Ons", salesDescription: "3D DWG Model with discreet geometry converted from Revit for Rhinoceros fidelity" };
    if (lowerLabel.includes("sketchup")) return { sku: "AO SKETCH MOD", productName: "Sketchup Model", category: "Add Ons", salesDescription: ".skp Model with discreet geometry converted from Revit for Sketchup fidelity" };
    if (lowerLabel.includes("vectorworks")) return { sku: "AO VCT MDL", productName: "Vectorworks Model", category: "Add Ons", salesDescription: "Revit, IFC and/or DWG with discreet geometry converted from Revit for Vectorworks fidelity" };
    if (lowerLabel.includes("exposed ceiling")) return { sku: "AO EXP CEIL", productName: "Exposed Ceilings", category: "Add Ons", salesDescription: "Any visible details of exposed ceilings will be included. Specific size, shape, location, and orientation will be indicated. Includes scanning above ceiling tile." };

    // Scanning - exact QB name
    if (lowerLabel.includes("scanning") || lowerLabel.includes("point cloud") || lowerLabel.includes("registration")) {
      return { sku: "S2P LID SCN PNT CLD REG", productName: "LiDAR Scanning and Point Cloud Registration", category: "S2P", salesDescription: "LiDAR capture and point cloud registration. Deliverables include Colorized Point Cloud (.rcp format), Registration Report, Actual Square Footage Audit." };
    }

    // Default fallback - use generic commercial service
    return { sku: "S2P COM 300", productName: "Scan2Plan Commercial - LoD 300", category: "S2P", salesDescription: s2pDescription };
  };

  const exportQBOCSV = () => {
    const invoiceNo = existingQuote?.quoteNumber || `Q-${Date.now()}`;
    const customer = projectDetails.clientName || "Customer";
    const today = new Date();
    // QBO expects M/D/YYYY format
    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    const invoiceDate = formatDate(today);

    // Calculate due date based on payment terms
    let dueDate = invoiceDate;
    let terms = "Due on receipt";
    const paymentTerms = scopingData.paymentTerms;
    if (paymentTerms === "net30") {
      const due = new Date(today);
      due.setDate(due.getDate() + 30);
      dueDate = formatDate(due);
      terms = "Net 30";
    } else if (paymentTerms === "net60") {
      const due = new Date(today);
      due.setDate(due.getDate() + 60);
      dueDate = formatDate(due);
      terms = "Net 60";
    } else if (paymentTerms === "net90") {
      const due = new Date(today);
      due.setDate(due.getDate() + 90);
      dueDate = formatDate(due);
      terms = "Net 90";
    }

    const memo = `${projectDetails.projectName} - ${projectDetails.projectAddress}`;

    // Build CSV rows
    const headers = "*InvoiceNo,*Customer,*InvoiceDate,*DueDate,Terms,Location,Memo,Item(Product/Service),ItemDescription,ItemQuantity,ItemRate,*ItemAmount,Service Date";
    const rows: string[] = [headers];

    // Get line items (exclude totals and non-billable items like "Base Subtotal", "Effective Price")
    const lineItems = pricingItems.filter(item => {
      if (item.isTotal || item.value === 0) return false;
      const lowerLabel = item.label.toLowerCase();
      // Skip display-only items that aren't actual products
      if (lowerLabel.includes("base subtotal") ||
        lowerLabel.includes("effective price") ||
        lowerLabel.includes("subtotal")) return false;
      return true;
    });

    // Find travel line item and calculate total travel cost
    const travelItem = lineItems.find(item => item.label.toLowerCase().includes("travel"));
    const travelAmount = travelItem?.value || 0;

    // Filter out travel from line items (will be rolled into first architecture item)
    const filteredLineItems = lineItems.filter(item => !item.label.toLowerCase().includes("travel"));

    // Track if we've added travel to the first architecture item
    let travelRolledIn = false;

    filteredLineItems.forEach((item, index) => {
      const relatedArea = areas[0];
      const skuInfo = mapLineItemToSKU(item.label, relatedArea);

      // Use Sales Description from QuickBooks product list (escape for CSV)
      const rawDescription = skuInfo.salesDescription;
      const description = rawDescription.includes(",") ? `"${rawDescription}"` : rawDescription;
      // QuickBooks requires Category:Product Name format
      const fullProductName = `${skuInfo.category}:${skuInfo.productName}`;
      const productName = fullProductName.includes(",") ? `"${fullProductName}"` : fullProductName;

      // Parse quantity and rate from line item
      let quantity = 1;
      let rate = item.value;
      let amount = item.value;

      // Extract sqft from label like "Architecture (3,215 sqft, LOD 300)"
      const sqftMatch = item.label.match(/\(([\d,]+)\s*sqft/i);
      if (sqftMatch) {
        const sqft = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
        if (sqft > 0) {
          quantity = sqft;

          // Roll travel into first architecture line item
          if (!travelRolledIn && travelAmount > 0 &&
            (item.label.toLowerCase().includes("architecture") || item.label.toLowerCase().includes("bim"))) {
            amount = item.value + travelAmount;
            travelRolledIn = true;
          }

          rate = Math.round((amount / sqft) * 1000000) / 1000000; // 6 decimal precision for per-sqft rate
        }
      }

      // Handle acres for landscape - parse like "(2.5 acres, LOD 300)"
      const acresMatch = item.label.match(/\(([\d.]+)\s*acres?/i);
      if (acresMatch) {
        const acres = parseFloat(acresMatch[1]);
        if (acres > 0) {
          quantity = acres;
          rate = Math.round((amount / acres) * 100) / 100; // 2 decimal precision for per-acre rate
        }
      }

      if (index === 0) {
        // First row includes invoice-level details
        rows.push(`${invoiceNo},${customer},${invoiceDate},${dueDate},${terms},,${memo.includes(",") ? `"${memo}"` : memo},${productName},${description},${quantity},${rate},${amount},${invoiceDate}`);
      } else {
        // Subsequent rows only include item details (leave Service Date empty)
        rows.push(`${invoiceNo},,,,,,,${productName},${description},${quantity},${rate},${amount},`);
      }
    });

    // Generate CSV content
    const csvContent = rows.join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `QBO_Invoice_${invoiceNo}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Exported",
      description: `Invoice CSV exported as QBO_Invoice_${invoiceNo}.csv`,
    });
  };

  const saveQuoteMutation = useMutation({
    mutationFn: async (quoteData: any) => {
      if (quoteId) {
        const res = await apiRequest("PATCH", `/api/quotes/${quoteId}`, quoteData);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/quotes", quoteData);
        return res.json();
      }
    },
    onSuccess: (savedQuote: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api", "quotes"] });
      toast({
        title: quoteId ? "Quote updated successfully" : "Quote saved successfully",
        description: quoteId ? "Your changes have been saved." : "Your quote has been saved.",
      });

      if (onQuoteSaved) {
        onQuoteSaved(savedQuote?.id);
      }

      if (!isEmbedded) {
        setLocation("/new-cpq");
      }
    },
    onError: (error: any) => {
      toast({
        title: quoteId ? "Error updating quote" : "Error saving quote",
        description: error.message || "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveQuote = () => {
    const totalItem = pricingItems.find(item => item.isTotal);
    const totalPrice = totalItem ? totalItem.value.toFixed(2) : "0.00";

    const quoteData = {
      projectName: projectDetails.projectName,
      clientName: projectDetails.clientName,
      projectAddress: projectDetails.projectAddress,
      specificBuilding: projectDetails.specificBuilding,
      typeOfBuilding: projectDetails.typeOfBuilding,
      hasBasement: projectDetails.hasBasement,
      hasAttic: projectDetails.hasAttic,
      notes: projectDetails.notes,
      leadId: leadId || null,
      scopingMode,
      areas,
      risks,
      dispatchLocation: dispatch,
      distance,
      customTravelCost: customTravelCost?.toString() || null,
      services,
      scopingData: scopingMode ? scopingData : null,
      totalPrice,
      pricingBreakdown: {
        items: pricingItems.map(item => ({
          label: item.label,
          value: item.value,
          isTotal: item.isTotal || false,
          isDiscount: item.isDiscount || false,
        })),
      },
    };

    saveQuoteMutation.mutate(quoteData);
  };

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadZipFile = async (textContent: string, textFilename: string, zipFilename: string) => {
    const zip = new JSZip();
    zip.file(textFilename, textContent);

    const allFiles = [
      ...(scopingData.customTemplateFiles || []),
      ...(scopingData.sqftAssumptionsFiles || []),
      ...(scopingData.scopingDocuments || []),
      ...(scopingData.ndaFiles || []),
    ];

    console.log('Scope data for zip:', {
      customTemplateFiles: scopingData.customTemplateFiles,
      sqftAssumptionsFiles: scopingData.sqftAssumptionsFiles,
      scopingDocuments: scopingData.scopingDocuments,
      ndaFiles: scopingData.ndaFiles,
      allFilesCount: allFiles.length
    });

    for (const file of allFiles) {
      if (file.url) {
        console.log(`Fetching file: ${file.name} from ${file.url}`);
        try {
          const response = await fetch(file.url);
          if (!response.ok) {
            console.error(`Failed to fetch ${file.name}: ${response.status} ${response.statusText}`);
            continue;
          }
          const blob = await response.blob();
          zip.file(file.name, blob);
          console.log(`Added file to zip: ${file.name}`);
        } catch (error) {
          console.error(`Failed to fetch file ${file.name}:`, error);
        }
      } else {
        console.log(`File ${file.name} has no URL`);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatScopeData = () => {
    const buildingTypeMap: Record<string, string> = {
      "1": "Commercial - Simple",
      "2": "Residential - Standard",
      "3": "Residential - Luxury",
      "4": "Commercial / Office",
      "5": "Retail / Restaurants",
      "6": "Kitchen / Catering Facilities",
      "7": "Education",
      "8": "Hotel / Theatre / Museum",
      "9": "Hospitals / Mixed Use",
      "10": "Mechanical / Utility Rooms",
      "11": "Warehouse / Storage",
      "12": "Religious Buildings",
      "13": "Infrastructure / Roads / Bridges",
      "14": "Built Landscape",
      "15": "Natural Landscape",
    };

    const disciplineMap: Record<string, string> = {
      "architecture": "Architecture",
      "structure": "Structure",
      "mepf": "MEPF",
      "site": "Site/Topography",
    };

    const scopeMap: Record<string, string> = {
      "full": "Full Building",
      "interior": "Interior Only",
      "exterior": "Exterior Only",
      "roof": "Roof/Facades Only",
    };

    let text = "============================\n";
    text += "SCOPING DETAILS\n";
    text += "============================\n\n";

    text += "PROJECT INFORMATION\n";
    text += "----------------------------\n";
    text += `Client: ${projectDetails.clientName || "N/A"}\n`;
    text += `Project: ${projectDetails.projectName || "N/A"}\n`;
    text += `Address: ${projectDetails.projectAddress || "N/A"}\n`;
    text += `Specific Building: ${projectDetails.specificBuilding || "N/A"}\n`;
    text += `Type of Building: ${projectDetails.typeOfBuilding || "N/A"}\n`;
    text += `Has Basement: ${projectDetails.hasBasement ? "Yes" : "No"}\n`;
    text += `Has Attic: ${projectDetails.hasAttic ? "Yes" : "No"}\n`;
    if (projectDetails.notes) {
      text += `Notes: ${projectDetails.notes}\n`;
    }
    text += "\n";

    if (areas.length > 0) {
      text += "AREAS\n";
      text += "----------------------------\n";
      areas.forEach((area, index) => {
        const isLandscape = area.buildingType === "14" || area.buildingType === "15";
        const buildingTypeLabel = buildingTypeMap[area.buildingType] || area.buildingType;
        const scopeLabel = scopeMap[area.scope] || area.scope;

        text += `Area ${index + 1}:\n`;
        text += `  Name: ${area.name || "N/A"}\n`;
        text += `  Building Type: ${buildingTypeLabel}\n`;
        if (isLandscape) {
          const acres = parseFloat(area.squareFeet) || 0;
          const sqft = acres * 43560;
          text += `  Area: ${acres} acres (${sqft.toLocaleString()} sqft)\n`;
        } else {
          text += `  Square Feet: ${area.squareFeet || "N/A"}\n`;
        }
        text += `  Scope: ${scopeLabel}\n`;

        const disciplineLabels = area.disciplines.map(d => disciplineMap[d] || d);
        text += `  Disciplines: ${disciplineLabels.join(", ") || "None"}\n`;

        Object.entries(area.disciplineLods).forEach(([disc, lod]) => {
          const discLabel = disciplineMap[disc] || disc;
          text += `    ${discLabel}: LOD ${lod}\n`;
        });

        text += "\n";
      });
    }

    text += "DELIVERABLES\n";
    text += "----------------------------\n";
    if (scopingData.bimDeliverable && scopingData.bimDeliverable.length > 0) {
      text += `BIM Deliverable: ${scopingData.bimDeliverable.join(", ")}\n`;
      if (scopingData.bimDeliverable.includes("Other") && scopingData.bimDeliverableOther) {
        text += `  Other: ${scopingData.bimDeliverableOther}\n`;
      }
    }
    if (scopingData.bimVersion) {
      text += `BIM Version: ${scopingData.bimVersion}\n`;
    }
    if (scopingData.customTemplate) {
      text += `Custom Template: ${scopingData.customTemplate}\n`;
      if (scopingData.customTemplate === "other" && scopingData.customTemplateOther) {
        text += `  Other: ${scopingData.customTemplateOther}\n`;
      }
    }
    text += "\n";

    text += "ASSUMPTIONS\n";
    text += "----------------------------\n";
    if (scopingData.sqftAssumptions) {
      text += `SQFT Assumptions: ${scopingData.sqftAssumptions}\n`;
    }
    if (scopingData.assumedGrossMargin) {
      text += `Assumed Gross Margin: ${scopingData.assumedGrossMargin}\n`;
    }
    if (scopingData.caveatsProfitability) {
      text += `Caveats/Profitability: ${scopingData.caveatsProfitability}\n`;
    }
    if (scopingData.projectNotes) {
      text += `Project Notes: ${scopingData.projectNotes}\n`;
    }
    if (scopingData.mixedScope) {
      text += `Mixed Scope: ${scopingData.mixedScope}\n`;
    }
    if (scopingData.insuranceRequirements) {
      text += `Insurance Requirements: ${scopingData.insuranceRequirements}\n`;
    }
    text += "\n";

    text += "CONTACTS\n";
    text += "----------------------------\n";
    if (scopingData.accountContact) {
      text += `Account Contact: ${scopingData.accountContact}\n`;
      if (scopingData.accountContactEmail) {
        text += `  Email: ${scopingData.accountContactEmail}\n`;
      }
      if (scopingData.accountContactPhone) {
        text += `  Phone: ${scopingData.accountContactPhone}\n`;
      }
    }
    if (scopingData.phoneNumber) {
      text += `Phone Number: ${scopingData.phoneNumber}\n`;
    }
    if (scopingData.designProContact) {
      text += `Design Pro Contact: ${scopingData.designProContact}\n`;
    }
    if (scopingData.designProCompanyContact) {
      text += `Design Pro Company Contact: ${scopingData.designProCompanyContact}\n`;
    }
    if (scopingData.otherContact) {
      text += `Other Contact: ${scopingData.otherContact}\n`;
    }
    text += "\n";

    text += "RISK FACTORS\n";
    text += "----------------------------\n";
    if (risks.length > 0) {
      const riskMap: Record<string, { label: string; premium: number }> = {
        "flood": { label: "Flood", premium: 7 },
        "occupied": { label: "Occupied", premium: 15 },
        "hazardous": { label: "Hazardous", premium: 25 },
        "noPower": { label: "No Power", premium: 20 },
      };

      risks.forEach(risk => {
        const riskInfo = riskMap[risk] || {
          label: risk.charAt(0).toUpperCase() + risk.slice(1).replace(/([A-Z])/g, ' $1'),
          premium: 7
        };
        text += `${riskInfo.label}: +${riskInfo.premium}% premium on Architecture base\n`;
      });
    } else {
      text += `No risk factors selected\n`;
    }
    text += "\n";

    text += "TRAVEL & DISPATCH\n";
    text += "----------------------------\n";
    const dispatchMap: Record<string, string> = {
      "troy": "Troy, NY",
      "woodstock": "Woodstock, NY",
      "brooklyn": "Brooklyn, NY",
    };
    const dispatchLabel = dispatchMap[dispatch] || dispatch;
    text += `Dispatch Location: ${dispatchLabel}\n`;
    if (distanceCalculated && distance !== null) {
      // Calculate standard sqft and landscape acres separately for scan days
      const standardSqft = areas.reduce((sum, area) => {
        const isLandscape = area.buildingType === "14" || area.buildingType === "15";
        if (isLandscape) return sum;
        return sum + (parseInt(area.squareFeet) || 0);
      }, 0);
      const landscapeAcres = areas.reduce((sum, area) => {
        const isLandscape = area.buildingType === "14" || area.buildingType === "15";
        if (!isLandscape) return sum;
        return sum + (parseFloat(area.squareFeet) || 0);
      }, 0);
      const totalSqft = standardSqft + Math.round(landscapeAcres * 43560);
      // Scan days: 10,000 sqft/day for standard + 5 acres/day for landscape
      const standardScanDays = Math.ceil(standardSqft / 10000);
      const landscapeScanDays = Math.ceil(landscapeAcres / 5);
      const estimatedScanDays = Math.max(1, standardScanDays + landscapeScanDays);
      text += `Distance: ${distance} miles\n`;
      text += `Estimated Scan Days: ${estimatedScanDays}${landscapeAcres > 0 ? ` (${landscapeScanDays} landscape + ${standardScanDays} standard)` : ''}\n`;

      if (dispatch === "brooklyn") {
        const isTierB = totalSqft >= 10000 && totalSqft < 50000;
        const isTierC = totalSqft < 10000;
        const tierLabel = isTierB ? "Tier B" : (isTierC ? "Tier C" : "Tier A");
        const baseTravelCost = isTierB ? 300 : (isTierC ? 150 : 0);
        text += `Brooklyn Pricing: ${tierLabel} (${totalSqft.toLocaleString()} sqft)\n`;
        text += `Base Travel Cost: $${baseTravelCost}\n`;
        if (distance > 20) {
          text += `Extra Mileage: ${distance - 20} miles @ $4/mi (applies over 20 miles)\n`;
        } else {
          text += `Extra Mileage: Not applicable (distance ≤ 20 miles)\n`;
        }
      } else {
        const ratePerMile = 3;
        text += `Travel Rate: $${ratePerMile}.00 per mile\n`;
        if (distance > 75 && estimatedScanDays >= 2) {
          text += `Scan-Day Surcharge: $300 per day (applies when distance > 75 miles and scan days >= 2)\n`;
        } else {
          text += `Scan-Day Surcharge: Not applicable (${distance <= 75 ? 'distance ≤ 75 miles' : 'scan days < 2'})\n`;
        }
      }
    } else {
      text += `Distance: Not calculated\n`;
    }
    text += "\n";

    text += "ADDITIONAL SERVICES\n";
    text += "----------------------------\n";
    const servicesEntries = Object.entries(services).filter(([_, qty]) => qty > 0);
    if (servicesEntries.length > 0) {
      servicesEntries.forEach(([serviceId, quantity]) => {
        if (serviceId === "georeferencing") {
          text += `Georeferencing: $1,000.00 flat rate per building or site\n`;
        } else if (serviceId === "cadDeliverable") {
          const total = Math.max(quantity * 300, 300);
          text += `CAD Deliverable (PDF & DWG): ${quantity} set${quantity > 1 ? 's' : ''} @ $300 per set (minimum $300) = $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
        } else if (serviceId === "matterport") {
          const total = quantity * 0.10;
          text += `Matterport Virtual Tours: ${quantity.toLocaleString()} sqft @ $0.10 per sqft = $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
        } else if (serviceId === "expeditedService") {
          text += `Expedited Service: +20% of total (calculated in quote)\n`;
        } else if (serviceId === "actSqft") {
          const total = quantity * 5.00;
          text += `Scope of ACT: ${quantity.toLocaleString()} sqft @ $5.00 per sqft = $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
        } else if (serviceId === "scanningFullDay") {
          text += `Scanning & Registration - Full Day (up to 10 hrs on-site): $2,500.00\n`;
        } else if (serviceId === "scanningHalfDay") {
          text += `Scanning & Registration - Half Day (up to 4 hrs on-site): $1,500.00\n`;
        } else {
          const serviceName = serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/([A-Z])/g, ' $1');
          text += `${serviceName}: ${quantity} unit${quantity > 1 ? 's' : ''} (rate not specified)\n`;
        }
      });
    } else {
      text += `No additional services selected\n`;
    }
    text += "\n";

    text += "TIMELINE & PAYMENT\n";
    text += "----------------------------\n";
    if (scopingData.estimatedTimeline) {
      text += `Estimated Timeline: ${scopingData.estimatedTimeline}\n`;
    }
    if (scopingData.timelineNotes) {
      text += `Timeline Notes: ${scopingData.timelineNotes}\n`;
    }
    if (scopingData.paymentTerms) {
      text += `Payment Terms: ${scopingData.paymentTerms}\n`;
      if (scopingData.paymentTerms === "other" && scopingData.paymentTermsOther) {
        text += `  Other: ${scopingData.paymentTermsOther}\n`;
      }
    }
    if (scopingData.paymentNotes) {
      text += `Payment Notes: ${scopingData.paymentNotes}\n`;
    }
    text += "\n";

    return text;
  };

  const formatQuoteDataInternal = () => {
    let text = "============================\n";
    text += "QUOTE - INTERNAL\n";
    text += "============================\n\n";

    text += `Quote #: ${existingQuote?.quoteNumber || "Draft"}\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;

    text += "PROJECT INFORMATION\n";
    text += "----------------------------\n";
    text += `Client: ${projectDetails.clientName || "N/A"}\n`;
    text += `Project: ${projectDetails.projectName || "N/A"}\n`;
    text += `Address: ${projectDetails.projectAddress || "N/A"}\n`;
    text += `Building Type: ${projectDetails.typeOfBuilding || "N/A"}\n\n`;

    text += "PRICING BREAKDOWN\n";
    text += "----------------------------\n";
    pricingItems.forEach(item => {
      const amount = `$${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      text += `${item.label.padEnd(60)} ${amount.padStart(15)}\n`;
    });

    if (projectDetails.notes) {
      text += "\nNOTES\n";
      text += "----------------------------\n";
      text += `${projectDetails.notes}\n`;
    }

    return text;
  };

  const formatQuoteDataClient = () => {
    let text = "============================\n";
    text += "QUOTE\n";
    text += "============================\n\n";

    text += `Quote #: ${existingQuote?.quoteNumber || "Draft"}\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;

    text += "PROJECT INFORMATION\n";
    text += "----------------------------\n";
    text += `Client: ${projectDetails.clientName || "N/A"}\n`;
    text += `Project: ${projectDetails.projectName || "N/A"}\n`;
    text += `Address: ${projectDetails.projectAddress || "N/A"}\n`;
    text += `Building Type: ${projectDetails.typeOfBuilding || "N/A"}\n\n`;

    const grandTotalItem = pricingItems.find(item => item.isTotal);
    const effectivePriceItem = pricingItems.find(item => item.label.includes("Effective Price"));

    text += "PRICING SUMMARY\n";
    text += "----------------------------\n";
    if (grandTotalItem) {
      const amount = `$${grandTotalItem.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      text += `Grand Total: ${amount}\n`;
    }
    if (effectivePriceItem) {
      const amount = `$${effectivePriceItem.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      text += `${effectivePriceItem.label}: ${amount}\n`;
    }

    if (projectDetails.notes) {
      text += "\nNOTES\n";
      text += "----------------------------\n";
      text += `${projectDetails.notes}\n`;
    }

    return text;
  };

  const formatCRMData = () => {
    let text = "============================\n";
    text += "CRM DATA\n";
    text += "============================\n\n";

    text += `Quote #: ${existingQuote?.quoteNumber || "Draft"}\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;

    text += "PROJECT INFORMATION\n";
    text += "----------------------------\n";
    text += `Client: ${projectDetails.clientName || "N/A"}\n`;
    text += `Project: ${projectDetails.projectName || "N/A"}\n\n`;

    text += "LEAD TRACKING\n";
    text += "----------------------------\n";
    if (scopingData.source) {
      text += `Source: ${scopingData.source}\n`;
      if (scopingData.sourceNote) {
        text += `  Note: ${scopingData.sourceNote}\n`;
      }
    }
    if (scopingData.assist) {
      text += `Assist: ${scopingData.assist}\n`;
    }
    if (scopingData.probabilityOfClosing) {
      text += `Probability of Closing: ${scopingData.probabilityOfClosing}%\n`;
    }
    if (scopingData.projectStatus) {
      text += `Project Status: ${scopingData.projectStatus}\n`;
      if (scopingData.projectStatus === "other" && scopingData.projectStatusOther) {
        text += `  Other: ${scopingData.projectStatusOther}\n`;
      }
    }
    text += "\n";

    text += "TIER A PRICING\n";
    text += "----------------------------\n";
    if (scopingData.tierAScanningCost) {
      text += `Tier A Scanning Cost: ${scopingData.tierAScanningCost}\n`;
      if (scopingData.tierAScanningCost === "other" && scopingData.tierAScanningCostOther) {
        text += `  Other: ${scopingData.tierAScanningCostOther}\n`;
      }
    }
    if (scopingData.tierAModelingCost) {
      text += `Tier A Modeling Cost: ${scopingData.tierAModelingCost}\n`;
    }
    if (scopingData.tierAMargin) {
      text += `Tier A Margin: ${scopingData.tierAMargin}\n`;
    }
    text += "\n";

    if (scopingData.proofLinks) {
      text += "PROOF LINKS\n";
      text += "----------------------------\n";
      text += `${scopingData.proofLinks}\n\n`;
    }

    return text;
  };

  const exportScope = async () => {
    try {
      await generateScopePDF(
        projectDetails,
        areas,
        risks,
        dispatch,
        distance,
        distanceCalculated,
        services,
        scopingData,
        existingQuote?.quoteNumber,
        false
      );

      toast({
        title: "Scope exported",
        description: "Scope PDF downloaded",
      });
    } catch (error: any) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Export failed",
        description: error?.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportJSON = () => {
    const exportData = {
      schemaVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      quoteNumber: existingQuote?.quoteNumber || null,
      projectDetails: {
        clientName: projectDetails.clientName,
        projectName: projectDetails.projectName,
        projectAddress: projectDetails.projectAddress,
        specificBuilding: projectDetails.specificBuilding,
        typeOfBuilding: projectDetails.typeOfBuilding,
        hasBasement: projectDetails.hasBasement,
        hasAttic: projectDetails.hasAttic,
        notes: projectDetails.notes,
      },
      areas: areas.map(area => ({
        id: area.id,
        name: area.name,
        buildingType: area.buildingType,
        squareFeet: area.squareFeet,
        scope: area.scope,
        disciplines: area.disciplines,
        disciplineLods: area.disciplineLods,
        gradeAroundBuilding: area.gradeAroundBuilding,
        gradeLod: area.gradeLod,
      })),
      risks,
      travel: {
        dispatchLocation: dispatch,
        distance: distance,
        distanceCalculated: distanceCalculated,
        customTravelCost: customTravelCost,
      },
      additionalServices: services,
      scopingData: {
        aboveBelowACT: scopingData.aboveBelowACT,
        aboveBelowACTOther: scopingData.aboveBelowACTOther,
        actSqft: scopingData.actSqft,
        bimDeliverable: scopingData.bimDeliverable,
        bimDeliverableOther: scopingData.bimDeliverableOther,
        bimVersion: scopingData.bimVersion,
        customTemplate: scopingData.customTemplate,
        customTemplateOther: scopingData.customTemplateOther,
        sqftAssumptions: scopingData.sqftAssumptions,
        assumedGrossMargin: scopingData.assumedGrossMargin,
        caveatsProfitability: scopingData.caveatsProfitability,
        projectNotes: scopingData.projectNotes,
        mixedScope: scopingData.mixedScope,
        insuranceRequirements: scopingData.insuranceRequirements,
        tierAScanningCost: scopingData.tierAScanningCost,
        tierAScanningCostOther: scopingData.tierAScanningCostOther,
        tierAModelingCost: scopingData.tierAModelingCost,
        tierAMargin: scopingData.tierAMargin,
        estimatedTimeline: scopingData.estimatedTimeline,
        timelineOther: scopingData.timelineOther,
        timelineNotes: scopingData.timelineNotes,
        paymentTerms: scopingData.paymentTerms,
        paymentTermsOther: scopingData.paymentTermsOther,
        paymentNotes: scopingData.paymentNotes,
        proofLinks: scopingData.proofLinks,
      },
      crmData: {
        accountContact: scopingData.accountContact,
        accountContactEmail: scopingData.accountContactEmail,
        accountContactPhone: scopingData.accountContactPhone,
        phoneNumber: scopingData.phoneNumber,
        designProContact: scopingData.designProContact,
        designProCompanyContact: scopingData.designProCompanyContact,
        otherContact: scopingData.otherContact,
        source: scopingData.source,
        sourceNote: scopingData.sourceNote,
        assist: scopingData.assist,
        probabilityOfClosing: scopingData.probabilityOfClosing,
        projectStatus: scopingData.projectStatus,
        projectStatusOther: scopingData.projectStatusOther,
      },
      attachments: {
        customTemplateFiles: (scopingData.customTemplateFiles || []).map(f => ({ name: f.name, url: f.url })),
        sqftAssumptionsFiles: (scopingData.sqftAssumptionsFiles || []).map(f => ({ name: f.name, url: f.url })),
        scopingDocuments: (scopingData.scopingDocuments || []).map(f => ({ name: f.name, url: f.url })),
        ndaFiles: (scopingData.ndaFiles || []).map(f => ({ name: f.name, url: f.url })),
      },
      pricing: {
        lineItems: pricingItems.map(item => ({
          label: item.label,
          value: item.value,
          isDiscount: item.isDiscount || false,
          isTotal: item.isTotal || false,
          upteamCost: item.upteamCost,
        })),
        totalClientPrice: pricingData.clientTotal,
        totalUpteamCost: pricingData.upteamCost,
      },
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const projectName = projectDetails.projectName || "draft";
    const timestamp = Date.now();
    a.download = `quote-${projectName}-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "JSON exported",
      description: "Quote data exported as JSON file",
    });
  };

  const createPandaDoc = async () => {
    setIsCreatingPandaDoc(true);

    try {
      const exportData = {
        projectDetails: {
          clientName: projectDetails.clientName,
          projectName: projectDetails.projectName,
          projectAddress: projectDetails.projectAddress,
        },
        areas: areas.map(area => ({
          id: area.id,
          name: area.name,
          buildingType: area.buildingType,
          squareFeet: area.squareFeet,
          scope: area.scope,
          disciplines: area.disciplines,
          disciplineLods: area.disciplineLods,
          gradeAroundBuilding: area.gradeAroundBuilding,
        })),
        crmData: {
          accountContact: scopingData.accountContact,
          accountContactEmail: scopingData.accountContactEmail,
        },
        pricing: {
          lineItems: pricingItems.map(item => ({
            label: item.label,
            value: item.value,
            isDiscount: item.isDiscount || false,
            isTotal: item.isTotal || false,
          })),
          totalClientPrice: pricingData.clientTotal,
        },
      };

      const response = await apiRequest("POST", "/api/pandadoc/create", exportData);
      const result = await response.json();

      if (result.success && result.documentUrl) {
        toast({
          title: "PandaDoc created",
          description: "Opening document in new tab...",
        });
        window.open(result.documentUrl, "_blank");
      } else {
        throw new Error(result.error || "Failed to create PandaDoc");
      }
    } catch (error: any) {
      console.error("PandaDoc creation failed:", error);
      toast({
        title: "PandaDoc creation failed",
        description: error?.message || "Failed to create PandaDoc document",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPandaDoc(false);
    }
  };

  const exportScopeQuoteClient = async () => {
    try {
      const pdfBlob = await generateScopeQuotePDF(
        projectDetails,
        areas,
        risks,
        dispatch,
        distance,
        distanceCalculated,
        services,
        scopingData,
        pricingItems,
        false,
        undefined,
        undefined,
        existingQuote?.quoteNumber,
        true
      );

      if (pdfBlob) {
        const zip = new JSZip();
        const timestamp = Date.now();
        const projectName = projectDetails.projectName || "draft";

        zip.file(`scope-quote-client-${projectName}.pdf`, pdfBlob);

        const allFiles = [
          ...(scopingData.customTemplateFiles || []),
          ...(scopingData.sqftAssumptionsFiles || []),
          ...(scopingData.scopingDocuments || []),
          ...(scopingData.ndaFiles || []),
        ];

        for (const file of allFiles) {
          if (file.url) {
            try {
              const response = await fetch(file.url);
              if (response.ok) {
                const blob = await response.blob();
                zip.file(file.name, blob);
              }
            } catch (error) {
              console.error(`Failed to fetch file ${file.name}:`, error);
            }
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scope-quote-client-${projectName}-${timestamp}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "Scope + Quote exported",
        description: "Scope, quote (client version), and attachments downloaded as zip file",
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportScopeQuoteInternal = async () => {
    const grandTotalItem = pricingItems.find(item => item.isTotal);
    const totalClientPrice = grandTotalItem?.value || 0;
    const totalUpteamCost = pricingItems
      .filter(item => item.upteamCost !== undefined)
      .reduce((sum, item) => sum + (item.upteamCost || 0), 0);

    try {
      const pdfBlob = await generateScopeQuotePDF(
        projectDetails,
        areas,
        risks,
        dispatch,
        distance,
        distanceCalculated,
        services,
        scopingData,
        pricingItems,
        true,
        totalClientPrice,
        totalUpteamCost,
        existingQuote?.quoteNumber,
        true
      );

      if (pdfBlob) {
        const zip = new JSZip();
        const timestamp = Date.now();
        const projectName = projectDetails.projectName || "draft";

        zip.file(`scope-quote-internal-${projectName}.pdf`, pdfBlob);

        const allFiles = [
          ...(scopingData.customTemplateFiles || []),
          ...(scopingData.sqftAssumptionsFiles || []),
          ...(scopingData.scopingDocuments || []),
          ...(scopingData.ndaFiles || []),
        ];

        for (const file of allFiles) {
          if (file.url) {
            try {
              const response = await fetch(file.url);
              if (response.ok) {
                const blob = await response.blob();
                zip.file(file.name, blob);
              }
            } catch (error) {
              console.error(`Failed to fetch file ${file.name}:`, error);
            }
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scope-quote-internal-${projectName}-${timestamp}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "Scope + Quote exported",
        description: "Scope, quote (internal version), and attachments downloaded as zip file",
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportQuoteClient = async () => {
    try {
      await generateQuoteClientPDF(
        projectDetails,
        pricingItems,
        existingQuote?.quoteNumber
      );
      toast({
        title: "Quote exported",
        description: "Quote (client version) has been downloaded as PDF",
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportQuoteInternal = async () => {
    const grandTotalItem = pricingItems.find(item => item.isTotal);
    const totalClientPrice = grandTotalItem?.value || 0;
    const totalUpteamCost = pricingItems
      .filter(item => item.upteamCost !== undefined)
      .reduce((sum, item) => sum + (item.upteamCost || 0), 0);

    try {
      await generateQuoteInternalPDF(
        projectDetails,
        pricingItems,
        totalClientPrice,
        totalUpteamCost,
        existingQuote?.quoteNumber
      );
      toast({
        title: "Quote exported",
        description: "Quote (internal version) has been downloaded as PDF",
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportCRMOnly = async () => {
    try {
      await generateCRMPDF(
        projectDetails,
        scopingData,
        existingQuote?.quoteNumber
      );
      toast({
        title: "CRM data exported",
        description: "CRM data has been downloaded as PDF",
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper function to get area tier based on square footage
  const getAreaTier = (sqft: number): string => {
    if (sqft <= 5000) return "0-5k";
    if (sqft <= 10000) return "5k-10k";
    if (sqft <= 20000) return "10k-20k";
    if (sqft <= 30000) return "20k-30k";
    if (sqft <= 40000) return "30k-40k";
    if (sqft <= 50000) return "40k-50k";
    if (sqft <= 75000) return "50k-75k";
    if (sqft <= 100000) return "75k-100k";
    return "100k+";
  };

  // Helper function to look up pricing rate from database
  const getPricingRate = (buildingTypeId: string, sqft: number, discipline: string, lod: string): number => {
    if (!pricingRates) return 0;

    const areaTier = getAreaTier(sqft);
    const rate = pricingRates.find((r: any) =>
      r.buildingTypeId === parseInt(buildingTypeId) &&
      r.areaTier === areaTier &&
      r.discipline === discipline &&
      r.lod === lod
    );

    return rate ? parseFloat(rate.ratePerSqFt) : 0;
  };

  // Helper function to look up upteam pricing rate from database
  const getUpteamPricingRate = (buildingTypeId: string, sqft: number, discipline: string, lod: string): number => {
    if (!upteamPricingRates) return 0;

    const areaTier = getAreaTier(sqft);
    const rate = upteamPricingRates.find((r: any) =>
      r.buildingTypeId === parseInt(buildingTypeId) &&
      r.areaTier === areaTier &&
      r.discipline === discipline &&
      r.lod === lod
    );

    return rate ? parseFloat(rate.ratePerSqFt) : 0;
  };

  // Helper function to determine CAD package type based on discipline count
  const getCadPackageType = (disciplineCount: number): string => {
    if (disciplineCount >= 3) return "a_s_mep_site";
    if (disciplineCount === 2) return "a_s_site";
    return "basic_architecture";
  };

  // Helper function to get area tier for CAD pricing
  const getCadAreaTier = (sqft: number): string => {
    if (sqft >= 100000) return "100k+";
    if (sqft >= 75000) return "75k-100k";
    if (sqft >= 50000) return "50k-75k";
    if (sqft >= 40000) return "40k-50k";
    if (sqft >= 30000) return "30k-40k";
    if (sqft >= 20000) return "20k-30k";
    if (sqft >= 10000) return "10k-20k";
    if (sqft >= 5000) return "5k-10k";
    return "0-5k";
  };

  // Helper function to get CAD rate from database
  const getCadPricingRate = (buildingType: string, sqft: number, disciplineCount: number): number => {
    if (!cadPricingRates || cadPricingRates.length === 0) return 0;

    const buildingTypeId = parseInt(buildingType) || 1;
    const areaTier = getCadAreaTier(sqft);
    const packageType = getCadPackageType(disciplineCount);

    // First try to find rate for specific building type
    let rate = cadPricingRates.find(
      r => r.buildingTypeId === buildingTypeId && r.areaTier === areaTier && r.packageType === packageType
    );

    // If not found, try to find a generic rate (buildingTypeId = 0 or 1)
    if (!rate) {
      rate = cadPricingRates.find(
        r => (r.buildingTypeId === 0 || r.buildingTypeId === 1) && r.areaTier === areaTier && r.packageType === packageType
      );
    }

    return rate ? parseFloat(rate.ratePerSqFt) : 0;
  };

  // Helper function to calculate additional elevations/sections pricing
  const calculateAdditionalElevationsPrice = (quantity: number): number => {
    if (quantity <= 0) return 0;

    // Tiered pricing: $25/ea for 1-10, $20/ea for 10-20, $15/ea for 20-100, $10/ea for 100-300, $5/ea for 300+
    let total = 0;
    let remaining = quantity;

    // First 10 at $25/ea
    const tier1 = Math.min(remaining, 10);
    total += tier1 * 25;
    remaining -= tier1;

    // Next 10 (10-20) at $20/ea
    if (remaining > 0) {
      const tier2 = Math.min(remaining, 10);
      total += tier2 * 20;
      remaining -= tier2;
    }

    // Next 80 (20-100) at $15/ea
    if (remaining > 0) {
      const tier3 = Math.min(remaining, 80);
      total += tier3 * 15;
      remaining -= tier3;
    }

    // Next 200 (100-300) at $10/ea
    if (remaining > 0) {
      const tier4 = Math.min(remaining, 200);
      total += tier4 * 10;
      remaining -= tier4;
    }

    // Remaining (300+) at $5/ea
    if (remaining > 0) {
      total += remaining * 5;
    }

    return total;
  };

  const getLandscapePerAcreRate = (buildingType: string, acres: number, lod: string): number => {
    // Landscape pricing still uses hardcoded rates (building types 14-15)
    const builtLandscapeRates: Record<string, number[]> = {
      "200": [875, 625, 375, 250, 160],
      "300": [1000, 750, 500, 375, 220],
      "350": [1250, 1000, 750, 500, 260],
    };

    const naturalLandscapeRates: Record<string, number[]> = {
      "200": [625, 375, 250, 200, 140],
      "300": [750, 500, 375, 275, 200],
      "350": [1000, 750, 500, 325, 240],
    };

    const rates = buildingType === "14" ? builtLandscapeRates : naturalLandscapeRates;
    const lodRates = rates[lod] || rates["200"];

    if (acres >= 100) return lodRates[4];
    if (acres >= 50) return lodRates[3];
    if (acres >= 20) return lodRates[2];
    if (acres >= 5) return lodRates[1];
    return lodRates[0];
  };

  const calculatePricing = () => {
    const items: PricingLineItem[] = [];
    let archBaseTotal = 0;
    let otherDisciplinesTotal = 0;
    let upteamCost = 0; // Track internal vendor costs

    // Fallback upteam multiplier if database rate not found
    const UPTEAM_MULTIPLIER_FALLBACK = 0.65;

    // Track if we have multiple areas for grouping headers
    const hasMultipleAreas = areas.length > 1;

    areas.forEach((area, areaIndex) => {
      const isLandscape = area.buildingType === "14" || area.buildingType === "15";

      // Add area header for multi-area quotes
      if (hasMultipleAreas && (area.name || area.squareFeet)) {
        const areaName = area.name || `Area ${areaIndex + 1}`;
        const buildingTypeLabel = BUILDING_TYPES.find(bt => bt.id === area.buildingType)?.label || "";
        items.push({
          label: `${areaName}${buildingTypeLabel ? ` (${buildingTypeLabel})` : ''}`,
          value: 0,
          editable: false,
          isAreaHeader: true,
        });
      }
      const inputValue = isLandscape ? parseFloat(area.squareFeet) || 0 : parseInt(area.squareFeet) || 0;

      const scope = area.scope || "full";
      const disciplines = isLandscape ? ["site"] : (area.disciplines.length > 0 ? area.disciplines : []);

      // Helper function to calculate pricing for a discipline with a specific lod and scope portion
      const calculateDisciplinePricing = (discipline: string, lod: string, scopePortion: number, scopeType: string) => {
        let lineTotal = 0;
        let areaLabel = "";
        let upteamLineCost = 0;
        let effectiveRate = 0;

        if (isLandscape) {
          const acres = inputValue;
          const sqft = Math.round(acres * 43560);
          const perAcreRate = getLandscapePerAcreRate(area.buildingType, acres, lod);
          lineTotal = acres * perAcreRate * scopePortion;
          areaLabel = `${acres} acres (${sqft.toLocaleString()} sqft)`;
          upteamLineCost = lineTotal * UPTEAM_MULTIPLIER_FALLBACK;
          effectiveRate = perAcreRate; // per acre rate for landscape
        } else if (discipline === "matterport") {
          const sqft = Math.max(inputValue, 3000);
          effectiveRate = 0.10;
          lineTotal = sqft * effectiveRate;
          areaLabel = `${sqft.toLocaleString()} sqft @ $${effectiveRate.toFixed(3)}/sqft`;
          upteamLineCost = lineTotal * UPTEAM_MULTIPLIER_FALLBACK;
        } else {
          const sqft = Math.max(inputValue, 3000);
          const ratePerSqft = getPricingRate(area.buildingType, sqft, discipline, lod);

          if (ratePerSqft > 0) {
            effectiveRate = ratePerSqft;
            lineTotal = sqft * ratePerSqft * scopePortion;
          } else {
            let baseRatePerSqft = 2.50;
            if (discipline === "mepf") baseRatePerSqft = 3.00;
            else if (discipline === "structure") baseRatePerSqft = 2.00;
            else if (discipline === "site") baseRatePerSqft = 1.50;

            const lodMultiplier: Record<string, number> = { "200": 1.0, "300": 1.3, "350": 1.5 };
            const multiplier = lodMultiplier[lod] || 1.0;
            effectiveRate = baseRatePerSqft * multiplier;
            lineTotal = sqft * effectiveRate * scopePortion;
          }

          const upteamRatePerSqft = getUpteamPricingRate(area.buildingType, sqft, discipline, lod);
          if (upteamRatePerSqft > 0) {
            upteamLineCost = sqft * upteamRatePerSqft * scopePortion;
          } else {
            upteamLineCost = lineTotal * UPTEAM_MULTIPLIER_FALLBACK;
          }

          areaLabel = `${sqft.toLocaleString()} sqft @ $${effectiveRate.toFixed(3)}/sqft`;
        }

        return { lineTotal, areaLabel, upteamLineCost, effectiveRate };
      };

      disciplines.forEach((discipline) => {
        // Handle Roof/Facades Only Scope - create separate line items for each facade/roof entry
        if (scope === "roof" && discipline !== "matterport" && !isLandscape) {
          const lod = area.disciplineLods[discipline] || "300";
          const facades = area.facades || [];

          // Calculate base price at full rate for reference
          const basePricing = calculateDisciplinePricing(discipline, lod, 1.0, "full");

          // Add separate line item for each facade/roof entry
          facades.forEach((facade) => {
            const itemTotal = basePricing.lineTotal * 0.10;
            const itemUpteam = basePricing.upteamLineCost * 0.10;
            upteamCost += itemUpteam;

            if (discipline === "architecture") {
              archBaseTotal += itemTotal;
            } else {
              otherDisciplinesTotal += itemTotal;
            }

            const itemLabel = facade.label || "Unlabeled";
            items.push({
              label: `${discipline.charAt(0).toUpperCase() + discipline.slice(1)} - ${itemLabel} (${basePricing.areaLabel}, LOD ${lod}) (10%)`,
              value: itemTotal,
              editable: true,
              upteamCost: itemUpteam,
            });
          });

          return; // Skip normal processing for this discipline
        }

        // Handle Mixed Scope - create two line items (Interior + Exterior)
        if (scope === "mixed" && discipline !== "matterport" && !isLandscape) {
          // Interior portion at 65%
          const interiorLod = area.mixedInteriorLod || "300";
          const interior = calculateDisciplinePricing(discipline, interiorLod, 0.65, "interior");
          upteamCost += interior.upteamLineCost;

          if (discipline === "architecture") {
            archBaseTotal += interior.lineTotal;
          } else {
            otherDisciplinesTotal += interior.lineTotal;
          }

          items.push({
            label: `${discipline.charAt(0).toUpperCase() + discipline.slice(1)} - Interior (${interior.areaLabel}, LOD ${interiorLod}) (65%)`,
            value: interior.lineTotal,
            editable: true,
            upteamCost: interior.upteamLineCost,
          });

          // Exterior portion at 35%
          const exteriorLod = area.mixedExteriorLod || "300";
          const exterior = calculateDisciplinePricing(discipline, exteriorLod, 0.35, "exterior");
          upteamCost += exterior.upteamLineCost;

          if (discipline === "architecture") {
            archBaseTotal += exterior.lineTotal;
          } else {
            otherDisciplinesTotal += exterior.lineTotal;
          }

          items.push({
            label: `${discipline.charAt(0).toUpperCase() + discipline.slice(1)} - Exterior (${exterior.areaLabel}, LOD ${exteriorLod}) (35%)`,
            value: exterior.lineTotal,
            editable: true,
            upteamCost: exterior.upteamLineCost,
          });
        } else {
          // Standard single line item processing
          const lod = area.disciplineLods[discipline] || "300";
          const result = calculateDisciplinePricing(discipline, lod, 1.0, "full");
          let lineTotal = result.lineTotal;
          let upteamLineCost = result.upteamLineCost;
          const areaLabel = result.areaLabel;

          let scopeDiscount = 0;
          let upteamScopeDiscount = 0;
          let scopeLabel = "";

          if (!isLandscape && discipline !== "matterport") {
            if (scope === "interior") {
              // Interior-only discount applies only to Architecture
              // MEPF and Structure are full price for interior scope
              if (discipline === "architecture" || discipline === "site") {
                scopeDiscount = lineTotal * 0.25;
                upteamScopeDiscount = upteamLineCost * 0.25;
                scopeLabel = " (Interior Only -25%)";
              }
            } else if (scope === "exterior") {
              scopeDiscount = lineTotal * 0.50;
              upteamScopeDiscount = upteamLineCost * 0.50;
              scopeLabel = " (Exterior Only -50%)";
            } else if (scope === "roof") {
              scopeDiscount = lineTotal * 0.65;
              upteamScopeDiscount = upteamLineCost * 0.65;
              scopeLabel = " (Roof/Facades Only -65%)";
            }
          }

          lineTotal -= scopeDiscount;
          upteamLineCost -= upteamScopeDiscount;
          upteamCost += upteamLineCost;

          if (discipline === "architecture") {
            archBaseTotal += lineTotal;
          } else {
            otherDisciplinesTotal += lineTotal;
          }

          // Format discipline label - special handling for ACT
          const disciplineLabel = discipline === "act"
            ? "ACT (Above Ceiling Tiles)"
            : discipline === "mepf"
              ? "MEPF"
              : discipline.charAt(0).toUpperCase() + discipline.slice(1);

          items.push({
            label: discipline === "matterport"
              ? `Matterport Virtual Tours (${areaLabel})`
              : `${disciplineLabel} (${areaLabel}, LOD ${lod})${scopeLabel}`,
            value: lineTotal,
            editable: true,
            upteamCost: upteamLineCost,
          });
        }
      });

      // Process custom line items for this area
      if (area.customLineItems && area.customLineItems.length > 0) {
        area.customLineItems.forEach((customItem) => {
          const itemSqft = parseInt(customItem.sqft) || 0;
          const itemPricePerSqft = parseFloat(customItem.pricePerSqft) || 0;
          const itemTotal = itemSqft * itemPricePerSqft;

          if (itemTotal > 0) {
            const areaPrefix = hasMultipleAreas && area.name ? `${area.name} - ` : '';
            items.push({
              label: `${areaPrefix}${customItem.name || 'Custom Item'} (${itemSqft.toLocaleString()} sqft @ $${itemPricePerSqft.toFixed(3)}/sqft)`,
              value: itemTotal,
              editable: true,
              upteamCost: itemTotal * UPTEAM_MULTIPLIER_FALLBACK,
            });
            otherDisciplinesTotal += itemTotal;
            upteamCost += itemTotal * UPTEAM_MULTIPLIER_FALLBACK;
          }
        });
      }

      // Above Ceiling Tiles and Below Floor pricing (50% of architecture rate)
      if (!isLandscape) {
        const areaPrefix = hasMultipleAreas && area.name ? `${area.name} - ` : '';
        const baseSqft = Math.max(parseInt(area.squareFeet) || 0, 3000);
        const archLod = area.disciplineLods["architecture"] || "300";

        // Get the architecture rate for this area to use as base for 50% calculation
        const archRatePerSqft = getPricingRate(area.buildingType, baseSqft, "architecture", archLod);
        let baseArchRate = archRatePerSqft > 0 ? archRatePerSqft : 2.50;
        const lodMultiplier: Record<string, number> = { "200": 1.0, "300": 1.3, "350": 1.5 };
        if (archRatePerSqft <= 0) {
          baseArchRate = baseArchRate * (lodMultiplier[archLod] || 1.0);
        }
        const halfArchRate = baseArchRate * 0.5;

        // Above Ceiling Tiles
        if (area.includeAboveCeiling && area.aboveCeilingSqft) {
          const actSqft = parseInt(area.aboveCeilingSqft) || 0;
          if (actSqft > 0) {
            const actTotal = actSqft * halfArchRate;
            items.push({
              label: `${areaPrefix}Above Ceiling Tiles (${actSqft.toLocaleString()} sqft @ $${halfArchRate.toFixed(3)}/sqft)`,
              value: actTotal,
              editable: true,
              upteamCost: actTotal * UPTEAM_MULTIPLIER_FALLBACK,
            });
            otherDisciplinesTotal += actTotal;
            upteamCost += actTotal * UPTEAM_MULTIPLIER_FALLBACK;
          }
        }

        // Below Floor
        if (area.includeBelowFloor && area.belowFloorSqft) {
          const bfSqft = parseInt(area.belowFloorSqft) || 0;
          if (bfSqft > 0) {
            const bfTotal = bfSqft * halfArchRate;
            items.push({
              label: `${areaPrefix}Below Floor (${bfSqft.toLocaleString()} sqft @ $${halfArchRate.toFixed(3)}/sqft)`,
              value: bfTotal,
              editable: true,
              upteamCost: bfTotal * UPTEAM_MULTIPLIER_FALLBACK,
            });
            otherDisciplinesTotal += bfTotal;
            upteamCost += bfTotal * UPTEAM_MULTIPLIER_FALLBACK;
          }
        }
      }
    });

    const baseSubtotal = archBaseTotal + otherDisciplinesTotal;

    if (baseSubtotal > 0) {
      items.push({
        label: "Base Subtotal",
        value: baseSubtotal,
        editable: false,
      });
    }

    let archAfterRisk = archBaseTotal;
    if (risks.length > 0) {
      risks.forEach((risk) => {
        let riskPercent = 0.15; // Default: Occupied
        if (risk === "hazardous") {
          riskPercent = 0.25;
        } else if (risk === "noPower") {
          riskPercent = 0.20;
        }

        const premium = archBaseTotal * riskPercent;
        archAfterRisk += premium;

        const riskLabel = risk === "occupied" ? "Occupied" : risk === "hazardous" ? "Hazardous" : "No Power";
        items.push({
          label: `Risk Premium - ${riskLabel} (+${Math.round(riskPercent * 100)}% on Architecture)`,
          value: premium,
          editable: true,
        });
      });
    }

    let runningTotal = archAfterRisk + otherDisciplinesTotal;

    // Handle travel cost - custom override takes precedence
    if (customTravelCost !== null) {
      // Use custom travel cost
      items.push({
        label: `Travel (Custom Override)`,
        value: customTravelCost,
        editable: true,
      });
      runningTotal += customTravelCost;
    } else if (distanceCalculated && distance && distance > 0) {
      // Calculate standard sqft and landscape acres separately
      const standardSqft = areas.reduce((sum, area) => {
        const isLandscape = area.buildingType === "14" || area.buildingType === "15";
        if (isLandscape) return sum;
        const inputValue = parseInt(area.squareFeet) || 0;
        return sum + inputValue;
      }, 0);
      const landscapeAcres = areas.reduce((sum, area) => {
        const isLandscape = area.buildingType === "14" || area.buildingType === "15";
        if (!isLandscape) return sum;
        const inputValue = parseFloat(area.squareFeet) || 0;
        return sum + inputValue;
      }, 0);

      // Scan days: 10,000 sqft/day for standard + 5 acres/day for landscape
      const standardScanDays = Math.ceil(standardSqft / 10000);
      const landscapeScanDays = Math.ceil(landscapeAcres / 5);
      const estimatedScanDays = Math.max(1, standardScanDays + landscapeScanDays);

      // Total sqft for tier calculations (landscape converted to sqft equivalent)
      const totalSqft = standardSqft + Math.round(landscapeAcres * 43560);

      let travelCost = 0;
      let travelLabel = "";

      if (dispatch === "brooklyn") {
        // Brooklyn dispatch: tiered base pricing based on project size
        // Tier C: 0-9,999 sqft = $150 base
        // Tier B: 10,000-49,999 sqft = $300 base
        // Additional $4/mile for distances over 20 miles
        const isTierB = totalSqft >= 10000 && totalSqft < 50000;
        const isTierC = totalSqft < 10000;
        const baseTravelCost = isTierB ? 300 : (isTierC ? 150 : 0);
        const tierLabel = isTierB ? "Tier B" : (isTierC ? "Tier C" : "Tier A");

        travelCost = baseTravelCost;

        if (distance > 20) {
          const extraMiles = distance - 20;
          const extraMilesCost = extraMiles * 4;
          travelCost += extraMilesCost;
          travelLabel = `Travel - Brooklyn ${tierLabel} ($${baseTravelCost} base + ${extraMiles} mi @ $4/mi)`;
        } else {
          travelLabel = `Travel - Brooklyn ${tierLabel} ($${baseTravelCost} base)`;
        }
      } else {
        // Non-Brooklyn dispatch: standard per-mile rate
        const ratePerMile = 3;
        travelCost = distance * ratePerMile;

        if (distance > 75 && estimatedScanDays >= 2) {
          travelCost += 300 * estimatedScanDays;
          travelLabel = `Travel (${distance} mi @ $${ratePerMile}/mi + ${estimatedScanDays} scan-days @ $300/day)`;
        } else {
          travelLabel = `Travel (${distance} mi @ $${ratePerMile}/mi)`;
        }
      }

      items.push({
        label: travelLabel,
        value: travelCost,
        editable: true,
      });
      runningTotal += travelCost;
    }

    Object.entries(services).forEach(([serviceId, quantity]) => {
      if (quantity > 0) {
        const serviceRates: Record<string, number> = {
          georeferencing: 1000,
          expeditedService: 0,
          actSqft: 5,
          scanningFullDay: 2500,
          scanningHalfDay: 1500,
        };

        let total = 0;
        let label = "";
        let serviceUpteamCost = 0;

        if (serviceId === "actSqft") {
          total = quantity * serviceRates[serviceId];
          label = `ACT Modeling ($5/sqft × ${quantity.toLocaleString()} sqft)`;
          serviceUpteamCost = total * UPTEAM_MULTIPLIER_FALLBACK; // Real modeling cost
          upteamCost += serviceUpteamCost;
        } else if (serviceId === "georeferencing") {
          total = 1000;
          label = `Georeferencing`;
          serviceUpteamCost = total * UPTEAM_MULTIPLIER_FALLBACK; // Real service cost
          upteamCost += serviceUpteamCost;
        } else if (serviceId === "scanningFullDay") {
          total = 2500;
          label = `Scanning & Registration - Full Day`;
          serviceUpteamCost = total * UPTEAM_MULTIPLIER_FALLBACK; // Real scanning cost
          upteamCost += serviceUpteamCost;
        } else if (serviceId === "scanningHalfDay") {
          total = 1500;
          label = `Scanning & Registration - Half Day`;
          serviceUpteamCost = total * UPTEAM_MULTIPLIER_FALLBACK; // Real scanning cost
          upteamCost += serviceUpteamCost;
        } else if (serviceId === "expeditedService") {
          total = runningTotal * 0.20;
          label = `Expedited Service (+20% of total)`;
          // Don't add to upteam - this is pure markup, serviceUpteamCost stays 0
        }

        if (total > 0) {
          items.push({
            label,
            value: total,
            editable: true,
            upteamCost: serviceUpteamCost > 0 ? serviceUpteamCost : undefined,
          });
          runningTotal += total;
        }
      }
    });

    // CAD Deliverable pricing (per area)
    const CAD_MINIMUM = 300;
    areas.forEach((area) => {
      if (!area.includeCad) return;

      const isLandscape = area.buildingType === "14" || area.buildingType === "15";
      if (isLandscape) return; // CAD not available for landscape

      const sqft = Math.max(parseInt(area.squareFeet) || 0, 3000);
      const disciplineCount = area.disciplines.filter(d => d !== "matterport").length;

      // Get CAD rate per sqft from database
      let cadRatePerSqft = getCadPricingRate(area.buildingType, sqft, disciplineCount);
      let cadBaseTotal = 0;
      let usedFallback = false;

      if (cadRatePerSqft > 0) {
        cadBaseTotal = sqft * cadRatePerSqft;
      } else {
        // Fallback rates if database not available
        cadRatePerSqft = disciplineCount >= 3 ? 0.14 : (disciplineCount === 2 ? 0.11 : 0.10);
        cadBaseTotal = sqft * cadRatePerSqft;
        usedFallback = true;
      }

      // Check if minimum applies
      const minimumApplied = cadBaseTotal < CAD_MINIMUM;

      // Apply $300 minimum
      cadBaseTotal = Math.max(cadBaseTotal, CAD_MINIMUM);

      // Calculate additional elevations/sections
      const additionalElevationsTotal = calculateAdditionalElevationsPrice(area.additionalElevations || 0);

      const totalCadCost = cadBaseTotal + additionalElevationsTotal;
      const cadUpteamCost = totalCadCost * UPTEAM_MULTIPLIER_FALLBACK;
      upteamCost += cadUpteamCost;

      const packageType = area.scope === "interior" ? "Interior Package" : "Standard Package";
      const areaName = area.name || `Area`;

      // Build label with rate info
      let cadLabel = `CAD Conversion - ${areaName} (${packageType})`;
      if (minimumApplied) {
        cadLabel += ` - $${CAD_MINIMUM} minimum`;
      } else {
        cadLabel += ` @ $${cadRatePerSqft.toFixed(2)}/sqft × ${sqft.toLocaleString()} sqft`;
      }

      if (area.additionalElevations > 0) {
        cadLabel += ` + ${area.additionalElevations} add'l elevations`;
      }

      items.push({
        label: cadLabel,
        value: totalCadCost,
        editable: true,
        upteamCost: cadUpteamCost,
      });
      runningTotal += totalCadCost;
    });

    if (scopingData.paymentTerms) {
      let percentage = 0;
      if (scopingData.paymentTerms === "net30") percentage = 0.05;
      else if (scopingData.paymentTerms === "net60") percentage = 0.10;
      else if (scopingData.paymentTerms === "net90") percentage = 0.15;

      if (percentage > 0) {
        const paymentTermAdjustment = runningTotal * percentage;
        items.push({
          label: `Payment Terms Adjustment (+${Math.round(percentage * 100)}%)`,
          value: paymentTermAdjustment,
          editable: true,
        });
        runningTotal += paymentTermAdjustment;
      }
    }

    if (items.length > 0) {
      items.push({
        label: "Grand Total",
        value: runningTotal,
        editable: true,
        isTotal: true,
      });

      // Effective price per sqft - exclude landscape areas (they're priced per acre)
      const standardSqftForEffective = areas.reduce((sum, area) => {
        const isLandscape = area.buildingType === "14" || area.buildingType === "15";
        if (isLandscape) return sum; // Exclude landscape from effective $/sqft
        const inputValue = parseInt(area.squareFeet) || 0;
        return sum + inputValue;
      }, 0);
      if (standardSqftForEffective > 0) {
        const effectivePricePerSqft = runningTotal / standardSqftForEffective;
        items.push({
          label: `Effective Price per Sq Ft (${standardSqftForEffective.toLocaleString()} sqft)`,
          value: effectivePricePerSqft,
          editable: false,
        });
      }
    }

    return { items, clientTotal: runningTotal, upteamCost };
  };

  const pricingData = calculatePricing();
  const pricingItems = pricingData.items;

  // Autosave hook - getQuoteData callback to access current state
  const getQuoteData = useCallback(() => {
    const totalItem = pricingItems.find(item => item.isTotal);
    const totalPrice = totalItem ? totalItem.value.toFixed(2) : "0.00";

    return {
      projectName: projectDetails.projectName,
      clientName: projectDetails.clientName,
      projectAddress: projectDetails.projectAddress,
      specificBuilding: projectDetails.specificBuilding,
      typeOfBuilding: projectDetails.typeOfBuilding,
      hasBasement: projectDetails.hasBasement,
      hasAttic: projectDetails.hasAttic,
      notes: projectDetails.notes,
      leadId: leadId || null,
      scopingMode,
      areas,
      risks,
      dispatchLocation: dispatch,
      distance,
      customTravelCost: customTravelCost?.toString() || null,
      services,
      scopingData: scopingMode ? scopingData : null,
      totalPrice,
      pricingBreakdown: {
        items: pricingItems.map(item => ({
          label: item.label,
          value: item.value,
          isTotal: item.isTotal || false,
          isDiscount: item.isDiscount || false,
        })),
      },
    };
  }, [projectDetails, leadId, scopingMode, areas, risks, dispatch, distance, customTravelCost, services, scopingData, pricingItems]);

  const autosave = useQuoteAutosave({
    quoteId,
    leadId,
    debounceMs: 2000,
    enabled: isEmbedded && !isLoadingQuote && !isLoadingPricing,
    getQuoteData,
    onQuoteSaved: (savedQuoteId) => {
      if (onQuoteSaved) {
        onQuoteSaved(savedQuoteId);
      }
    },
  });

  if (isLoadingQuote || isLoadingPricing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "" : "min-h-screen bg-background"}>
      <div className={isEmbedded ? "px-5 py-4" : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"}>
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">{quoteId || autosave.currentQuoteId ? "Edit Quote" : "Create Quote"}</h1>
              <p className="text-muted-foreground text-sm">
                Build a comprehensive pricing quote for your Scan-to-BIM project
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tier A Toggle */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/50">
                <Switch
                  id="tier-a-toggle"
                  checked={tierAEnabled}
                  onCheckedChange={setTierAEnabled}
                />
                <Label htmlFor="tier-a-toggle" className="text-sm cursor-pointer font-medium">
                  Tier A
                </Label>
              </div>
              {isEmbedded && (
                <>
                  <AutosaveStatus
                    status={autosave.status}
                    error={autosave.error}
                    onRetry={autosave.retry}
                  />
                  {autosave.lastSavedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last saved {autosave.lastSavedAt.toLocaleTimeString()}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {quoteId && (
          <div className="mb-6">
            <VersionControl
              currentQuoteId={quoteId}
              onVersionSelect={(newQuoteId) => {
                if (onVersionSelect) {
                  onVersionSelect(newQuoteId);
                } else {
                  setLocation(`/calculator/${newQuoteId}`);
                }
              }}
            />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3 w-full">
          <div className="lg:col-span-2 space-y-5">
            {/* QUOTE SECTION */}
            <div className="rounded-lg bg-blue-50/30 dark:bg-blue-950/10 p-5 space-y-5">
              <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">Quote</h2>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Project Areas</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addArea}
                    data-testid="button-add-area"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Area
                  </Button>
                </div>
                {areas.map((area, index) => (
                  <AreaInput
                    key={area.id}
                    area={area}
                    areas={areas}
                    index={index}
                    onChange={handleAreaChange}
                    onDisciplineChange={handleAreaDisciplineChange}
                    onLodChange={handleAreaLodChange}
                    onRemove={removeArea}
                    canRemove={areas.length > 1}
                  />
                ))}
              </div>

              <Separator />

              <RiskFactors selectedRisks={risks} onRiskChange={handleRiskChange} />

              <Separator />

              <TravelCalculator
                dispatchLocation={dispatch}
                projectAddress={projectDetails.projectAddress}
                distance={distance}
                isCalculating={isCalculatingDistance}
                customTravelCost={customTravelCost}
                onDispatchChange={setDispatch}
                onAddressChange={(val) => handleProjectDetailChange("projectAddress", val as string)}
                onCalculate={handleCalculateDistance}
                onCustomTravelCostChange={setCustomTravelCost}
              />

              <Separator />

              <AdditionalServices services={services} onServiceChange={handleServiceChange} />
            </div>

            {/* INTERNAL PRICING SECTION */}
            <div className="rounded-lg bg-amber-50/30 dark:bg-amber-950/10 p-5 space-y-5">
              <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100">Internal Pricing</h2>

              <CRMFields data={scopingData} onChange={handleScopingDataChange} />
            </div>

            {/* Export buttons hidden - will be re-enabled later */}
          </div>

          <div className="lg:col-span-1">
            <PricingSummary
              items={pricingItems}
              onEdit={(i, v) => console.log(`Edit ${i}: ${v}`)}
              totalClientPrice={pricingData.clientTotal}
              totalUpteamCost={pricingData.upteamCost}
            />
          </div>
        </div>
      </div>
    </div>
  );
}



