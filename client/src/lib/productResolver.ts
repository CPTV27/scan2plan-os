/**
 * Product Resolver - SKU Resolution Utilities
 * 
 * Provides functions to resolve CPQ configurations to official QuickBooks SKUs.
 * Used to enrich quote data with product references for accurate QB sync.
 */

export interface ProductSkuResult {
    sku: string;
    found: boolean;
    product: {
        id: number;
        sku: string;
        name: string;
        description: string | null;
        category: string;
        price: string;
        pricingModel: string;
    } | null;
}

export interface QuoteLineItemSku {
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    category: 'primary' | 'discipline' | 'service' | 'modifier' | 'travel';
    description?: string | null;
}

/**
 * Resolve a CPQ configuration to an official product SKU
 * 
 * @example
 * const result = await resolveProductSku({
 *   buildingType: '1',
 *   lod: '300',
 *   scope: 'full'
 * });
 * // { sku: 'S2P COM 300', found: true, product: {...} }
 */
export async function resolveProductSku(config: {
    buildingType?: string;
    discipline?: string;
    lod: string;
    scope?: string;
    service?: string;
    modifier?: string;
}): Promise<ProductSkuResult | null> {
    try {
        const response = await fetch('/api/products/resolve-sku', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            console.warn('Failed to resolve SKU:', config, response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error resolving product SKU:', error);
        return null;
    }
}

/**
 * Generate complete SKU manifest for a quote configuration
 * 
 * @example
 * const lineItems = await generateQuoteSkus({
 *   areas: [{ buildingType: '1', disciplines: ['architecture', 'mepf'], ... }],
 *   services: { matterport: 2 },
 *   risks: ['occupied'],
 *   paymentTerms: 'net_30'
 * });
 * // [{ sku: 'S2P COM 300', name: '...', quantity: 1, category: 'primary' }, ...]
 */
export async function generateQuoteSkus(quoteData: {
    areas: Array<{
        buildingType: string;
        disciplines: string[];
        disciplineLods?: Record<string, { lod: string; scope?: string }>;
        squareFeet: string;
        lod?: string;
        scope?: string;
    }>;
    services: Record<string, number>;
    risks: string[];
    paymentTerms?: string;
}): Promise<QuoteLineItemSku[]> {
    try {
        const response = await fetch('/api/products/generate-quote-skus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(quoteData)
        });

        if (!response.ok) {
            console.warn('Failed to generate quote SKUs:', response.status);
            return [];
        }

        const data = await response.json();
        return data.lineItems || [];
    } catch (error) {
        console.error('Error generating quote SKUs:', error);
        return [];
    }
}

/**
 * Enrich an area with product SKU data
 * Resolves primary service and all discipline SKUs for an area
 */
export async function enrichAreaWithProducts(area: {
    buildingType: string;
    disciplines: string[];
    disciplineLods?: Record<string, { lod: string; scope?: string }>;
    lod: string;
    scope?: string;
    [key: string]: any;
}) {
    // Resolve primary service (architecture or main discipline)
    const primarySku = await resolveProductSku({
        buildingType: area.buildingType,
        discipline: area.disciplines.includes('architecture') ? 'architecture' : undefined,
        lod: area.lod,
        scope: area.scope || 'full'
    });

    // Resolve discipline SKUs (excluding architecture if it was primary)
    const disciplineProducts = await Promise.all(
        area.disciplines
            .filter(disc => disc !== 'architecture') // Architecture is the primary
            .map(async (disc) => {
                const discLod = area.disciplineLods?.[disc]?.lod || area.lod;
                const discScope = area.disciplineLods?.[disc]?.scope;

                const result = await resolveProductSku({
                    buildingType: area.buildingType,
                    discipline: disc,
                    lod: discLod,
                    scope: discScope
                });

                return result ? {
                    discipline: disc,
                    sku: result.sku,
                    productId: result.product?.id,
                    productName: result.product?.name
                } : null;
            })
    );

    return {
        ...area,
        productSku: primarySku?.sku,
        productId: primarySku?.product?.id,
        productName: primarySku?.product?.name,
        disciplineProducts: disciplineProducts.filter((p): p is NonNullable<typeof p> => p !== null)
    };
}
