import type { MissionBrief } from '../shared/missionBrief';

const BUILDING_TYPE_NAMES: Record<string, string> = {
  "1": "Residential - Single Family",
  "2": "Residential - Multi Family",
  "3": "Residential - Luxury",
  "4": "Commercial / Office",
  "5": "Retail / Restaurant",
  "6": "Kitchen / Catering",
  "7": "Education",
  "8": "Hotel / Theatre / Museum",
  "9": "Hospital / Mixed Use",
  "10": "Mechanical / Utility",
  "11": "Warehouse / Storage",
  "12": "Religious Building",
  "13": "Infrastructure / Roads",
  "14": "Built Landscape",
  "15": "Natural Landscape",
  "16": "ACT (Above Ceiling)",
};

const RISK_LABELS: Record<string, string> = {
  "occupied": "Occupied Building",
  "hazardous": "Hazardous Conditions",
  "noPower": "No Power/HVAC",
  "remote": "Remote Location",
  "fastTrack": "Fast Track",
  "complexGeometry": "Complex Geometry",
  "difficultAccess": "Difficult Access",
  "multiPhase": "Multi-Phase",
  "unionSite": "Union Site",
  "security": "Security Requirements",
  "revisions": "Multiple Revisions Expected",
  "coordination": "Complex Coordination",
  "incomplete": "Incomplete Information",
  "difficult": "Difficult Conditions",
};

// Helper to coerce string/boolean values to boolean
function toBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1' || val === 'yes';
  return !!val;
}

// Unwrap nested 'lead' container if present
function unwrapLeadContainer(data: any): any {
  if (!data) return {};
  // Check if data is wrapped in a 'lead' key
  if (data.lead && typeof data.lead === 'object') {
    return { ...data, ...data.lead };
  }
  return data;
}

export function generateMissionBrief(project: any): MissionBrief {
  // Synthesize data from multiple sources in order of priority:
  // 1. quotedAreas/quotedServices/quotedRisks (from closed deals)
  // 2. liveScopingData (active scoping)
  // 3. scopingData (legacy scoping)
  // 4. Project-level fallbacks
  // 
  // Note: liveScopingData and scopingData may have data nested under 'lead' key
  const liveScopingData = unwrapLeadContainer(project.liveScopingData || {});
  const scopingData = unwrapLeadContainer(project.scopingData || {});
  
  // Synthesize areas from multiple sources
  let areas = project.quotedAreas || [];
  if (areas.length === 0 && liveScopingData.areas) {
    areas = liveScopingData.areas;
  }
  if (areas.length === 0 && scopingData.areas) {
    areas = scopingData.areas;
  }
  
  // Final fallback: create a single area from project-level data
  if (areas.length === 0 && (project.estimatedSqft || project.actualSqft)) {
    areas = [{
      name: project.name || 'Project Area',
      squareFeet: project.actualSqft || project.estimatedSqft,
      buildingType: project.buildingType || '4',
      scope: 'full',
      disciplines: [],
    }];
  }

  // Synthesize site readiness from multiple sources
  const siteReadiness = project.siteReadiness 
    || liveScopingData.siteReadiness 
    || scopingData.siteReadiness 
    || {};
  
  // Synthesize services from multiple sources with boolean coercion
  const rawServices = project.quotedServices 
    || liveScopingData.services 
    || scopingData.services 
    || {};
  
  // Synthesize risks from multiple sources - handle both array and object formats
  let rawRisks = project.quotedRisks 
    || liveScopingData.risks 
    || scopingData.risks 
    || [];
  
  // Normalize risks: convert object map to array of keys where value is truthy
  let risks: string[] = [];
  if (Array.isArray(rawRisks)) {
    risks = rawRisks;
  } else if (rawRisks && typeof rawRisks === 'object') {
    risks = Object.keys(rawRisks).filter(k => toBool(rawRisks[k]));
  }

  const totalSqft = areas.reduce((sum: number, area: any) => {
    const sqft = parseInt(area.squareFeet) || parseInt(area.sqft) || 0;
    return sum + sqft;
  }, 0) || project.actualSqft || project.estimatedSqft || 0;

  const mappedAreas = areas.map((area: any, index: number) => {
    let maxLod = "200";
    if (area.disciplineLods) {
      const lods = Object.values(area.disciplineLods).map((d: any) => {
        // Handle nested discipline objects with lod property
        if (typeof d === 'object' && d !== null) {
          return parseInt(d.lod) || 200;
        }
        return parseInt(d) || 200;
      });
      maxLod = String(Math.max(...lods));
    } else if (area.lod) {
      maxLod = area.lod;
    }

    // Extract disciplines - handle both array and object formats
    let disciplines: string[] = [];
    if (Array.isArray(area.disciplines)) {
      disciplines = area.disciplines;
    } else if (area.disciplines && typeof area.disciplines === 'object') {
      // Handle object format where disciplines are keys with boolean values
      disciplines = Object.keys(area.disciplines).filter(k => toBool(area.disciplines[k]));
    }

    // Safe building type label with fallback
    const buildingTypeKey = String(area.buildingType || '');
    const buildingTypeName = BUILDING_TYPE_NAMES[buildingTypeKey] 
      || (typeof area.buildingType === 'string' && area.buildingType.length > 2 ? area.buildingType : null)
      || 'Commercial / Office';

    return {
      name: area.name || `Area ${index + 1}`,
      buildingType: buildingTypeName,
      sqft: parseInt(area.squareFeet) || parseInt(area.sqft) || 0,
      disciplines,
      lod: maxLod,
      scope: area.scope,
    };
  });

  const riskLabels = (Array.isArray(risks) ? risks : [])
    .map((r: string) => RISK_LABELS[r] || r)
    .filter(Boolean);

  // Coerce site readiness - some fields are booleans, some are strings per MissionBrief interface
  const siteConditions = {
    occupied: siteReadiness.occupied != null ? toBool(siteReadiness.occupied) : null,
    accessRestrictions: siteReadiness.accessRestrictions || null,
    dropCeilings: siteReadiness.dropCeilings != null ? String(siteReadiness.dropCeilings) : null,
    hazardousMaterials: siteReadiness.hazardousMaterials != null ? String(siteReadiness.hazardousMaterials) : null,
    activeConstruction: siteReadiness.activeConstruction != null ? toBool(siteReadiness.activeConstruction) : null,
    parkingAccess: siteReadiness.parkingAccess || null,
    additionalNotes: siteReadiness.additionalNotes || null,
  };

  // Get configured equipment from project
  const configuredEquipment = {
    scannerType: project.scannerType || 'trimble_x7',
    matterportRequired: toBool(project.matterportRequired),
    droneRequired: toBool(project.droneRequired),
    extensionTripodNeeded: toBool(project.extensionTripodNeeded),
  };

  const suggestedEquipment = deriveSuggestedEquipment(mappedAreas, rawServices, siteConditions, configuredEquipment);

  const estimatedDriveTime = project.distance 
    ? `~${Math.ceil(project.distance / 50)} hours` 
    : null;

  return {
    projectId: project.id,
    universalProjectId: project.universalProjectId || '',
    generatedAt: new Date(),

    projectAddress: project.projectAddress || '',
    clientName: project.clientName || '',
    projectName: project.name || '',

    contact: {
      name: project.clientContact || '',
      phone: project.clientPhone || '',
      email: project.clientEmail || '',
    },

    dispatchLocation: project.dispatchLocation || '',
    distance: project.distance ?? null,
    estimatedDriveTime,

    scopeSummary: project.scopeSummary || scopingData.summary || liveScopingData.summary || generateDefaultScopeSummary(project, areas),
    totalSqft,
    areaCount: areas.length,

    areas: mappedAreas,
    siteConditions,
    risks: riskLabels,

    requirements: {
      actScanning: toBool(rawServices.actScanning),
      georeferencing: toBool(rawServices.georeferencing),
      matterport: toBool(rawServices.matterport),
      scanningOnly: rawServices.scanningOnly || null,
    },

    suggestedEquipment,
    projectNotes: project.notes || null,
  };
}

