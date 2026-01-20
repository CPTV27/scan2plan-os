/**
 * CPQ Server-Side Validator Unit Tests
 * 
 * Tests validation rules for quotes including:
 * - Margin floor enforcement (40% minimum)
 * - CEO override handling
 * - Price integrity checks
 * - Dispatch location validation
 * - Tier A classification
 * - PandaDoc send validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateQuote,
  validatePandaDocSend,
  normalizeQuoteForValidation,
  type ValidationResult,
} from './cpqValidator';
import { FY26_GOALS } from '@shared/businessGoals';

describe('CPQ Server-Side Validator', () => {
  const createValidQuote = (overrides: Partial<any> = {}) => ({
    areas: [
      {
        name: 'Test Building',
        buildingType: '4',
        squareFeet: '20000',
        disciplines: ['architecture', 'mepf'],
        lod: '300',
        scope: 'full',
      },
    ],
    totalClientPrice: 10000,
    totalUpteamCost: 5500,
    dispatchLocation: 'WOODSTOCK',
    projectName: 'Test Project',
    projectAddress: '123 Test St',
    typeOfBuilding: 'Office',
    ...overrides,
  });

  describe('validateQuote - Basic Validation', () => {
    it('should pass for a valid quote with healthy margin', () => {
      const quote = createValidQuote({
        totalClientPrice: 10000,
        totalUpteamCost: 5500, // 45% margin
      });

      const result = validateQuote(quote);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.integrityStatus).toBe('pass');
    });

    it('should fail if areas array is empty', () => {
      const quote = createValidQuote({ areas: [] });

      const result = validateQuote(quote);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('area'))).toBe(true);
      expect(result.integrityStatus).toBe('blocked');
    });

    it('should fail if totalClientPrice is missing or invalid', () => {
      const quote = createValidQuote({ totalClientPrice: -100 });

      const result = validateQuote(quote);

      expect(result.valid).toBe(false);
      expect(result.integrityStatus).toBe('blocked');
    });

    it('should fail if project name is missing', () => {
      const quote = createValidQuote({ projectName: '' });

      const result = validateQuote(quote);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Project name'))).toBe(true);
    });

    it('should fail if project address is missing', () => {
      const quote = createValidQuote({ projectAddress: '' });

      const result = validateQuote(quote);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Project address'))).toBe(true);
    });
  });

  describe('validateQuote - Margin Floor Enforcement', () => {
    it('should block quote below 40% margin floor', () => {
      const quote = createValidQuote({
        totalClientPrice: 10000,
        totalUpteamCost: 6500, // 35% margin (below 40% floor)
      });

      const result = validateQuote(quote);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MARGIN_BELOW_FLOOR')).toBe(true);
      expect(result.integrityStatus).toBe('blocked');
    });

    it('should pass quote at exactly 40% margin', () => {
      const quote = createValidQuote({
        totalClientPrice: 10000,
        totalUpteamCost: 6000, // Exactly 40% margin
      });

      const result = validateQuote(quote);

      expect(result.valid).toBe(true);
      expect(result.errors.filter(e => e.code === 'MARGIN_BELOW_FLOOR')).toHaveLength(0);
    });

    it('should warn if margin below 45% guardrail but above 40% floor', () => {
      const quote = createValidQuote({
        totalClientPrice: 10000,
        totalUpteamCost: 5800, // 42% margin
      });

      const result = validateQuote(quote);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'MARGIN_BELOW_GUARDRAIL')).toBe(true);
      expect(result.integrityStatus).toBe('warning');
    });

    it('should allow quote below floor with CEO override', () => {
      const quote = createValidQuote({
        totalClientPrice: 10000,
        totalUpteamCost: 6500, // 35% margin
        overrideApproved: true,
        overrideApprovedBy: 'CEO John Doe',
      });

      const result = validateQuote(quote);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'MARGIN_OVERRIDE_USED')).toBe(true);
      expect(result.integrityStatus).toBe('warning');
    });

    it('should include approver details when override is used', () => {
      const quote = createValidQuote({
        totalClientPrice: 10000,
        totalUpteamCost: 7000, // 30% margin
        overrideApproved: true,
        overrideApprovedBy: 'Chase Pierson',
      });

      const result = validateQuote(quote);

      const overrideWarning = result.warnings.find(w => w.code === 'MARGIN_OVERRIDE_USED');
      expect(overrideWarning).toBeDefined();
      expect(overrideWarning?.details?.approvedBy).toBe('Chase Pierson');
    });
  });

  describe('validateQuote - Price Integrity Checks', () => {
    it('should fail if price does not match margin target calculation', () => {
      const quote = createValidQuote({
        totalClientPrice: 12000, // Should be 10000 / (1-0.45) ≈ 18181 for 45% margin
        totalUpteamCost: 10000,
        marginTarget: 45, // 45%
      });

      const result = validateQuote(quote);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PRICE_INTEGRITY_FAILED')).toBe(true);
    });

    it('should pass if price matches margin target within tolerance', () => {
      const upteamCost = 5500;
      const marginTarget = 0.45;
      const expectedPrice = upteamCost / (1 - marginTarget); // ≈ 10000

      const quote = createValidQuote({
        totalClientPrice: Math.round(expectedPrice),
        totalUpteamCost: upteamCost,
        marginTarget: marginTarget,
      });

      const result = validateQuote(quote);

      expect(result.errors.filter(e => e.code === 'PRICE_INTEGRITY_FAILED')).toHaveLength(0);
    });

    it('should skip price integrity check if no margin target specified', () => {
      const quote = createValidQuote({
        totalClientPrice: 10000,
        totalUpteamCost: 5500,
        // No marginTarget
      });

      const result = validateQuote(quote);

      expect(result.valid).toBe(true);
      expect(result.errors.filter(e => e.code === 'PRICE_INTEGRITY_FAILED')).toHaveLength(0);
    });
  });

  describe('validateQuote - Dispatch Location Validation', () => {
    it('should accept valid dispatch locations', () => {
      const locations = ['TROY', 'WOODSTOCK', 'BROOKLYN', 'FLY_OUT'];

      for (const location of locations) {
        const quote = createValidQuote({ dispatchLocation: location });
        const result = validateQuote(quote);

        expect(result.errors.filter(e => e.code === 'INVALID_DISPATCH_LOCATION')).toHaveLength(0);
      }
    });

    it('should normalize lowercase dispatch location to uppercase', () => {
      const quote = createValidQuote({ dispatchLocation: 'brooklyn' });

      const result = validateQuote(quote);

      expect(result.errors.filter(e => e.code === 'INVALID_DISPATCH_LOCATION')).toHaveLength(0);
    });

    it('should reject invalid dispatch locations', () => {
      const quote = createValidQuote({ dispatchLocation: 'BOSTON' });

      const result = validateQuote(quote);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_DISPATCH_LOCATION')).toBe(true);
    });
  });

  describe('validateQuote - Tier Classification', () => {
    it('should classify projects >= 50k sqft as Tier A', () => {
      const quote = createValidQuote({
        areas: [
          { buildingType: '4', squareFeet: '50000', disciplines: ['architecture'] },
        ],
      });

      const result = validateQuote(quote);

      expect(result.tierClassification).toBe('A');
      expect(result.warnings.some(w => w.code === 'TIER_A_PROJECT')).toBe(true);
    });

    it('should classify projects < 50k sqft as Tier B', () => {
      const quote = createValidQuote({
        areas: [
          { buildingType: '4', squareFeet: '30000', disciplines: ['architecture'] },
        ],
      });

      const result = validateQuote(quote);

      expect(result.tierClassification).toBe('B');
      expect(result.warnings.filter(w => w.code === 'TIER_A_PROJECT')).toHaveLength(0);
    });

    it('should sum sqft across multiple areas for tier classification', () => {
      const quote = createValidQuote({
        areas: [
          { buildingType: '4', squareFeet: '30000', disciplines: ['architecture'] },
          { buildingType: '4', squareFeet: '25000', disciplines: ['mepf'] },
        ],
      });

      const result = validateQuote(quote);

      expect(result.tierClassification).toBe('A'); // 55,000 sqft total
    });

    it('should handle numeric squareFeet values', () => {
      const quote = createValidQuote({
        areas: [
          { buildingType: '4', squareFeet: 60000, disciplines: ['architecture'] },
        ],
      });

      const result = validateQuote(quote);

      expect(result.tierClassification).toBe('A');
    });
  });

  describe('validatePandaDocSend', () => {
    it('should pass with valid recipient info', () => {
      const quote = { leadId: 123 };
      const lead = { contactEmail: 'client@example.com', contactName: 'John Client' };
      const body = {};

      const result = validatePandaDocSend(quote, lead, body);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if recipient email is missing', () => {
      const quote = { leadId: 123 };
      const lead = { contactName: 'John Client' };
      const body = {};

      const result = validatePandaDocSend(quote, lead as any, body);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_RECIPIENT_EMAIL')).toBe(true);
    });

    it('should fail if recipient name is missing', () => {
      const quote = { leadId: 123 };
      const lead = { contactEmail: 'client@example.com' };
      const body = {};

      const result = validatePandaDocSend(quote, lead as any, body);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_RECIPIENT_NAME')).toBe(true);
    });

    it('should fail if quote not linked to lead', () => {
      const quote = { leadId: null };
      const lead = { contactEmail: 'client@example.com', contactName: 'John' };
      const body = {};

      const result = validatePandaDocSend(quote, lead, body);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'QUOTE_NOT_LINKED')).toBe(true);
    });

    it('should use body values as fallback when lead info is missing', () => {
      const quote = { leadId: 123 };
      const lead = null;
      const body = { recipientEmail: 'fallback@example.com', recipientName: 'Fallback Name' };

      const result = validatePandaDocSend(quote, lead, body);

      expect(result.valid).toBe(true);
    });
  });

  describe('normalizeQuoteForValidation', () => {
    it('should extract dispatchLocation from travel object', () => {
      const data = {
        travel: { dispatchLocation: 'brooklyn' },
      };

      const normalized = normalizeQuoteForValidation(data);

      expect(normalized.dispatchLocation).toBe('BROOKLYN');
    });

    it('should uppercase existing dispatchLocation', () => {
      const data = {
        dispatchLocation: 'woodstock',
      };

      const normalized = normalizeQuoteForValidation(data);

      expect(normalized.dispatchLocation).toBe('WOODSTOCK');
    });

    it('should extract areas from requestData', () => {
      const areas = [{ buildingType: '4', squareFeet: '10000' }];
      const data = {
        requestData: { areas },
      };

      const normalized = normalizeQuoteForValidation(data);

      expect(normalized.areas).toEqual(areas);
    });

    it('should extract pricing values from pricingBreakdown', () => {
      const data = {
        pricingBreakdown: {
          totalClientPrice: '12000',
          totalCost: '6000',
          marginTarget: '0.45',
        },
      };

      const normalized = normalizeQuoteForValidation(data);

      expect(normalized.totalClientPrice).toBe(12000);
      expect(normalized.totalUpteamCost).toBe(6000);
      expect(normalized.marginTarget).toBe(0.45);
    });

    it('should extract override info from requestData', () => {
      const data = {
        requestData: {
          overrideApproved: true,
          overrideApprovedBy: 'CEO',
        },
      };

      const normalized = normalizeQuoteForValidation(data);

      expect(normalized.overrideApproved).toBe(true);
      expect(normalized.overrideApprovedBy).toBe('CEO');
    });
  });

  describe('FY26 Goals Integration', () => {
    it('should use correct margin floor from FY26_GOALS', () => {
      expect(FY26_GOALS.MARGIN_FLOOR).toBe(0.40);
    });

    it('should use correct margin stretch target from FY26_GOALS', () => {
      expect(FY26_GOALS.MARGIN_STRETCH).toBe(0.45);
    });

    it('should use correct Tier A threshold from FY26_GOALS', () => {
      expect(FY26_GOALS.TIER_A_FLOOR).toBe(50000);
    });
  });
});
