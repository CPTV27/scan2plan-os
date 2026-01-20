export interface MissionBrief {
  projectId: number;
  universalProjectId: string;
  generatedAt: Date;
  
  projectAddress: string;
  clientName: string;
  projectName: string;
  
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  
  dispatchLocation: string;
  distance: number | null;
  estimatedDriveTime: string | null;
  
  scopeSummary: string;
  totalSqft: number;
  areaCount: number;
  
  areas: {
    name: string;
    buildingType: string;
    sqft: number;
    disciplines: string[];
    lod: string;
    scope?: string;
  }[];
  
  siteConditions: {
    occupied: boolean | null;
    accessRestrictions: string | null;
    dropCeilings: string | null;
    hazardousMaterials: string | null;
    activeConstruction: boolean | null;
    parkingAccess: string | null;
    additionalNotes: string | null;
  };
  
  risks: string[];
  
  requirements: {
    actScanning: boolean;
    georeferencing: boolean;
    matterport: boolean;
    scanningOnly: string | null;
  };
  
  suggestedEquipment: string[];
  
  projectNotes: string | null;
}
