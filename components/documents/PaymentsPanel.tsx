"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { centsToDisplay } from "@/lib/money";
import type { Payment, PaymentMethod } from "@/lib/data/types";

export function PaymentsPanel({
  documentId,
  currency,
  totalCents,
  payments,
}: {
  documentId: string;
  currency: string;
  totalCents: number;
  payments: Payment[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [saving, setSaving] = useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const remaining = Math.max(totalCents - totalPaid, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/documents/${documentId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), method }),
    });
    setSaving(false);
    setAmount("");
    router.refresh();
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Total paid</p>
          <p className="text-sm font-semibold text-foreground">{centsToDisplay(totalPaid, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Remaining balance</p>
          <p className="text-sm font-semibold text-foreground">{centsToDisplay(remaining, currency)}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-1 border-t border-border pt-3">
        {payments.length === 0 && <p className="text-xs text-muted-foreground">No payments recorded yet.</p>}
        {payments.map((p) => (
          <p key={p.id} className="text-xs text-muted-foreground">
            {centsToDisplay(p.amountCents, currency)} · {p.method} · {new Date(p.date).toLocaleString()}
          </p>
        ))}
      </div>

      {remaining > 0 && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            step="0.001"
            placeholder={`Amount (${currency})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="max-w-[160px]"
            required
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="transfer">Transfer</option>
            <option value="cash">Cash</option>
          </select>
          <Button type="submit" size="sm" disabled={saving || !amount}>
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </form>
      )}
    </Card>
  );
}
