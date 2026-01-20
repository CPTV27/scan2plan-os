import { log } from "../lib/logger";

export const cpqService = {
  normalizeQuoteData(data: any): any {
    const normalized = { ...data };
    
    if (normalized.travel && typeof normalized.travel.dispatchLocation === 'string') {
      normalized.travel = {
        ...normalized.travel,
        dispatchLocation: normalized.travel.dispatchLocation.toUpperCase(),
      };
    }
    
    if (typeof normalized.dispatchLocation === 'string') {
      normalized.dispatchLocation = normalized.dispatchLocation.toUpperCase();
    }
    
    if (Array.isArray(normalized.areas)) {
      normalized.areas = normalized.areas.map((area: any) => {
        const buildingType = String(area.buildingType || '');
        const isLandscape = buildingType === '14' || buildingType === '15' || 
                           buildingType === 'landscape_built' || buildingType === 'landscape_natural';
        return {
          ...area,
          kind: area.kind || (isLandscape ? 'landscape' : 'standard'),
        };
      });
    }
    
    return normalized;
  },

  isLandscapeBuildingType(buildingType: string): boolean {
    return buildingType === '14' || buildingType === '15' || 
           buildingType === 'landscape_built' || buildingType === 'landscape_natural';
  },
};
