/**
 * ProposalEstimateTable Component
 *
 * Fully editable estimate table matching QuickBooks/PandaDoc format.
 * Supports add/remove rows, editable cells, auto-calculation.
 */

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProposalLineItem } from "@shared/schema/types";

interface ProposalEstimateTableProps {
  lineItems: ProposalLineItem[];
  onChange: (items: ProposalLineItem[]) => void;
  onBlur?: () => void;
  clientName?: string;
  clientCompany?: string;
  estimateNumber?: string;
  estimateDate?: string;
  disabled?: boolean;
}

// Format currency for display
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Format number with commas
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

// Parse number from string (handles currency symbols, commas)
function parseNumber(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Generate unique ID
function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ProposalEstimateTable({
  lineItems,
  onChange,
  onBlur,
  clientName = '',
  clientCompany = '',
  estimateNumber = '',
  estimateDate = '',
  disabled = false,
}: ProposalEstimateTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // Update a specific field in a line item
  const updateItem = useCallback((id: string, field: keyof ProposalLineItem, value: any) => {
    const updated = lineItems.map(item => {
      if (item.id !== id) return item;

      const newItem = { ...item, [field]: value };

      // Auto-calculate amount when qty or rate changes
      if (field === 'qty' || field === 'rate') {
        newItem.amount = Number(newItem.qty) * Number(newItem.rate);
      }

      return newItem;
    });
    onChange(updated);
  }, [lineItems, onChange]);

  // Add a new row
  const addRow = useCallback(() => {
    const newItem: ProposalLineItem = {
      id: generateId(),
      itemName: '',
      description: '',
      qty: 0,
      rate: 0,
      amount: 0,
    };
    onChange([...lineItems, newItem]);
  }, [lineItems, onChange]);

  // Remove a row
  const removeRow = useCallback((id: string) => {
    if (lineItems.length > 1) {
      onChange(lineItems.filter(item => item.id !== id));
    }
  }, [lineItems, onChange]);

  // Calculate total
  const total = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Editable cell component
  const EditableCell = ({
    value,
    onChange: onCellChange,
    type = 'text',
    className,
    align = 'left',
    cellId,
  }: {
    value: string | number;
    onChange: (value: any) => void;
    type?: 'text' | 'number' | 'currency' | 'textarea';
    className?: string;
    align?: 'left' | 'right' | 'center';
    cellId: string;
  }) => {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const isEditing = editingCell === cellId;
    const [localValue, setLocalValue] = useState(String(value));

    const handleClick = () => {
      if (!disabled) {
        setEditingCell(cellId);
        setLocalValue(String(value));
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    const handleBlur = () => {
      setEditingCell(null);
      if (type === 'number' || type === 'currency') {
        onCellChange(parseNumber(localValue));
      } else {
        onCellChange(localValue);
      }
      onBlur?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && type !== 'textarea') {
        e.preventDefault();
        inputRef.current?.blur();
      }
      if (e.key === 'Escape') {
        setLocalValue(String(value));
        setEditingCell(null);
      }
      if (e.key === 'Tab') {
        // Let tab work normally for navigation
      }
    };

    const displayValue = type === 'currency'
      ? formatCurrency(Number(value))
      : type === 'number'
        ? formatNumber(Number(value))
        : String(value);

    if (isEditing) {
      if (type === 'textarea') {
        return (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full p-1 border border-blue-300 rounded text-sm bg-white outline-none resize-none",
              className
            )}
            rows={4}
          />
        );
      }

      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full p-1 border border-blue-300 rounded text-sm bg-white outline-none",
            align === 'right' && "text-right",
            className
          )}
        />
      );
    }

    return (
      <div
        onClick={handleClick}
        className={cn(
          "p-1 rounded cursor-text min-h-[1.5em] transition-colors",
          !disabled && "hover:bg-blue-50",
          align === 'right' && "text-right",
          !value && !disabled && "text-gray-400 italic",
          className
        )}
      >
        {displayValue || (disabled ? '' : 'Click to edit')}
      </div>
    );
  };

  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Header with company info */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b">
        <div className="text-sm text-gray-600">
          <div className="font-bold text-lg text-black mb-1">SCAN2PLAN</div>
          <div>188 1st St</div>
          <div>Troy, NY 12180 US</div>
          <div>admin@scan2plan.io</div>
        </div>
        <div>
          <img
            src="/logo-cover.png"
            alt="Scan2Plan"
            className="h-16 object-contain"
          />
        </div>
      </div>

      {/* Estimate title and metadata */}
      <h2 className="text-2xl font-semibold text-[#4285f4] mb-4">Estimate</h2>

      <div className="flex justify-between mb-6">
        <div className="text-sm">
          <div className="text-gray-500 text-xs uppercase tracking-wide">ADDRESS</div>
          <div className="font-medium">{clientName}</div>
          <div>{clientCompany}</div>
        </div>
        <div className="text-sm text-right">
          <div className="flex gap-8">
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">ESTIMATE</div>
              <div>{estimateNumber}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">DATE</div>
              <div>{estimateDate}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#e8f0fe]">
            {!disabled && <th className="w-8 p-3"></th>}
            <th className="text-left p-3 text-[#4285f4] text-xs uppercase tracking-wide font-medium w-1/4">
              Description
            </th>
            <th className="text-left p-3 text-[#4285f4] text-xs uppercase tracking-wide font-medium">
              Details
            </th>
            <th className="text-right p-3 text-[#4285f4] text-xs uppercase tracking-wide font-medium w-20">
              QTY
            </th>
            <th className="text-right p-3 text-[#4285f4] text-xs uppercase tracking-wide font-medium w-20">
              RATE
            </th>
            <th className="text-right p-3 text-[#4285f4] text-xs uppercase tracking-wide font-medium w-24">
              AMOUNT
            </th>
            {!disabled && <th className="w-10 p-3"></th>}
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr
              key={item.id}
              className="border-b border-gray-100 group hover:bg-gray-50/50"
            >
              {!disabled && (
                <td className="p-2 text-center">
                  <GripVertical className="h-4 w-4 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100" />
                </td>
              )}
              <td className="p-2 align-top">
                <EditableCell
                  value={item.itemName}
                  onChange={(v) => updateItem(item.id, 'itemName', v)}
                  cellId={`${item.id}-name`}
                  className="font-medium"
                />
              </td>
              <td className="p-2 align-top">
                <EditableCell
                  value={item.description}
                  onChange={(v) => updateItem(item.id, 'description', v)}
                  type="textarea"
                  cellId={`${item.id}-desc`}
                  className="text-sm text-gray-600 whitespace-pre-wrap"
                />
              </td>
              <td className="p-2 align-top">
                <EditableCell
                  value={item.qty}
                  onChange={(v) => updateItem(item.id, 'qty', v)}
                  type="number"
                  align="right"
                  cellId={`${item.id}-qty`}
                />
              </td>
              <td className="p-2 align-top">
                <EditableCell
                  value={item.rate}
                  onChange={(v) => updateItem(item.id, 'rate', v)}
                  type="number"
                  align="right"
                  cellId={`${item.id}-rate`}
                />
              </td>
              <td className="p-2 align-top text-right font-medium">
                {formatCurrency(item.amount)}
              </td>
              {!disabled && (
                <td className="p-2 text-center">
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeRow(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                      title="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {/* Add row button */}
          {!disabled && (
            <tr>
              <td colSpan={7} className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addRow}
                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line Item
                </Button>
              </td>
            </tr>
          )}
          {/* Total row */}
          <tr className="border-t-2 border-dashed border-gray-200">
            <td colSpan={disabled ? 4 : 5} className="p-3 text-right font-medium">
              TOTAL
            </td>
            <td className="p-3 text-right text-xl font-bold">
              {formatCurrency(total)}
            </td>
            {!disabled && <td></td>}
          </tr>
        </tfoot>
      </table>

      {/* Signature section */}
      <div className="mt-12 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-sm text-gray-500 mb-1">Accepted By</div>
            <div className="border-b border-gray-300 h-8"></div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-sm text-gray-500 mb-1">Accepted Date</div>
            <div className="border-b border-gray-300 h-8"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
