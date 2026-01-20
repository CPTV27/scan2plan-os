/**
 * Proposal Content Repository
 * Gold Standard boilerplate text for Smart Proposal Builder
 */

export const MARKETING_COPY = {
  aboutUs: "We began in 2018 with a simple goal of helping firms focus on design. We're an on-demand LiDAR to BIM/CAD team that can model any building in weeks. We've scanned over 1,000 buildings (~10M sqft).",
  theDifference: [
    {
      title: "Terrestrial LiDAR Only",
      body: "While others use Drones or iPhone LiDAR, we work exclusively with the Trimble X7 on every project to guarantee millimeter accuracy from 0\" to 1/8\".",
    },
    {
      title: "No AI in the Model",
      body: "We take a 100% manual approach. For detailed MEP/Structural work, we rely on human experts, not algorithms, to ensure perfect interpretation.",
    },
    {
      title: "Rigorous QC",
      body: "Our dedicated QC team double and triple checks every deliverable. This adds a few days to delivery but saves you weeks of headaches.",
    }
  ],
  tagline: "Professional Laser Scanning & BIM Services",
  companyName: "SCAN2PLAN",
};

export const SCOPE_TEMPLATES = {
  standard_scan: "A scanning technician will capture the [SCOPE] LiDAR point cloud using Trimble X7 equipment. Data will be registered, cleaned, and reviewed for QA before handoff to the modeling team.",
  exterior_scan: "A scanning technician will capture the EXTERIOR LiDAR point cloud. Data will be registered, cleaned, and reviewed for QA.",
  interior_scan: "A scanning technician will capture the INTERIOR LiDAR point cloud. Data will be registered, cleaned, and reviewed for QA.",
  full_building_scan: "A scanning technician will capture the FULL BUILDING (Interior + Exterior) LiDAR point cloud. Data will be registered, cleaned, and reviewed for QA.",
  lod_200_model: "Revit Model (LoD 200). Approximate geometry for design reference. Elements modeled with generic system families.",
  lod_300_model: "Revit Model (LoD 300). Accurate geometry for coordination. All elements modeled in the 'Existing' phase. Facade geometry joined. Changes in material noted.",
  lod_350_model: "Revit Model (LoD 350). Precise geometry suitable for construction documentation. Includes detailed connections, exposed MEPF, and structural framing.",
  cad_package: "Pristine CAD drawings converted from Revit. Includes Floor Plans, Exterior Elevations, Roof Plan, and up to 4 Interior Sections.",
  point_cloud_only: "Registered point cloud deliverable in E57 and RCP formats. Cloud-to-cloud alignment with target-based registration where applicable.",
  matterport: "Matterport 3D virtual tour capture for stakeholder walkthroughs and remote collaboration.",
};

export const PAYMENT_TERMS = {
  deposit: "50% of the estimated cost is due upon engagement.",
  final: "The outstanding balance is due upon delivery, determined by the actual square footage scanned (BOMA Gross Area Standard).",
  methods: ["ACH (Preferred)", "Check (Mailed to 188 1st St, Troy, NY)"],
  validity: "This proposal is valid for 30 days from the date of issue.",
  warranty: "Scan2Plan warrants all deliverables meet the specified Level of Detail (LOD) and Level of Accuracy (LoA) standards.",
};

export const BIM_MATRIX = {
  exterior_arch: {
    walls: { lod200: true, lod300: true, lod350: true, notes: "Default Revit wall profile" },
    storefront: { lod200: true, lod300: true, lod350: true, notes: "Mullions included" },
    windows: { lod200: true, lod300: true, lod350: true, notes: "Generic families" },
    doors: { lod200: true, lod300: true, lod350: true, notes: "Standard swing doors" },
    roof: { lod200: "Default", lod300: "Sloped at drain", lod350: "In-situ depressions" },
    parapet: { lod200: true, lod300: true, lod350: true, notes: "Coping profile included" },
  },
  interior_arch: {
    walls: { lod200: true, lod300: true, lod350: true, notes: "As-built thickness" },
    ceilings: { lod200: "Flat", lod300: "Height variations", lod350: "Soffits & bulkheads" },
    floors: { lod200: true, lod300: true, lod350: true, notes: "Finish floor elevation" },
    stairs: { lod200: "Generic", lod300: "Accurate run/rise", lod350: "Handrail detail" },
    millwork: { lod200: false, lod300: "Major only", lod350: true, notes: "Built-ins, cabinets" },
  },
  structural: {
    columns: { lod200: "Placeholder", lod300: true, lod350: true, notes: "Steel/concrete shapes" },
    beams: { lod200: false, lod300: true, lod350: true, notes: "Visible only" },
    bracing: { lod200: false, lod300: false, lod350: true, notes: "If exposed" },
    foundations: { lod200: false, lod300: false, lod350: "If visible", notes: "Above grade only" },
  },
  mep: {
    ducts: { lod200: false, lod300: true, lod350: true, notes: "Size > 8\"" },
    pipes: { lod200: false, lod300: "Size > 2\"", lod350: "Size > 1\"", notes: "Hangers in 350" },
    conduit: { lod200: false, lod300: "Bundles", lod350: "Individual runs", notes: "If exposed" },
    equipment: { lod200: "Placeholder", lod300: true, lod350: true, notes: "AHU, RTU, panels" },
    fixtures: { lod200: false, lod300: "Plumbing", lod350: true, notes: "Light fixtures in 350" },
  },
};

export const DELIVERABLES_TEXT: Record<string, string> = {
  revit: "Revit Model (.rvt) - Native Autodesk Revit format with coordinated views",
  archicad: "ArchiCAD Model (.pln) - Native Graphisoft format",
  autocad: "AutoCAD Drawings (.dwg) - 2D floor plans, elevations, sections",
  pointcloud: "Point Cloud Data (.e57, .rcp) - Registered scan data",
  navisworks: "Navisworks Model (.nwd) - Federated model for coordination",
  ifc: "IFC Export (.ifc) - Open BIM format for interoperability",
};

export const getDeliverableDescription = (deliverable: string): string => {
  const key = deliverable.toLowerCase().replace(/\s+/g, '');
  return DELIVERABLES_TEXT[key] || `${deliverable} - Standard format delivery`;
};

export const getScopeDescription = (scope: string, lod: string): string => {
  const templates: string[] = [];
  
  if (scope === "Full Building") {
    templates.push(SCOPE_TEMPLATES.full_building_scan);
  } else if (scope === "Interior Only") {
    templates.push(SCOPE_TEMPLATES.interior_scan);
  } else if (scope === "Exterior Only") {
    templates.push(SCOPE_TEMPLATES.exterior_scan);
  } else {
    templates.push(SCOPE_TEMPLATES.standard_scan.replace("[SCOPE]", scope));
  }
  
  if (lod === "LOD 200") {
    templates.push(SCOPE_TEMPLATES.lod_200_model);
  } else if (lod === "LOD 300") {
    templates.push(SCOPE_TEMPLATES.lod_300_model);
  } else if (lod === "LOD 350") {
    templates.push(SCOPE_TEMPLATES.lod_350_model);
  }
  
  return templates.join("\n\n");
};
