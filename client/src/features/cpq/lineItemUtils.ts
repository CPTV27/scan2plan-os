/**
 * Line Item Utilities
 * 
 * Helper functions for converting pricing results to editable line items
 */

import type { PricingResult } from "./pricing";
import type { QuoteLineItem } from "./LineItemEditor";
import type { QuoteLineItemSku } from "@/lib/productResolver";

/**
 * Generate editable line items from pricing result and SKU manifest
 */
export function generateEditableLineItems(
    pricing: PricingResult,
    lineItemSkus: QuoteLineItemSku[]
): QuoteLineItem[] {
    return pricing.items.map((item, index) => {
        const skuData = lineItemSkus[index];

        // Determine category from item label
        const category = determineCategory(item.label, skuData?.category);

        return {
            id: `item-${index}`,
            sku: skuData?.sku,
            productId: undefined, // Product ID tracked separately in area data
            description: item.label,
            quantity: skuData?.quantity || 1,
            unitPrice: item.value / (skuData?.quantity || 1),
            total: item.value,
            category,
            isCustom: false,
            isModified: false,
        };
    });
}

/**
 * Determine line item category from description or SKU category
 */
function determineCategory(
    description: string,
    skuCategory?: string
): QuoteLineItem['category'] {
    if (skuCategory) {
        if (skuCategory === 'primary') return 'primary';
        if (skuCategory === 'discipline') return 'discipline';
        if (skuCategory === 'service') return 'service';
        if (skuCategory === 'modifier') return 'modifier';
        if (skuCategory === 'travel') return 'travel';
    }

    // Fallback to label-based detection
    const lower = description.toLowerCase();
    if (lower.includes('travel') || lower.includes('mileage')) return 'travel';
    if (lower.includes('risk') || lower.includes('premium')) return 'modifier';
    if (lower.includes('matterport') || lower.includes('cad') || lower.includes('scanning')) return 'service';
    if (lower.includes('mep') || lower.includes('structure') || lower.includes('site')) return 'discipline';
    if (lower.includes('s2p') || lower.includes('scan2plan')) return 'primary';

    return 'custom';
}

/**
 * Convert customized line items back to SKU manifest for QB sync
 */
export function lineItemsToSkuManifest(lineItems: QuoteLineItem[]): QuoteLineItemSku[] {
    return lineItems
        .filter(item => item.sku && item.category !== 'custom') // Only items with SKUs, exclude custom
        .map(item => ({
            sku: item.sku!,
            name: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            category: item.category as QuoteLineItemSku['category'], // Type assertion now safe after filter
            description: item.description,
        }));
}