function generateDefaultScopeSummary(project: any, areas: any[]): string {
  if (areas.length === 0) {
    return project.name ? `Scan job for ${project.name}` : 'Standard scan job';
  }
  
  const totalSqft = areas.reduce((sum: number, a: any) => sum + (parseInt(a.squareFeet) || parseInt(a.sqft) || 0), 0);
  const areaNames = areas.slice(0, 3).map((a: any, i: number) => a.name || `Area ${i + 1}`);
  const areaList = areaNames.join(', ') + (areas.length > 3 ? ` (+${areas.length - 3} more)` : '');
  
  return `${totalSqft.toLocaleString()} sqft across ${areas.length} area${areas.length > 1 ? 's' : ''}: ${areaList}`;
}

interface ConfiguredEquipment {
  scannerType: string;
  matterportRequired: boolean;
  droneRequired: boolean;
  extensionTripodNeeded: boolean;
}

const SCANNER_NAMES: Record<string, string> = {
  'trimble_x7': 'Trimble X7',
  'navvis_slam': 'NavVis SLAM',
};

function deriveSuggestedEquipment(
  areas: any[], 
  services: any, 
  siteConditions: any,
  configured: ConfiguredEquipment
): string[] {
  const equipment: string[] = [];

  // Primary scanner from configuration
  const scannerName = SCANNER_NAMES[configured.scannerType] || 'Trimble X7';
  equipment.push(`${scannerName} (Primary Scanner)`);
  
  // Standard tripod or extension tripod based on configuration
  if (configured.extensionTripodNeeded) {
    equipment.push("Extension Tripod (High-reach)");
  } else {
    equipment.push("Standard Tripod");
  }
  
  equipment.push("Targets (minimum 6)");
  equipment.push("Tablet with field software");

  // Matterport from configuration (takes priority over services)
  if (configured.matterportRequired || toBool(services.matterport)) {
    equipment.push("Matterport Pro2 or Pro3");
  }

  // Drone from configuration
  if (configured.droneRequired) {
    equipment.push("Drone (aerial capture)");
    equipment.push("Drone batteries (2+)");
    equipment.push("Drone controller");
  }

  if (toBool(services.actScanning)) {
    equipment.push("Ladder (8ft minimum)");
    equipment.push("Ceiling tile lifter");
    equipment.push("Flashlight / headlamp");
  }

  const totalSqft = areas.reduce((sum, a) => sum + (a.sqft || 0), 0);
  if (totalSqft > 50000) {
    equipment.push("Extra batteries (2+)");
    equipment.push("Backup SD cards");
  }

  if (siteConditions.occupied === false) {
    equipment.push("Portable power bank");
    equipment.push("Battery-powered lights");
  }

  const hasExterior = areas.some(a => 
    a.scope === 'exterior' || 
    a.disciplines?.includes('site') ||
    a.buildingType?.includes('Landscape')
  );
  if (hasExterior) {
    equipment.push("GPS unit");
    equipment.push("Survey stakes / markers");
  }

  if (toBool(services.georeferencing)) {
    equipment.push("Control points / monuments");
    equipment.push("GPS receiver");
  }

  return Array.from(new Set(equipment));
}
