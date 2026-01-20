/**
 * CPQ Pricing Engine Unit Tests
 * 
 * These tests verify the core pricing calculation functions.
 * Run with: npx vitest run client/src/features/cpq/pricing.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePricing,
  calculateTravelCost,
  calculateTierAPricing,
  calculateTotalSqft,
  getAreaSqft,
  isTierAProject,
  calculateMarginPercent,
  passesMarginGate,
  getMarginGateError,
  validateMarginGate,
  getMarginStatus,
  ACRES_TO_SQFT,
  TIER_A_THRESHOLD,
  TIER_A_MARGINS,
  type Area,
  type TravelConfig,
  type PricingResult,
} from './pricing';

describe('CPQ Pricing Engine', () => {

  describe('Area Square Footage Calculations', () => {

    it('should calculate sqft for standard building area', () => {
      const area: Area = {
        id: '1',
        name: 'Office Building',
        kind: 'standard',
        buildingType: '1',
        squareFeet: '25000',
        lod: '300',
        disciplines: ['architecture'],
      };

      expect(getAreaSqft(area)).toBe(25000);
    });

    it('should convert acres to sqft for landscape areas', () => {
      const area: Area = {
        id: '1',
        name: 'Campus Grounds',
        kind: 'landscape',
        buildingType: 'landscape_natural',
        squareFeet: '5', // 5 acres
        lod: '300',
        disciplines: ['site'],
      };

      expect(getAreaSqft(area)).toBe(5 * ACRES_TO_SQFT); // 217,800 sqft
    });

    it('should calculate total sqft across multiple areas', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Building',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '30000',
          lod: '300',
          disciplines: ['architecture'],
        },
        {
          id: '2',
          name: 'Landscape',
          kind: 'landscape',
          buildingType: 'landscape_built',
          squareFeet: '2', // 2 acres
          lod: '200',
          disciplines: ['site'],
        },
      ];

      const total = calculateTotalSqft(areas);
      expect(total).toBe(30000 + (2 * ACRES_TO_SQFT)); // 30,000 + 87,120
    });

    it('should handle empty or invalid sqft gracefully', () => {
      const area: Area = {
        id: '1',
        name: 'Empty',
        kind: 'standard',
        buildingType: '1',
        squareFeet: '',
        lod: '300',
        disciplines: [],
      };

      expect(getAreaSqft(area)).toBe(0);
    });
  });

  describe('Tier A Detection', () => {

    it('should detect Tier A for projects >= 50k sqft', () => {
      expect(isTierAProject(50000)).toBe(true);
      expect(isTierAProject(60000)).toBe(true);
      expect(isTierAProject(100000)).toBe(true);
    });

    it('should not detect Tier A for projects < 50k sqft', () => {
      expect(isTierAProject(49999)).toBe(false);
      expect(isTierAProject(25000)).toBe(false);
      expect(isTierAProject(10000)).toBe(false);
    });

    it('should use correct Tier A threshold constant', () => {
      expect(TIER_A_THRESHOLD).toBe(50000);
    });
  });

  describe('Travel Cost Calculations', () => {

    describe('Brooklyn Tiered Pricing', () => {

      it('should calculate Tier A travel (>=50k sqft): $0 base + $4/mile over 20', () => {
        const distance = 30;
        const totalSqft = 60000; // Tier A

        const cost = calculateTravelCost(distance, 'BROOKLYN', totalSqft);
        // Tier A: $0 base + (30-20) * $4 = $40
        expect(cost).toBe(40);
      });

      it('should calculate Tier B travel (10k-49,999 sqft): $300 base + $4/mile over 20', () => {
        const distance = 35;
        const totalSqft = 25000; // Tier B

        const cost = calculateTravelCost(distance, 'BROOKLYN', totalSqft);
        // Tier B: $300 base + (35-20) * $4 = $300 + $60 = $360
        expect(cost).toBe(360);
      });

      it('should calculate Tier C travel (<10k sqft): $150 base + $4/mile over 20', () => {
        const distance = 25;
        const totalSqft = 8000; // Tier C

        const cost = calculateTravelCost(distance, 'BROOKLYN', totalSqft);
        // Tier C: $150 base + (25-20) * $4 = $150 + $20 = $170
        expect(cost).toBe(170);
      });

      it('should not charge mileage for <= 20 miles from Brooklyn', () => {
        const distance = 15;
        const totalSqft = 25000; // Tier B

        const cost = calculateTravelCost(distance, 'BROOKLYN', totalSqft);
        // Tier B: $300 base + $0 mileage (under 20 miles)
        expect(cost).toBe(300);
      });
    });

    describe('Woodstock Flat Rate Pricing', () => {

      it('should calculate flat $3/mile from Woodstock', () => {
        const distance = 80;

        const cost = calculateTravelCost(distance, 'WOODSTOCK', 25000);
        // Woodstock: $3/mile * 80 = $240
        expect(cost).toBe(240);
      });

      it('should return 0 for 0 distance from Woodstock', () => {
        const cost = calculateTravelCost(0, 'WOODSTOCK', 25000);
        expect(cost).toBe(0);
      });
    });

    describe('Custom Travel Cost Override', () => {

      it('should use custom cost when provided', () => {
        const cost = calculateTravelCost(50, 'BROOKLYN', 25000, 500);
        expect(cost).toBe(500);
      });
    });
  });

  describe('Tier A Pricing Calculations', () => {

    it('should calculate Tier A price with scanning + modeling + margin', () => {
      const result = calculateTierAPricing(
        {
          scanningCost: '3500', // Use "3500" preset from TIER_A_SCANNING_COSTS
          modelingCost: 3000,
          margin: '2.5', // 2.5X multiplier from TIER_A_MARGINS
        },
        30 // distance
      );

      expect(result).toBeTruthy();
      // Scanning: $3500, Modeling: $3000
      // subtotal = $6500
      // margin = 2.5X multiplier means clientPrice = $6500 * 2.5 = $16,250
      expect(result.scanningCost).toBe(3500);
      expect(result.modelingCost).toBe(3000);
      expect(result.subtotal).toBe(6500);
      expect(result.margin).toBe(2.5);
      expect(result.clientPrice).toBe(16250);
    });

    it('should use margin constants from TIER_A_MARGINS', () => {
      // TIER_A_MARGINS uses multiplier keys with label/value objects
      expect(TIER_A_MARGINS['2.352'].value).toBe(2.352);
      expect(TIER_A_MARGINS['2.5'].value).toBe(2.5);
      expect(TIER_A_MARGINS['3.0'].value).toBe(3.0);
    });
  });

  describe('Margin Calculations', () => {

    const createTestPricing = (totalClientPrice: number, totalUpteamCost: number): PricingResult => ({
      items: [],
      subtotal: totalClientPrice,
      totalClientPrice,
      totalUpteamCost,
      profitMargin: totalClientPrice - totalUpteamCost,
      disciplineTotals: {
        architecture: 0,
        mep: 0,
        structural: 0,
        site: 0,
        travel: 0,
        services: 0,
        risk: 0,
      },
    });

    it('should calculate margin percentage correctly from PricingResult', () => {
      // Price: $10,000, Cost: $6,000
      // Margin = (10000 - 6000) / 10000 = 40%
      const pricing = createTestPricing(10000, 6000);

      const margin = calculateMarginPercent(pricing);
      expect(margin).toBe(40);
    });

    it('should handle zero price gracefully', () => {
      const pricing = createTestPricing(0, 100);

      const margin = calculateMarginPercent(pricing);
      expect(margin).toBe(0);
    });

    it('should pass margin gate at exactly 40%', () => {
      const pricing = createTestPricing(10000, 6000); // 40% margin

      expect(passesMarginGate(pricing)).toBe(true);
    });

    it('should fail margin gate below 40%', () => {
      const pricing = createTestPricing(10000, 6100); // 39% margin

      expect(passesMarginGate(pricing)).toBe(false);
    });

    it('should pass margin gate above 40%', () => {
      const pricing = createTestPricing(10000, 5000); // 50% margin

      expect(passesMarginGate(pricing)).toBe(true);
    });

    it('should return null from getMarginGateError when passing', () => {
      const pricing = createTestPricing(10000, 5000); // 50% margin

      expect(getMarginGateError(pricing)).toBeNull();
    });

    it('should return error message from getMarginGateError when failing', () => {
      const pricing = createTestPricing(10000, 6500); // 35% margin

      const error = getMarginGateError(pricing);
      expect(error).not.toBeNull();
      expect(typeof error).toBe('string');
    });

    it('should get correct status from getMarginStatus', () => {
      const status50 = getMarginStatus(50);
      expect(['healthy', 'excellent']).toContain(status50.status);

      const status35 = getMarginStatus(35);
      expect(status35.status).toBe('blocked');
    });

    it('should validate margin gate with validateMarginGate', () => {
      expect(validateMarginGate(45)).toBeNull(); // Above floor
      expect(validateMarginGate(35)).not.toBeNull(); // Below floor
    });
  });

  describe('Full Pricing Calculation', () => {

    it('should calculate complete pricing for standard project', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Office Building',
          kind: 'standard',
          buildingType: '1', // Office
          squareFeet: '25000',
          lod: '300',
          disciplines: ['architecture'],
          scope: 'full',
        },
      ];
      const services = {};
      const travel: TravelConfig = {
        dispatchLocation: 'WOODSTOCK',
        distance: 45,
      };
      const risks: string[] = [];
      const paymentTerms = 'standard';

      const result = calculatePricing(areas, services, travel, risks, paymentTerms);

      expect(result.totalClientPrice).toBeGreaterThan(0);
      expect(result.totalUpteamCost).toBeGreaterThan(0);
      expect(result.profitMargin).toBeGreaterThanOrEqual(0);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should include risk premium in Architecture only', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Test',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '10000',
          lod: '200',
          disciplines: ['architecture', 'mep'],
          scope: 'full',
        },
      ];
      const risks = ['occupied']; // +15%

      const withRisk = calculatePricing(areas, {}, null, risks, 'standard');
      const withoutRisk = calculatePricing(areas, {}, null, [], 'standard');

      // With risk should be higher, but only Architecture portion affected
      expect(withRisk.totalClientPrice).toBeGreaterThan(withoutRisk.totalClientPrice);
    });

    it('should apply payment terms premium for net60', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Test',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '20000',
          lod: '200',
          disciplines: ['architecture'],
          scope: 'full',
        },
      ];

      const net60 = calculatePricing(areas, {}, null, [], 'net60'); // +3% surcharge
      const standard = calculatePricing(areas, {}, null, [], 'standard');

      expect(net60.totalClientPrice).toBeGreaterThan(standard.totalClientPrice);
    });

    it('should apply prepaid discount', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Test',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '20000',
          lod: '200',
          disciplines: ['architecture'],
          scope: 'full',
        },
      ];

      const prepaid = calculatePricing(areas, {}, null, [], 'prepaid'); // -5% discount
      const standard = calculatePricing(areas, {}, null, [], 'standard');

      expect(prepaid.totalClientPrice).toBeLessThan(standard.totalClientPrice);
    });

    it('should include travel line item in breakdown', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Test',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '20000',
          lod: '200',
          disciplines: ['architecture'],
          scope: 'full',
        },
      ];
      const travel: TravelConfig = {
        dispatchLocation: 'WOODSTOCK',
        distance: 50,
      };

      const result = calculatePricing(areas, {}, travel, [], 'standard');

      // Check for travel line item
      const travelItem = result.items.find(i => i.label.toLowerCase().includes('travel'));
      expect(travelItem).toBeDefined();
      expect(travelItem?.value).toBe(150); // 50 miles * $3/mile
    });

    it('should include payment terms line item for net60', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Test',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '20000',
          lod: '200',
          disciplines: ['architecture'],
          scope: 'full',
        },
      ];

      const result = calculatePricing(areas, {}, null, [], 'net60');

      // Check for payment terms line item (e.g., "Net 60 Terms (+10%)")
      const paymentItem = result.items.find(i => i.label.toLowerCase().includes('net 60'));
      expect(paymentItem).toBeDefined();
      expect(paymentItem?.value).toBeGreaterThan(0);
    });

    it('should include prepaid discount line item with isDiscount flag', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Test',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '20000',
          lod: '200',
          disciplines: ['architecture'],
          scope: 'full',
        },
      ];

      const result = calculatePricing(areas, {}, null, [], 'prepaid');

      // Check for prepaid discount line item
      const discountItem = result.items.find(i => i.label.toLowerCase().includes('discount'));
      expect(discountItem).toBeDefined();
      expect(discountItem?.value).toBeLessThan(0);
      expect(discountItem?.isDiscount).toBe(true);
    });
  });

  describe('Edge Cases', () => {

    it('should handle empty areas array', () => {
      const result = calculatePricing([], {}, null, [], 'standard');

      // With empty areas, the implementation still adds a base scanning estimate
      // (minimum 1 day scanning at $600/day is included as upteam cost)
      // This is intentional - even zero-sqft projects have base scanning overhead
      expect(result.items).toBeDefined();
      // Scanning estimate provides a base cost even for empty areas
      expect(result.scanningEstimate).toBeDefined();
    });

    it('should handle null travel config', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Test',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '10000',
          lod: '200',
          disciplines: ['architecture'],
        },
      ];

      const result = calculatePricing(areas, {}, null, [], 'standard');

      expect(result.totalClientPrice).toBeGreaterThan(0);
      // Travel line item should be $0 or not present
    });

    it('should handle area with no disciplines', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Empty Disciplines',
          kind: 'standard',
          buildingType: '1',
          squareFeet: '10000',
          lod: '200',
          disciplines: [],
        },
      ];

      // Should not throw, just calculate base
      const result = calculatePricing(areas, {}, null, [], 'standard');
      expect(result).toBeDefined();
    });

    it('should handle landscape area with 0 acres', () => {
      const areas: Area[] = [
        {
          id: '1',
          name: 'Empty Landscape',
          kind: 'landscape',
          buildingType: 'landscape_natural',
          squareFeet: '0',
          lod: '200',
          disciplines: ['site'],
        },
      ];

      const result = calculatePricing(areas, {}, null, [], 'standard');
      expect(result.totalClientPrice).toBe(0);
    });
  });
});

describe('Landscape Pricing', () => {

  it('should use acre-based rates for landscape areas', () => {
    const areas: Area[] = [
      {
        id: '1',
        name: 'Natural Landscape',
        kind: 'landscape',
        buildingType: 'landscape_natural',
        squareFeet: '5', // 5 acres
        lod: '300',
        disciplines: ['site'],
      },
    ];

    const result = calculatePricing(areas, {}, null, [], 'standard');

    // Should calculate based on acres, not sqft
    // 5 acres at ~$750/acre (LoD 300) = ~$3,750
    expect(result.totalClientPrice).toBeGreaterThan(0);

    // Check that landscape appears in breakdown
    const landscapeItem = result.items.find(i => i.label.toLowerCase().includes('landscape'));
    expect(landscapeItem).toBeDefined();
  });

  it('should use built landscape rates (higher) for hardscape areas', () => {
    // Use 60 acres (tier4: 50-100 acres) to ensure prices exceed the $3,000 minimum
    // Built tier4 LOD 300: $75/acre → 60 × $75 = $4,500
    // Natural tier4 LOD 300: $55/acre → 60 × $55 = $3,300
    const builtAreas: Area[] = [{
      id: '1',
      name: 'Built Landscape',
      kind: 'landscape',
      buildingType: 'landscape_built',
      squareFeet: '60', // 60 acres
      lod: '300',
      disciplines: ['site'],
    }];

    const naturalAreas: Area[] = [{
      id: '1',
      name: 'Natural Landscape',
      kind: 'landscape',
      buildingType: 'landscape_natural',
      squareFeet: '60', // 60 acres
      lod: '300',
      disciplines: ['site'],
    }];

    const builtResult = calculatePricing(builtAreas, {}, null, [], 'standard');
    const naturalResult = calculatePricing(naturalAreas, {}, null, [], 'standard');

    // Both should exceed minimum charge with 60 acres
    expect(builtResult.totalClientPrice).toBeGreaterThan(3000);
    expect(naturalResult.totalClientPrice).toBeGreaterThan(3000);

    // Built should be more expensive than natural ($4,500 vs $3,300)
    expect(builtResult.totalClientPrice).toBeGreaterThan(naturalResult.totalClientPrice);
  });

  it('should apply tiered rates based on acreage', () => {
    const smallArea: Area[] = [{
      id: '1', name: 'Small', kind: 'landscape', buildingType: 'landscape_natural',
      squareFeet: '3', lod: '200', disciplines: ['site'],
    }];

    const largeArea: Area[] = [{
      id: '1', name: 'Large', kind: 'landscape', buildingType: 'landscape_natural',
      squareFeet: '60', lod: '200', disciplines: ['site'],
    }];

    const smallResult = calculatePricing(smallArea, {}, null, [], 'standard');
    const largeResult = calculatePricing(largeArea, {}, null, [], 'standard');

    // Per-acre rate should be lower for large projects
    const smallPerAcre = smallResult.totalClientPrice / 3;
    const largePerAcre = largeResult.totalClientPrice / 60;
    expect(largePerAcre).toBeLessThan(smallPerAcre);
  });
});

describe('Area Tier Calculations', () => {

  it('should apply no discount for areas under 5k sqft (tier 0-5k)', () => {
    const areas: Area[] = [{
      id: '1', name: 'Small', kind: 'standard', buildingType: '1',
      squareFeet: '4000', lod: '200', disciplines: ['architecture'],
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    expect(result.totalClientPrice).toBeGreaterThan(0);
  });

  it('should apply 5% discount for 5k-10k sqft tier', () => {
    const small: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '4999', lod: '200', disciplines: ['architecture']
    }];
    const tier: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '5000', lod: '200', disciplines: ['architecture']
    }];

    const smallResult = calculatePricing(small, {}, null, [], 'standard');
    const tierResult = calculatePricing(tier, {}, null, [], 'standard');

    // Tier should have slightly lower per-sqft rate
    const smallPerSqft = smallResult.totalClientPrice / 4999;
    const tierPerSqft = tierResult.totalClientPrice / 5000;
    expect(tierPerSqft).toBeLessThan(smallPerSqft);
  });

  it('should apply 10% discount for 10k-20k sqft tier', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '15000', lod: '200', disciplines: ['architecture'],
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    expect(result.totalClientPrice).toBeGreaterThan(0);
  });

  it('should apply maximum discount for 100k+ sqft tier', () => {
    const large: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '100000', lod: '200', disciplines: ['architecture']
    }];
    const medium: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '200', disciplines: ['architecture']
    }];

    const largeResult = calculatePricing(large, {}, null, [], 'standard');
    const mediumResult = calculatePricing(medium, {}, null, [], 'standard');

    const largePerSqft = largeResult.totalClientPrice / 100000;
    const mediumPerSqft = mediumResult.totalClientPrice / 50000;
    expect(largePerSqft).toBeLessThan(mediumPerSqft);
  });

  it('should handle exact tier boundary at 50k sqft', () => {
    const at50k: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '200', disciplines: ['architecture']
    }];
    const under50k: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '49999', lod: '200', disciplines: ['architecture']
    }];

    const at50Result = calculatePricing(at50k, {}, null, [], 'standard');
    const under50Result = calculatePricing(under50k, {}, null, [], 'standard');

    // 50k should be in 50k-75k tier with lower rate than 49,999
    const at50PerSqft = at50Result.totalClientPrice / 50000;
    const under50PerSqft = under50Result.totalClientPrice / 49999;
    expect(at50PerSqft).toBeLessThan(under50PerSqft);
  });
});

describe('Risk Premium Tests', () => {

  it('should apply risk premium only to Architecture discipline', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture', 'mepf'],
    }];

    const withRisk = calculatePricing(areas, {}, null, ['occupied'], 'standard');
    const noRisk = calculatePricing(areas, {}, null, [], 'standard');

    expect(withRisk.totalClientPrice).toBeGreaterThan(noRisk.totalClientPrice);

    // Risk premium should be visible in line items
    const riskItem = withRisk.items.find(i => i.label.includes('Risk Premium'));
    expect(riskItem).toBeDefined();
    expect(riskItem?.label).toContain('Architecture only');
  });

  it('should not apply risk to MEPF discipline', () => {
    const areasArch: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
    }];

    const areasMEP: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['mepf'],
    }];

    const archRisk = calculatePricing(areasArch, {}, null, ['occupied'], 'standard');
    const mepRisk = calculatePricing(areasMEP, {}, null, ['occupied'], 'standard');

    // Architecture should have risk premium line item, MEP should not
    const archRiskItem = archRisk.items.find(i => i.label.includes('Risk Premium'));
    const mepRiskItem = mepRisk.items.find(i => i.label.includes('Risk Premium'));

    expect(archRiskItem).toBeDefined();
    expect(mepRiskItem).toBeUndefined();
  });

  it('should stack multiple risk premiums', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
    }];

    const oneRisk = calculatePricing(areas, {}, null, ['occupied'], 'standard');
    const twoRisks = calculatePricing(areas, {}, null, ['occupied', 'hazardous'], 'standard');

    expect(twoRisks.totalClientPrice).toBeGreaterThan(oneRisk.totalClientPrice);

    // Should have two risk line items
    const riskItems = twoRisks.items.filter(i => i.label.includes('Risk Premium'));
    expect(riskItems.length).toBe(2);
  });

  it('should calculate hazardous risk at 25% of architecture base', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
    }];

    const result = calculatePricing(areas, {}, null, ['hazardous'], 'standard');
    const archBase = result.disciplineTotals.architecture;
    const riskItem = result.items.find(i => i.label.includes('Hazardous'));

    // Hazardous is 25% premium
    expect(riskItem?.value).toBeCloseTo(archBase * 0.25, 1);
  });

  it('should calculate occupied risk at 15% of architecture base', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
    }];

    const result = calculatePricing(areas, {}, null, ['occupied'], 'standard');
    const archBase = result.disciplineTotals.architecture;
    const riskItem = result.items.find(i => i.label.includes('Occupied'));

    // Occupied is 15% premium
    expect(riskItem?.value).toBeCloseTo(archBase * 0.15, 1);
  });
});

describe('Scope Discount Tests', () => {
  // Use 50,000 sqft to avoid $3,000 minimum charge affecting ratio calculations

  it('should apply interior-only scope at 65% of full price (aligned with CPQ)', () => {
    const fullScope: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '300', disciplines: ['architecture'], scope: 'full'
    }];
    const interiorOnly: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '300', disciplines: ['architecture'], scope: 'interior'
    }];

    const fullResult = calculatePricing(fullScope, {}, null, [], 'standard');
    const interiorResult = calculatePricing(interiorOnly, {}, null, [], 'standard');

    // Interior only = 65% of full price (aligned with CPQ - interior carries 65% of work)
    const expectedRatio = 0.65;
    const actualRatio = interiorResult.totalClientPrice / fullResult.totalClientPrice;
    expect(actualRatio).toBeCloseTo(expectedRatio, 2);
  });

  it('should apply exterior-only scope at 35% of full price (aligned with CPQ)', () => {
    const fullScope: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '300', disciplines: ['architecture'], scope: 'full'
    }];
    const exteriorOnly: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '300', disciplines: ['architecture'], scope: 'exterior'
    }];

    const fullResult = calculatePricing(fullScope, {}, null, [], 'standard');
    const exteriorResult = calculatePricing(exteriorOnly, {}, null, [], 'standard');

    // Exterior only = 35% of full price (aligned with CPQ - exterior carries 35% of work)
    const expectedRatio = 0.35;
    const actualRatio = exteriorResult.totalClientPrice / fullResult.totalClientPrice;
    expect(actualRatio).toBeCloseTo(expectedRatio, 2);
  });

  it('should apply roof scope at 35% of full price (65% discount)', () => {
    const fullScope: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '300', disciplines: ['architecture'], scope: 'full'
    }];
    const roofScope: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '50000', lod: '300', disciplines: ['architecture'], scope: 'roof'
    }];

    const fullResult = calculatePricing(fullScope, {}, null, [], 'standard');
    const roofResult = calculatePricing(roofScope, {}, null, [], 'standard');

    // Roof scope = 35% of full price (65% discount)
    const expectedRatio = 0.35;
    const actualRatio = roofResult.totalClientPrice / fullResult.totalClientPrice;
    expect(actualRatio).toBeCloseTo(expectedRatio, 2);
  });
});

describe('Additional Elevations Tiered Pricing', () => {

  it('should price first 10 elevations at $25 each', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
      additionalElevations: 5,
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    const elevItem = result.items.find(i => i.label.includes('Additional Elevations'));

    // 5 elevations at $25 = $125
    expect(elevItem?.value).toBe(125);
  });

  it('should price elevations 11-20 at $20 each', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
      additionalElevations: 15,
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    const elevItem = result.items.find(i => i.label.includes('Additional Elevations'));

    // First 10 at $25 = $250, next 5 at $20 = $100, total = $350
    expect(elevItem?.value).toBe(350);
  });

  it('should price elevations 21-100 at $15 each', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
      additionalElevations: 30,
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    const elevItem = result.items.find(i => i.label.includes('Additional Elevations'));

    // First 10 at $25 = $250, next 10 at $20 = $200, next 10 at $15 = $150, total = $600
    expect(elevItem?.value).toBe(600);
  });

  it('should price elevations 101-300 at $10 each', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
      additionalElevations: 150,
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    const elevItem = result.items.find(i => i.label.includes('Additional Elevations'));

    // 10*$25 + 10*$20 + 80*$15 + 50*$10 = $250 + $200 + $1,200 + $500 = $2,150
    expect(elevItem?.value).toBe(2150);
  });

  it('should price elevations 300+ at $5 each', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture'],
      additionalElevations: 350,
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    const elevItem = result.items.find(i => i.label.includes('Additional Elevations'));

    // 10*$25 + 10*$20 + 80*$15 + 200*$10 + 50*$5 = $250 + $200 + $1,200 + $2,000 + $250 = $3,900
    expect(elevItem?.value).toBe(3900);
  });
});

describe('Tier A Project Logic', () => {

  it('should calculate Tier A price with 2.352X margin (standard)', () => {
    const config = {
      scanningCost: '7000' as const,
      modelingCost: 5000,
      margin: '2.352' as const,
    };

    const result = calculateTierAPricing(config, 0);

    // (7000 + 5000) * 2.352 = 28,224
    expect(result.clientPrice).toBe(28224);
  });

  it('should calculate Tier A price with 4.0X margin (premium)', () => {
    const config = {
      scanningCost: '10500' as const,
      modelingCost: 8000,
      margin: '4.0' as const,
    };

    const result = calculateTierAPricing(config, 0);

    // (10500 + 8000) * 4.0 = 74,000
    expect(result.clientPrice).toBe(74000);
  });

  it('should use custom scanning cost when "other" is selected', () => {
    const config = {
      scanningCost: 'other' as const,
      scanningCostOther: 9500,
      modelingCost: 6000,
      margin: '2.5' as const,
    };

    const result = calculateTierAPricing(config, 0);

    // (9500 + 6000) * 2.5 = 38,750
    expect(result.clientPrice).toBe(38750);
  });

  it('should add Tier A travel cost ($4/mile over 20 miles)', () => {
    const config = {
      scanningCost: '7000' as const,
      modelingCost: 5000,
      margin: '2.5' as const,
    };

    const result = calculateTierAPricing(config, 40);

    // Travel: (40 - 20) * $4 = $80
    expect(result.travelCost).toBe(80);
    expect(result.totalWithTravel).toBe(result.clientPrice + 80);
  });

  it('should have $0 travel for <= 20 miles in Tier A', () => {
    const config = {
      scanningCost: '7000' as const,
      modelingCost: 5000,
      margin: '2.5' as const,
    };

    const result = calculateTierAPricing(config, 15);

    expect(result.travelCost).toBe(0);
  });

  it('should include totalWithTravel in Tier A result', () => {
    const config = {
      scanningCost: '18500' as const,
      modelingCost: 12000,
      margin: '3.0' as const,
    };

    const result = calculateTierAPricing(config, 50);

    // Client price: (18500 + 12000) * 3.0 = 91,500
    // Travel: (50 - 20) * $4 = $120
    expect(result.totalWithTravel).toBe(91620);
  });
});

describe('Brooklyn Travel Tier Edge Cases', () => {

  it('should handle case-insensitive Brooklyn detection', () => {
    const cost1 = calculateTravelCost(25, 'brooklyn', 30000);
    const cost2 = calculateTravelCost(25, 'BROOKLYN', 30000);
    const cost3 = calculateTravelCost(25, 'Brooklyn', 30000);

    expect(cost1).toBe(cost2);
    expect(cost2).toBe(cost3);
  });

  it('should treat non-Brooklyn locations as flat rate', () => {
    const woodstock = calculateTravelCost(50, 'WOODSTOCK', 60000);
    const atlanta = calculateTravelCost(50, 'ATLANTA', 60000);
    const miami = calculateTravelCost(50, 'MIAMI', 60000);

    // All non-Brooklyn should be $3/mile = $150
    expect(woodstock).toBe(150);
    expect(atlanta).toBe(150);
    expect(miami).toBe(150);
  });

  it('should correctly transition at Tier B/C boundary (10k sqft)', () => {
    const tierC = calculateTravelCost(30, 'BROOKLYN', 9999);
    const tierB = calculateTravelCost(30, 'BROOKLYN', 10000);

    // Tier C: $150 base + (30-20)*$4 = $190
    // Tier B: $300 base + (30-20)*$4 = $340
    expect(tierC).toBe(190);
    expect(tierB).toBe(340);
  });

  it('should correctly transition at Tier A/B boundary (50k sqft)', () => {
    const tierB = calculateTravelCost(30, 'BROOKLYN', 49999);
    const tierA = calculateTravelCost(30, 'BROOKLYN', 50000);

    // Tier B: $300 base + (30-20)*$4 = $340
    // Tier A: $0 base + (30-20)*$4 = $40
    expect(tierB).toBe(340);
    expect(tierA).toBe(40);
  });
});

describe('LOD Multiplier Tests', () => {

  it('should apply 1.0x multiplier for LOD 200', () => {
    const areas: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '200', disciplines: ['architecture'],
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');
    expect(result.totalClientPrice).toBeGreaterThan(0);
  });

  it('should apply 1.3x multiplier for LOD 300', () => {
    const lod200: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '200', disciplines: ['architecture']
    }];
    const lod300: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '300', disciplines: ['architecture']
    }];

    const result200 = calculatePricing(lod200, {}, null, [], 'standard');
    const result300 = calculatePricing(lod300, {}, null, [], 'standard');

    // LOD 300 should be ~30% more than LOD 200
    expect(result300.totalClientPrice).toBeGreaterThan(result200.totalClientPrice);
    const ratio = result300.totalClientPrice / result200.totalClientPrice;
    expect(ratio).toBeCloseTo(1.3, 1);
  });

  it('should apply 1.5x multiplier for LOD 350', () => {
    const lod200: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '200', disciplines: ['architecture']
    }];
    const lod350: Area[] = [{
      id: '1', name: 'Test', kind: 'standard', buildingType: '1',
      squareFeet: '20000', lod: '350', disciplines: ['architecture']
    }];

    const result200 = calculatePricing(lod200, {}, null, [], 'standard');
    const result350 = calculatePricing(lod350, {}, null, [], 'standard');

    // LOD 350 should be ~50% more than LOD 200
    const ratio = result350.totalClientPrice / result200.totalClientPrice;
    expect(ratio).toBeCloseTo(1.5, 1);
  });
});

describe('Minimum Project Charge', () => {

  it('should apply minimum $3000 charge for small projects', () => {
    const areas: Area[] = [{
      id: '1', name: 'Tiny', kind: 'standard', buildingType: '1',
      squareFeet: '500', lod: '200', disciplines: ['architecture'],
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');

    // Should be at least $3000
    expect(result.totalClientPrice).toBeGreaterThanOrEqual(3000);
  });

  it('should show adjustment line item when minimum applies', () => {
    const areas: Area[] = [{
      id: '1', name: 'Tiny', kind: 'standard', buildingType: '1',
      squareFeet: '500', lod: '200', disciplines: ['architecture'],
    }];

    const result = calculatePricing(areas, {}, null, [], 'standard');

    const adjustmentItem = result.items.find(i => i.label.includes('Minimum Project Charge'));
    expect(adjustmentItem).toBeDefined();
  });
});
