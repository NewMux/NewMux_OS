"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash2 } from "lucide-react";
import type {
  Party,
  DeductionType,
  ProfitSplitRule,
  Project,
  Venture,
} from "@/lib/data/types";

type SplitRow = { partyId: string; percentage: string };
type DeductionRow = { deductionTypeId: string; value: string };

export function ProfitSplitRuleEditor({
  parties,
  deductionTypes,
  rules,
  projects,
  ventures,
}: {
  parties: Party[];
  deductionTypes: DeductionType[];
  rules: ProfitSplitRule[];
  projects: Project[];
  ventures: Venture[];
}) {
  const router = useRouter();
  const scopes = useMemo(
    () => [
      ...projects.map((p) => ({
        scopeType: "project" as const,
        scopeId: p.id,
        label: `Project: ${p.name}`,
      })),
      ...ventures.map((v) => ({
        scopeType: "venture" as const,
        scopeId: v.id,
        label: `Venture: ${v.name}`,
      })),
    ],
    [projects, ventures],
  );

  const [scopeKey, setScopeKey] = useState(
    scopes[0] ? `${scopes[0].scopeType}:${scopes[0].scopeId}` : "",
  );
  const selectedScope = scopes.find(
    (s) => `${s.scopeType}:${s.scopeId}` === scopeKey,
  );
  const existingRule = rules.find(
    (r) =>
      r.scopeType === selectedScope?.scopeType &&
      r.scopeId === selectedScope?.scopeId,
  );

  const [splits, setSplits] = useState<SplitRow[]>(
    existingRule?.splits.map((s) => ({
      partyId: s.partyId,
      percentage: String(s.percentageBps / 100),
    })) ?? [],
  );
  const [deductions, setDeductions] = useState<DeductionRow[]>(
    existingRule?.deductions.map((d) => ({
      deductionTypeId: d.deductionTypeId,
      value: String(
        deductionTypes.find((t) => t.id === d.deductionTypeId)?.kind ===
          "percentage"
          ? d.value / 100
          : d.value / 1000,
      ),
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadScope(key: string) {
    setScopeKey(key);
    const scope = scopes.find((s) => `${s.scopeType}:${s.scopeId}` === key);
    const rule = rules.find(
      (r) => r.scopeType === scope?.scopeType && r.scopeId === scope?.scopeId,
    );
    setSplits(
      rule?.splits.map((s) => ({
        partyId: s.partyId,
        percentage: String(s.percentageBps / 100),
      })) ?? [],
    );
    setDeductions(
      rule?.deductions.map((d) => ({
        deductionTypeId: d.deductionTypeId,
        value: String(
          deductionTypes.find((t) => t.id === d.deductionTypeId)?.kind ===
            "percentage"
            ? d.value / 100
            : d.value / 1000,
        ),
      })) ?? [],
    );
    setError(null);
  }

  const totalPct = splits.reduce(
    (sum, s) => sum + (Number(s.percentage) || 0),
    0,
  );

  async function handleSave() {
    if (!selectedScope) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/finance/profit-split-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeType: selectedScope.scopeType,
        scopeId: selectedScope.scopeId,
        splits: splits.map((s) => ({
          partyId: s.partyId,
          percentageBps: Math.round((Number(s.percentage) || 0) * 100),
        })),
        deductions: deductions.map((d) => {
          const type = deductionTypes.find((t) => t.id === d.deductionTypeId);
          const raw = Number(d.value) || 0;
          return {
            deductionTypeId: d.deductionTypeId,
            value:
              type?.kind === "percentage"
                ? Math.round(raw * 100)
                : Math.round(raw * 1000),
          };
        }),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string"
          ? body.error
          : "Could not save split rule.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit-Split Rules</CardTitle>
      </CardHeader>

      <select
        value={scopeKey}
        onChange={(e) => loadScope(e.target.value)}
        className="mb-4 min-h-[44px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
      >
        {scopes.map((s) => (
          <option
            key={`${s.scopeType}:${s.scopeId}`}
            value={`${s.scopeType}:${s.scopeId}`}
          >
            {s.label}
          </option>
        ))}
      </select>

      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Splits (must total 100%)
      </p>
      <div className="mb-3 flex flex-col gap-2">
        {splits.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={row.partyId}
              onChange={(e) =>
                setSplits(
                  splits.map((r, idx) =>
                    idx === i ? { ...r, partyId: e.target.value } : r,
                  ),
                )
              }
              className="min-h-[40px] flex-1 rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground"
            >
              <option value="">Select party…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              step="0.01"
              className="w-24"
              placeholder="%"
              value={row.percentage}
              onChange={(e) =>
                setSplits(
                  splits.map((r, idx) =>
                    idx === i ? { ...r, percentage: e.target.value } : r,
                  ),
                )
              }
            />
            <button
              onClick={() => setSplits(splits.filter((_, idx) => idx !== i))}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-danger"
              aria-label="Remove split"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setSplits([...splits, { partyId: "", percentage: "" }])
          }
        >
          <Plus className="h-4 w-4" /> Add party
        </Button>
        <p
          className={`text-xs ${totalPct === 100 ? "text-brand" : "text-warning"}`}
        >
          Total: {totalPct.toFixed(2)}%
        </p>
      </div>

      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Deductions (applied before the split)
      </p>
      <div className="mb-4 flex flex-col gap-2">
        {deductions.map((row, i) => {
          const type = deductionTypes.find((t) => t.id === row.deductionTypeId);
          return (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.deductionTypeId}
                onChange={(e) =>
                  setDeductions(
                    deductions.map((r, idx) =>
                      idx === i ? { ...r, deductionTypeId: e.target.value } : r,
                    ),
                  )
                }
                className="min-h-[40px] flex-1 rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground"
              >
                <option value="">Select deduction…</option>
                {deductionTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                step="0.01"
                className="w-28"
                placeholder={type?.kind === "percentage" ? "%" : "BHD"}
                value={row.value}
                onChange={(e) =>
                  setDeductions(
                    deductions.map((r, idx) =>
                      idx === i ? { ...r, value: e.target.value } : r,
                    ),
                  )
                }
              />
              <button
                onClick={() =>
                  setDeductions(deductions.filter((_, idx) => idx !== i))
                }
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-danger"
                aria-label="Remove deduction"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setDeductions([...deductions, { deductionTypeId: "", value: "" }])
          }
        >
          <Plus className="h-4 w-4" /> Add deduction
        </Button>
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <Button
        onClick={handleSave}
        disabled={saving || !selectedScope || splits.length === 0}
      >
        {saving ? "Saving…" : "Save split rule"}
      </Button>
    </Card>
  );
}
