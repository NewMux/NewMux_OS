"use client";

import { useEffect, useState } from "react";
import { MinusCircle, Plus } from "lucide-react";
import { FormSheet } from "@/components/ui/FormSheet";
import { ListSection } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { DeleteRow } from "@/components/forms/Fields";
import { useConfirm } from "@/components/ui/Confirm";
import { useMutation } from "@/lib/useMutation";
import { cn } from "@/lib/utils";
import type { DeductionType, Party, ProfitSplitRule } from "@/lib/data/types";

export type Scope = { scopeType: "project" | "venture"; scopeId: string; name: string };

type SplitRow = { partyId: string; percentage: string };
type DeductionRow = { deductionTypeId: string; value: string };

/** Edit how one project's (or venture's) profit is split and what's deducted first. */
export function ProfitSplitRuleSheet({
  open,
  onOpenChange,
  scope,
  rule,
  parties,
  deductionTypes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scope: Scope;
  rule?: ProfitSplitRule;
  parties: Party[];
  deductionTypes: DeductionType[];
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const kindOf = (id: string) => deductionTypes.find((t) => t.id === id)?.kind;

  useEffect(() => {
    if (!open) return;
    setSplits(
      rule?.splits.map((s) => ({ partyId: s.partyId, percentage: String(s.percentageBps / 100) })) ??
        parties.slice(0, 2).map((p, _i, arr) => ({ partyId: p.id, percentage: String(100 / arr.length) })),
    );
    setDeductions(
      rule?.deductions.map((d) => ({ deductionTypeId: d.deductionTypeId, value: String(kindOf(d.deductionTypeId) === "percentage" ? d.value / 100 : d.value / 1000) })) ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule]);

  const total = splits.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
  const valid = Math.abs(total - 100) < 0.001 && splits.every((s) => s.partyId) && deductions.every((d) => d.deductionTypeId);

  const submit = async () =>
    !!(await run("/api/finance/profit-split-rules", {
      body: {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        splits: splits.map((s) => ({ partyId: s.partyId, percentageBps: Math.round((Number(s.percentage) || 0) * 100) })),
        deductions: deductions.map((d) => ({
          deductionTypeId: d.deductionTypeId,
          value: kindOf(d.deductionTypeId) === "percentage" ? Math.round((Number(d.value) || 0) * 100) : Math.round((Number(d.value) || 0) * 1000),
        })),
      },
      success: "Split rule saved",
    }));

  const remove = async () => {
    if (!rule) return;
    if (await confirm({ title: `Delete the split rule for ${scope.name}?`, message: "Invoices already linked keep their numbers but lose the partner split.", destructive: true })) {
      if (await run(`/api/finance/profit-split-rules/${rule.id}`, { method: "DELETE", success: "Rule deleted" })) onOpenChange(false);
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={scope.name} submitLabel="Save" canSubmit={valid} onSubmit={submit}>
      <ListSection header="Split" footer={<span className={cn(Math.abs(total - 100) < 0.001 ? "text-ios-green" : "text-ios-orange")}>Total {total.toFixed(2)}% — must be exactly 100%</span>}>
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

      <ListSection header="Deductions" footer="Fixed amounts are in BHD. Recurring expenses linked to the project are deducted automatically as well.">
        {deductions.map((row, i) => (
          <div key={i} className="flex items-center gap-2 py-2 pl-3 pr-4 hairline-b">
            <button type="button" aria-label="Remove" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}>
              <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
            </button>
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
            <span className="w-8 text-label-2">{kindOf(row.deductionTypeId) === "fixed" ? "BHD" : "%"}</span>
          </div>
        ))}
        <button type="button" onClick={() => setDeductions([...deductions, { deductionTypeId: "", value: "" }])} className="flex min-h-[44px] w-full items-center gap-2 px-3 text-accent">
          <Plus className="h-5 w-5 rounded-full bg-ios-green p-0.5 text-white" strokeWidth={3} />
          Add Deduction
        </button>
      </ListSection>
      {rule && <DeleteRow label="Delete Rule" onClick={remove} />}
    </FormSheet>
  );
}
