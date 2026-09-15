"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { centsToDisplay, subtotalCents, taxCents, totalCents, dollarsToCents } from "@/lib/money";
import { Trash2, Plus } from "lucide-react";

export type EditableLineItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export function LineItemEditor({
  lineItems,
  onChange,
  taxRateBps,
  onTaxRateChange,
  currency = "USD",
}: {
  lineItems: EditableLineItem[];
  onChange: (items: EditableLineItem[]) => void;
  taxRateBps: number;
  onTaxRateChange: (bps: number) => void;
  currency?: string;
}) {
  const subtotal = useMemo(() => subtotalCents(lineItems), [lineItems]);
  const tax = useMemo(() => taxCents(subtotal, taxRateBps), [subtotal, taxRateBps]);
  const total = totalCents(subtotal, tax);

  function updateItem(index: number, patch: Partial<EditableLineItem>) {
    const next = lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(lineItems.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...lineItems, { description: "", quantity: 1, unitPriceCents: 0 }]);
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        {lineItems.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-2">
            <Input
              placeholder="Description"
              className="flex-1 basis-40"
              value={item.description}
              onChange={(e) => updateItem(i, { description: e.target.value })}
            />
            <Input
              type="number"
              min={0}
              step="0.5"
              placeholder="Qty"
              className="w-20"
              value={item.quantity}
              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 0 })}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Unit price"
              className="w-28"
              value={item.unitPriceCents / 100}
              onChange={(e) => updateItem(i, { unitPriceCents: dollarsToCents(Number(e.target.value) || 0) })}
            />
            <span className="w-24 text-right text-sm text-slate-300">
              {centsToDisplay(item.quantity * item.unitPriceCents, currency)}
            </span>
            <button
              onClick={() => removeItem(i)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-400"
              aria-label="Remove line item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={addItem} className="mt-2">
        <Plus className="h-4 w-4" /> Add line item
      </Button>

      <div className="mt-4 flex flex-col items-end gap-1 border-t border-white/10 pt-4 text-sm">
        <div className="flex w-56 justify-between text-slate-400">
          <span>Subtotal</span>
          <span>{centsToDisplay(subtotal, currency)}</span>
        </div>
        <div className="flex w-56 items-center justify-between text-slate-400">
          <span>Tax rate (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="w-20 text-right"
            value={taxRateBps / 100}
            onChange={(e) => onTaxRateChange(Math.round((Number(e.target.value) || 0) * 100))}
          />
        </div>
        <div className="flex w-56 justify-between text-slate-400">
          <span>Tax</span>
          <span>{centsToDisplay(tax, currency)}</span>
        </div>
        <div className="flex w-56 justify-between border-t border-white/10 pt-1 font-semibold text-white">
          <span>Total</span>
          <span>{centsToDisplay(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
