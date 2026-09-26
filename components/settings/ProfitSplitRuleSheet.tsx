"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MinusCircle, Plus } from "lucide-react";
import { FormSheet } from "@/components/ui/FormSheet";
import { ListSection } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { DeleteRow } from "@/components/forms/Fields";
import { useConfirm } from "@/components/ui/Confirm";
import { useMutation } from "@/lib/useMutation";
import { cn } from "@/lib/utils";
import type { DeductionBase, DeductionType, Party, ProfitSplitRule } from "@/lib/data/types";

export type Scope = { scopeType: "project" | "venture" | "document"; scopeId: string; name: string };

type SplitRow = { partyId: string; percentage: string };
type DeductionRow = { deductionTypeId: string; value: string; base: DeductionBase };

/**
 * Edit how one project's, venture's or invoice's profit is split, and what
 * comes off first — in order, each percentage taken from the invoice total
 * or from what remains after the lines above it (item 4).
 */
export function ProfitSplitRuleSheet({
  open,
  onOpenChange,
  scope,
  rule,
  template,
  parties,
  deductionTypes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scope: Scope;
  rule?: ProfitSplitRule;
  /** Starting point when there is no rule yet (e.g. the project's rule, for an invoice override). */
  template?: ProfitSplitRule;
  parties: Party[];
  deductionTypes: DeductionType[];
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const typeOf = (id: string) => deductionTypes.find((t) => t.id === id);
  const kindOf = (id: string) => typeOf(id)?.kind;
  const fundName = (id: string) => parties.find((p) => p.id === typeOf(id)?.fundPartyId)?.name;

  useEffect(() => {
    if (!open) return;
    const source = rule ?? template;
    setSplits(
      source?.splits.map((s) => ({ partyId: s.partyId, percentage: String(s.percentageBps / 100) })) ??
        parties
          .filter((p) => p.kind === "partner")
          .slice(0, 2)
          .map((p, _i, arr) => ({ partyId: p.id, percentage: String(100 / arr.length) })),
    );
    setDeductions(
      source?.deductions.map((d) => ({
        deductionTypeId: d.deductionTypeId,
        value: String(kindOf(d.deductionTypeId) === "percentage" ? d.value / 100 : d.value / 1000),
        base: d.base ?? "total",
      })) ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule, template]);

  const total = splits.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
  const valid = Math.abs(total - 100) < 0.001 && splits.every((s) => s.partyId) && deductions.every((d) => d.deductionTypeId);
  const move = (i: number, dir: -1 | 1) =>
    setDeductions((ds) => {
      const next = [...ds];
      const j = i + dir;
      if (j < 0 || j >= next.length) return ds;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const submit = async () =>
    !!(await run("/api/finance/profit-split-rules", {
      body: {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        splits: splits.map((s) => ({ partyId: s.partyId, percentageBps: Math.round((Number(s.percentage) || 0) * 100) })),
        deductions: deductions.map((d) => ({
          deductionTypeId: d.deductionTypeId,
          value: kindOf(d.deductionTypeId) === "percentage" ? Math.round((Number(d.value) || 0) * 100) : Math.round((Number(d.value) || 0) * 1000),
          base: d.base,
        })),
      },
      success: "Split rule saved",
    }));

  const remove = async () => {
    if (!rule) return;
    const invoice = scope.scopeType === "document";
    if (
      await confirm({
        title: invoice ? "Remove this invoice's custom split?" : `Delete the split rule for ${scope.name}?`,
        message: invoice ? "It goes back to its project's rule." : "Invoices that follow it lose their partner split.",
        destructive: true,
      })
    ) {
      if (await run(`/api/finance/profit-split-rules/${rule.id}`, { method: "DELETE", success: invoice ? "Custom split removed" : "Rule deleted" })) onOpenChange(false);
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={scope.name} submitLabel="Save" canSubmit={valid} onSubmit={submit}>
      <ListSection
        header="Deductions, in order"
        footer="Costs charged to an invoice come off first. Then each line in this order: fixed amounts are in BHD; a percentage is taken from the invoice total or from what remains after the lines above it. A line that feeds a fund sets money aside instead of counting as a cost."
      >
        {deductions.map((row, i) => {
          const percentage = kindOf(row.deductionTypeId) === "percentage";
          const fund = fundName(row.deductionTypeId);
          return (
            <div key={i} className="py-2 pl-3 pr-4 hairline-b">
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Remove" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}>
                  <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
                </button>
                <span className="w-4 text-center text-footnote text-label-2 tabular">{i + 1}</span>
                <Select value={row.deductionTypeId} onChange={(e) => setDeductions(deductions.map((r, j) => (j === i ? { ...r, deductionTypeId: e.target.value } : r)))} className="flex-1 text-left text-label">
                  <option value="">Choose deduction…</option>
                  {deductionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <input
                  inputMode="decimal"
                  value={row.value}
                  onChange={(e) => setDeductions(deductions.map((r, j) => (j === i ? { ...r, value: e.target.value.replace(/[^0-9.]/g, "") } : r)))}
                  className="ml-auto w-20 rounded-md bg-fill/[0.12] px-2 py-1 text-right tabular focus:outline-none"
                  aria-label="Value"
                />
                <span className="w-8 text-label-2">{percentage ? "%" : "BHD"}</span>
                <span className="flex flex-col">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="text-label-2 disabled:opacity-25">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Move down" disabled={i === deductions.length - 1} onClick={() => move(i, 1)} className="text-label-2 disabled:opacity-25">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </span>
              </div>
              {(percentage || fund) && (
                <div className="ml-[52px] mt-1 flex flex-wrap items-center gap-x-2 text-footnote text-label-2">
                  {percentage && (
                    <>
                      <span>of</span>
                      <Select
                        value={row.base}
                        onChange={(e) => setDeductions(deductions.map((r, j) => (j === i ? { ...r, base: e.target.value as DeductionBase } : r)))}
                        className="text-left text-footnote text-accent"
                        aria-label="Taken from"
                      >
                        <option value="remaining">what remains above</option>
                        <option value="total">the invoice total</option>
                      </Select>
                    </>
                  )}
                  {fund && <span className="rounded-full bg-ios-purple/15 px-2 py-0.5 text-caption1 font-medium text-ios-purple">Goes to {fund}</span>}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setDeductions([...deductions, { deductionTypeId: "", value: "", base: "remaining" }])}
          className="flex min-h-[44px] w-full items-center gap-2 px-3 text-accent"
        >
          <Plus className="h-5 w-5 rounded-full bg-ios-green p-0.5 text-white" strokeWidth={3} />
          Add Deduction
        </button>
      </ListSection>

      <ListSection header="Split what's left" footer={<span className={cn(Math.abs(total - 100) < 0.001 ? "text-ios-green" : "text-ios-orange")}>Total {total.toFixed(2)}% — must be exactly 100%</span>}>
        {splits.map((row, i) => (
          <div key={i} className="flex items-center gap-2 py-2 pl-3 pr-4 hairline-b">
            <button type="button" aria-label="Remove" onClick={() => setSplits(splits.filter((_, j) => j !== i))}>
              <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
            </button>
            <Select value={row.partyId} onChange={(e) => setSplits(splits.map((r, j) => (j === i ? { ...r, partyId: e.target.value } : r)))} className="flex-1 text-left text-label">
              <option value="">Choose party…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <input
              inputMode="decimal"
              value={row.percentage}
              onChange={(e) => setSplits(splits.map((r, j) => (j === i ? { ...r, percentage: e.target.value.replace(/[^0-9.]/g, "") } : r)))}
              className="ml-auto w-16 rounded-md bg-fill/[0.12] px-2 py-1 text-right tabular focus:outline-none"
              aria-label="Percentage"
            />
            <span className="text-label-2">%</span>
          </div>
        ))}
        <button type="button" onClick={() => setSplits([...splits, { partyId: "", percentage: "" }])} className="flex min-h-[44px] w-full items-center gap-2 px-3 text-accent">
          <Plus className="h-5 w-5 rounded-full bg-ios-green p-0.5 text-white" strokeWidth={3} />
          Add Party
        </button>
      </ListSection>
      {rule && <DeleteRow label={scope.scopeType === "document" ? "Remove Custom Split" : "Delete Rule"} onClick={remove} />}
    </FormSheet>
  );
}
