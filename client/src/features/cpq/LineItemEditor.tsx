/**
 * Line Item Editor - Manual Quote Customization
 * 
 * Allows editing auto-generated line items and adding custom items
 * while preserving SKU tracking for QuickBooks sync.
 */

import { useState, useMemo } from "react";
import { Grip, Plus, Trash2, Edit2, Save, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PricingResult } from "./pricing";

export interface QuoteLineItem {
    id: string;
    sku?: string; // Optional for custom items
    productId?: number;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    category: 'primary' | 'discipline' | 'service' | 'modifier' | 'travel' | 'custom';
    isCustom: boolean; // User-added item
    isModified: boolean; // Auto-generated but edited
}

interface LineItemEditorProps {
    initialLineItems: QuoteLineItem[];
    calculatedPricing: PricingResult;
    onSave: (customizedItems: QuoteLineItem[], customTotal: number) => void;
    onCancel: () => void;
}

export function LineItemEditor({
    initialLineItems,
    calculatedPricing,
    onSave,
    onCancel,
}: LineItemEditorProps) {
    const [lineItems, setLineItems] = useState<QuoteLineItem[]>(initialLineItems);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);

    // Calculate totals
    const customTotal = useMemo(() => {
        return lineItems.reduce((sum, item) => sum + item.total, 0);
    }, [lineItems]);

    const customMargin = useMemo(() => {
        if (customTotal === 0) return 0;
        const cost = calculatedPricing.totalUpteamCost;
        return ((customTotal - cost) / customTotal) * 100;
    }, [customTotal, calculatedPricing]);

    const originalTotal = calculatedPricing.totalClientPrice;
    const originalMargin = calculatedPricing.profitMargin * 100;

    // Update line item
    const updateLineItem = (id: string, field: keyof QuoteLineItem, value: any) => {
        setLineItems(items =>
            items.map(item => {
                if (item.id !== id) return item;

                const updated = { ...item, [field]: value };

                // Recalculate total if quantity or unitPrice changed
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.total = updated.quantity * updated.unitPrice;
                }

                // Mark as modified if not custom
                if (!item.isCustom) {
                    updated.isModified = true;
                }

                return updated;
            })
        );
    };

    // Remove line item
    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) {
            setLineItems(items => items.filter(item => item.id !== id));
        }
    };

    // Add custom line item
    const addCustomLineItem = (description: string, quantity: number, unitPrice: number, category: string) => {
        const newItem: QuoteLineItem = {
            id: `custom-${Date.now()}`,
            description,
            quantity,
            unitPrice,
            total: quantity * unitPrice,
            category: category as QuoteLineItem['category'],
            isCustom: true,
            isModified: false,
        };
        setLineItems(items => [...items, newItem]);
        setShowAddDialog(false);
    };

    const marginBelowGate = customMargin < 40;

    return (
        <div className="fixed inset-0 bg-background/95 z-50 overflow-auto">
            <div className="container max-w-5xl mx-auto py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">Customize Line Items</h2>
                        <p className="text-sm text-muted-foreground">
                            Edit prices, add custom items, and adjust your quote
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onCancel}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onSave(lineItems, customTotal)}
                            disabled={marginBelowGate}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* Pricing Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Pricing Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="text-sm text-muted-foreground">Calculated Total</div>
                                <div className="text-2xl font-semibold">${originalTotal.toLocaleString()}</div>
                                <div className="text-sm text-muted-foreground">Margin: {originalMargin.toFixed(1)}%</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Custom Total</div>
                                <div className="text-2xl font-semibold text-primary">
                                    ${customTotal.toLocaleString()}
                                </div>
                                <div className={`text-sm ${marginBelowGate ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                    Margin: {customMargin.toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        {marginBelowGate && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Margin below 40% governance gate. Adjust pricing before saving.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Add Custom Item Button */}
                <div>
                    <Button
                        variant="outline"
                        onClick={() => setShowAddDialog(true)}
                        className="w-full"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Line Item
                    </Button>
                </div>

                {/* Line Items Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-24">Qty</TableHead>
                                    <TableHead className="w-32">Unit Price</TableHead>
                                    <TableHead className="w-32">Total</TableHead>
                                    <TableHead className="w-24">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lineItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Grip className="h-4 w-4 text-muted-foreground cursor-move" />
                                        </TableCell>
                                        <TableCell>
                                            {editingId === item.id ? (
                                                <Input
                                                    value={item.description}
                                                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                                                    onBlur={() => setEditingId(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') setEditingId(null);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                    autoFocus
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span>{item.description}</span>
                                                    {item.isCustom && (
                                                        <Badge variant="secondary" className="text-xs">Custom</Badge>
                                                    )}
                                                    {item.isModified && (
                                                        <Badge variant="outline" className="text-xs">Modified</Badge>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="1"
                                                className="w-full"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={item.unitPrice}
                                                onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                                className="w-full"
                                            />
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            ${item.total.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditingId(item.id)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeLineItem(item.id)}
                                                    disabled={lineItems.length === 1}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Add Custom Item Dialog */}
            {showAddDialog && (
                <AddCustomItemDialog
                    onAdd={addCustomLineItem}
                    onCancel={() => setShowAddDialog(false)}
                />
            )}
        </div>
    );
}

// Add Custom Item Dialog Component
interface AddCustomItemDialogProps {
    onAdd: (description: string, quantity: number, unitPrice: number, category: string) => void;
    onCancel: () => void;
}

function AddCustomItemDialog({ onAdd, onCancel }: AddCustomItemDialogProps) {
    const [description, setDescription] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);
    const [category, setCategory] = useState("custom");

    const handleAdd = () => {
        if (description && quantity > 0) {
            onAdd(description, quantity, unitPrice, category);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Add Custom Line Item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., Custom Labor, Equipment Rental"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                                min="1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Unit Price</Label>
                            <Input
                                type="number"
                                value={unitPrice}
                                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="custom">Custom</SelectItem>
                                <SelectItem value="service">Service</SelectItem>
                                <SelectItem value="travel">Travel</SelectItem>
                                <SelectItem value="modifier">Modifier</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2 pt-4">
                        <Button variant="outline" onClick={onCancel} className="flex-1">
                            Cancel
                        </Button>
                        <Button onClick={handleAdd} disabled={!description} className="flex-1">
                            Add Item
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
