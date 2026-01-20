/**
 * API Route Tests - Products (SKU Catalog)
 * 
 * Tests for product catalog lookup and SKU resolution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock product data from QuickBooks catalog
const mockProducts = [
    {
        id: 1,
        sku: 'S2P-COM-300-FULL',
        name: 'Scan2Plan Commercial - LoD 300 - Full Scope',
        category: 'S2P',
        type: 'Service',
        price: '0.12',
        active: true,
        attributes: { propertyType: 'Commercial', lod: '300', scope: 'Full' },
    },
    {
        id: 2,
        sku: 'S2P-RES-200-FULL',
        name: 'Scan2Plan Residential - LoD 200 - Full Scope',
        category: 'S2P',
        type: 'Service',
        price: '0.10',
        active: true,
        attributes: { propertyType: 'Residential', lod: '200', scope: 'Full' },
    },
    {
        id: 3,
        sku: 'ADD-MEP-300',
        name: 'Added Discipline: MEP - LoD 300',
        category: 'Added Disciplines',
        type: 'Service',
        price: '0.05',
        active: true,
        attributes: { discipline: 'MEP', lod: '300' },
    },
    {
        id: 4,
        sku: 'ADD-STR-200',
        name: 'Added Discipline: Structural - LoD 200',
        category: 'Added Disciplines',
        type: 'Service',
        price: '0.04',
        active: false,
        attributes: { discipline: 'Structure', lod: '200' },
    },
];

describe('Product SKU Catalog', () => {
    describe('SKU Lookup', () => {
        it('should find product by exact SKU', () => {
            const sku = 'S2P-COM-300-FULL';
            const product = mockProducts.find(p => p.sku === sku);

            expect(product).toBeDefined();
            expect(product?.name).toBe('Scan2Plan Commercial - LoD 300 - Full Scope');
        });

        it('should return undefined for unknown SKU', () => {
            const sku = 'UNKNOWN-SKU';
            const product = mockProducts.find(p => p.sku === sku);

            expect(product).toBeUndefined();
        });

        it('should be case-sensitive for SKU matching', () => {
            const sku = 's2p-com-300-full'; // lowercase
            const product = mockProducts.find(p => p.sku === sku);

            expect(product).toBeUndefined();
        });
    });

    describe('Category Filtering', () => {
        it('should filter products by category', () => {
            const category = 'S2P';
            const filtered = mockProducts.filter(p => p.category === category);

            expect(filtered.length).toBe(2);
            expect(filtered.every(p => p.category === 'S2P')).toBe(true);
        });

        it('should get unique categories', () => {
            const categories = [...new Set(mockProducts.map(p => p.category))];

            expect(categories).toContain('S2P');
            expect(categories).toContain('Added Disciplines');
            expect(categories.length).toBe(2);
        });
    });

    describe('Active/Inactive Filtering', () => {
        it('should filter active products only', () => {
            const active = mockProducts.filter(p => p.active);

            expect(active.length).toBe(3);
            expect(active.every(p => p.active === true)).toBe(true);
        });

        it('should include inactive products when not filtered', () => {
            const all = mockProducts;
            const inactive = all.filter(p => !p.active);

            expect(inactive.length).toBe(1);
            expect(inactive[0].sku).toBe('ADD-STR-200');
        });
    });

    describe('Attribute-Based Lookup', () => {
        function findProductByAttributes(attrs: Record<string, string>) {
            return mockProducts.find(p => {
                if (!p.attributes) return false;
                return Object.entries(attrs).every(
                    ([key, value]) => (p.attributes as any)[key] === value
                );
            });
        }

        it('should find product by property type and LOD', () => {
            const product = findProductByAttributes({
                propertyType: 'Commercial',
                lod: '300'
            });

            expect(product).toBeDefined();
            expect(product?.sku).toBe('S2P-COM-300-FULL');
        });

        it('should find discipline addon by attributes', () => {
            const product = findProductByAttributes({
                discipline: 'MEP',
                lod: '300'
            });

            expect(product).toBeDefined();
            expect(product?.sku).toBe('ADD-MEP-300');
        });

        it('should return undefined for non-matching attributes', () => {
            const product = findProductByAttributes({
                propertyType: 'Industrial',
                lod: '400'
            });

            expect(product).toBeUndefined();
        });
    });

    describe('SKU Generation', () => {
        function generatePrimarySku(buildingType: string, lod: string, scope: string): string {
            const typeMap: Record<string, string> = {
                '1': 'COM',  // Commercial
                '2': 'RES',  // Residential
                '9': 'IND',  // Industrial
            };
            const typeCode = typeMap[buildingType] || 'COM';
            const scopeCode = scope === 'full' ? 'FULL' : scope === 'interior' ? 'INT' : 'EXT';
            return `S2P-${typeCode}-${lod}-${scopeCode}`;
        }

        it('should generate correct SKU for Commercial LOD 300 Full', () => {
            const sku = generatePrimarySku('1', '300', 'full');
            expect(sku).toBe('S2P-COM-300-FULL');
        });

        it('should generate correct SKU for Residential LOD 200 Full', () => {
            const sku = generatePrimarySku('2', '200', 'full');
            expect(sku).toBe('S2P-RES-200-FULL');
        });

        it('should generate correct SKU for interior scope', () => {
            const sku = generatePrimarySku('1', '300', 'interior');
            expect(sku).toBe('S2P-COM-300-INT');
        });
    });

    describe('Price Lookup', () => {
        it('should return price as string (for decimal precision)', () => {
            const product = mockProducts.find(p => p.sku === 'S2P-COM-300-FULL');

            expect(typeof product?.price).toBe('string');
            expect(product?.price).toBe('0.12');
        });

        it('should parse price to number for calculations', () => {
            const product = mockProducts.find(p => p.sku === 'S2P-COM-300-FULL');
            const price = parseFloat(product?.price || '0');

            expect(price).toBe(0.12);
            expect(typeof price).toBe('number');
        });

        it('should calculate line total from sqft and rate', () => {
            const product = mockProducts.find(p => p.sku === 'S2P-COM-300-FULL');
            const rate = parseFloat(product?.price || '0');
            const sqft = 10000;
            const total = sqft * rate;

            expect(total).toBe(1200);
        });
    });

    describe('Product Search', () => {
        it('should search by name (case-insensitive)', () => {
            const search = 'mep';
            const results = mockProducts.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase())
            );

            expect(results.length).toBe(1);
            expect(results[0].sku).toBe('ADD-MEP-300');
        });

        it('should search by SKU partial match', () => {
            const search = 'S2P';
            const results = mockProducts.filter(p =>
                p.sku.includes(search)
            );

            expect(results.length).toBe(2);
        });

        it('should combine category and search filters', () => {
            const category = 'S2P';
            const search = 'residential';
            const results = mockProducts.filter(p =>
                p.category === category &&
                p.name.toLowerCase().includes(search.toLowerCase())
            );

            expect(results.length).toBe(1);
            expect(results[0].sku).toBe('S2P-RES-200-FULL');
        });
    });
});
