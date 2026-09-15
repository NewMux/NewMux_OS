"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { DeductionType, DeductionKind } from "@/lib/data/types";

export function DeductionTypesPanel({ deductionTypes }: { deductionTypes: DeductionType[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DeductionKind>("percentage");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/finance/deduction-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind }),
    });
    setSaving(false);
    setName("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deduction Types</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-slate-500">
        Marketer commissions are tracked the same way — add a &quot;Referral Fee&quot;-style deduction here and attach
        it to the relevant project&apos;s split rule below, rather than a separate commission system (PRD 15.4).
      </p>
      <div className="mb-3 flex flex-col gap-1">
        {deductionTypes.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 text-sm">
            <span className="text-slate-200">{d.name}</span>
            <Badge className="bg-slate-500/20 text-slate-300 capitalize">{d.kind}</Badge>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="New deduction type"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
          required
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DeductionKind)}
          className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="percentage">% of invoice</option>
          <option value="fixed">Fixed amount</option>
        </select>
        <Button type="submit" size="sm" disabled={saving || !name}>
          Add
        </Button>
      </form>
    </Card>
  );
}
