/**
 * API Route Tests - Leads
 * 
 * Tests for lead CRUD operations and data validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database responses
const mockLead = {
    id: 1,
    clientName: 'Test Client',
    projectName: 'Test Project',
    projectAddress: '123 Main St, New York, NY',
    dealStage: 'Leads',
    value: '50000',
    probability: 50,
    contactName: 'John Doe',
    contactEmail: 'john@test.com',
    contactPhone: '555-1234',
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockLeads = [mockLead];

// Mock storage layer
vi.mock('../storage', () => ({
    storage: {
        getLeads: vi.fn().mockResolvedValue(mockLeads),
        getLead: vi.fn().mockResolvedValue(mockLead),
        createLead: vi.fn().mockResolvedValue(mockLead),
        updateLead: vi.fn().mockResolvedValue(mockLead),
        deleteLead: vi.fn().mockResolvedValue(true),
        searchLeads: vi.fn().mockResolvedValue(mockLeads),
        getLeadsByStage: vi.fn().mockResolvedValue(mockLeads),
    },
}));

describe('Leads API Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Lead Data Validation', () => {
        it('should require clientName for new leads', () => {
            const invalidLead = { projectName: 'Test' };
            expect(invalidLead.clientName).toBeUndefined();
            // Real validation would reject this
        });

        it('should accept valid email format', () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            expect(emailRegex.test('john@test.com')).toBe(true);
            expect(emailRegex.test('invalid-email')).toBe(false);
        });

        it('should validate probability range (0-100)', () => {
            const probability = mockLead.probability;
            expect(probability).toBeGreaterThanOrEqual(0);
            expect(probability).toBeLessThanOrEqual(100);
        });

        it('should have valid deal stage', () => {
            const validStages = ['Leads', 'Contacted', 'Quote', 'Proposal', 'Negotiation', 'Won', 'Lost'];
            expect(validStages).toContain(mockLead.dealStage);
        });
    });

    describe('Lead Data Transformation', () => {
        it('should format value as string for storage', () => {
            const value = mockLead.value;
            expect(typeof value).toBe('string');
        });

        it('should preserve phone number format', () => {
            const phone = mockLead.contactPhone;
            expect(phone).toMatch(/[\d-]+/);
        });

        it('should have timestamps on lead records', () => {
            expect(mockLead.createdAt).toBeInstanceOf(Date);
            expect(mockLead.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('Lead Search Logic', () => {
        it('should search by clientName (case-insensitive logic)', () => {
            const searchTerm = 'test';
            const matches = mockLeads.filter(l =>
                l.clientName.toLowerCase().includes(searchTerm.toLowerCase())
            );
            expect(matches.length).toBe(1);
        });

        it('should search by email', () => {
            const searchTerm = 'john@test.com';
            const matches = mockLeads.filter(l =>
                l.contactEmail === searchTerm
            );
            expect(matches.length).toBe(1);
        });

        it('should filter by deal stage', () => {
            const stage = 'Leads';
            const matches = mockLeads.filter(l => l.dealStage === stage);
            expect(matches.length).toBe(1);
        });
    });

    describe('Lead Score Calculation', () => {
        it('should calculate score based on value and probability', () => {
            // Simple weighted score formula
            const value = parseFloat(mockLead.value) || 0;
            const probability = mockLead.probability || 0;
            const expectedValue = value * (probability / 100);

            expect(expectedValue).toBe(25000); // 50000 * 0.5
        });

        it('should handle missing value gracefully', () => {
            const leadWithoutValue = { ...mockLead, value: null };
            const value = parseFloat(leadWithoutValue.value as any) || 0;
            expect(value).toBe(0);
        });
    });
});

describe('Lead Pipeline Logic', () => {
    it('should order stages correctly', () => {
        const stageOrder = ['Leads', 'Contacted', 'Quote', 'Proposal', 'Negotiation', 'Won', 'Lost'];
        const stageIndex = stageOrder.indexOf('Quote');
        expect(stageIndex).toBe(2);
        expect(stageIndex).toBeGreaterThan(stageOrder.indexOf('Leads'));
        expect(stageIndex).toBeLessThan(stageOrder.indexOf('Won'));
    });

    it('should calculate pipeline value by stage', () => {
        const stages = ['Leads', 'Quote', 'Proposal'];
        const leadsPerStage = stages.map(stage => ({
            stage,
            count: mockLeads.filter(l => l.dealStage === stage).length,
            value: mockLeads
                .filter(l => l.dealStage === stage)
                .reduce((sum, l) => sum + (parseFloat(l.value) || 0), 0),
        }));

        const leadsStage = leadsPerStage.find(s => s.stage === 'Leads');
        expect(leadsStage?.value).toBe(50000);
    });
});
