"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/documents/SegmentedControl";
import { LineItemEditor, type EditableLineItem } from "@/components/documents/LineItemEditor";
import type { DocumentType, Client } from "@/lib/data/types";

export function NewDocumentForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [type, setType] = useState<DocumentType>("quote");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");
  const [taxRateBps, setTaxRateBps] = useState(0);
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([
    { description: "", quantity: 1, unitPriceCents: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        clientId,
        taxRateBps,
        paymentTerms,
        notes,
        lineItems: lineItems.filter((li) => li.description.trim().length > 0),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not create document — check that at least one line item has a description.");
      return;
    }
    const { document } = await res.json();
    router.push(`/documents/${document.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-white">New document</h1>
      <Card className="flex flex-col gap-4">
        <SegmentedControl
          options={[
            { value: "quote", label: "Quote" },
            { value: "contract", label: "Contract" },
            { value: "invoice", label: "Invoice" },
          ]}
          value={type}
          onChange={setType}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Payment terms</label>
          <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <LineItemEditor
          lineItems={lineItems}
          onChange={setLineItems}
          taxRateBps={taxRateBps}
          onTaxRateChange={setTaxRateBps}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button onClick={handleSave} disabled={saving || !clientId}>
          {saving ? "Creating…" : "Create draft"}
        </Button>
      </Card>
    </div>
  );
}
