"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/ui/Page";
import { FieldRow, ListSection, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ClientProjectRows, type Option, type ProjectOption } from "@/components/forms/Fields";
import { centsToDisplay, majorToMinorUnits, minorToMajor, subtotalCents, taxCents } from "@/lib/money";
import type { Currency, DocumentType } from "@/lib/data/types";

type Line = { key: number; description: string; quantity: string; unitPrice: string };

export type DocumentFormInitial = {
  id?: string;
  type: DocumentType;
  clientId: string;
  projectId: string;
  dealId?: string | null;
  currency: Currency;
  taxRatePercent: string;
  paymentTerms: string;
  notes: string;
  dueAt: string;
  lineItems: { description: string; quantity: number; unitPriceCents: number }[];
};

let lineKey = 0;

/** Create or edit (draft) a quote, contract or invoice. */
export function DocumentForm({ initial, clients, projects }: { initial: DocumentFormInitial; clients: Option[]; projects: ProjectOption[] }) {
  const router = useRouter();
  const editing = !!initial.id;
  const [type, setType] = useState<DocumentType>(initial.type);
  const [clientId, setClientId] = useState(initial.clientId);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [currency, setCurrency] = useState<Currency>(initial.currency);
  const [taxRate, setTaxRate] = useState(initial.taxRatePercent);
  const [terms, setTerms] = useState(initial.paymentTerms);
  const [notes, setNotes] = useState(initial.notes);
  const [dueAt, setDueAt] = useState(initial.dueAt);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<Line[]>(
    initial.lineItems.length
      ? initial.lineItems.map((li) => ({
          key: ++lineKey,
          description: li.description,
          quantity: String(li.quantity),
          unitPrice: String(minorToMajor(li.unitPriceCents, initial.currency)),
        }))
      : [{ key: ++lineKey, description: "", quantity: "1", unitPrice: "" }],
  );

  const minorLines = useMemo(
    () =>
      lines
        .filter((l) => l.description.trim())
        .map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, unitPriceCents: majorToMinorUnits(Number(l.unitPrice) || 0, currency) })),
    [lines, currency],
  );
  const taxBps = Math.round((Number(taxRate) || 0) * 100);
  const subtotal = subtotalCents(minorLines);
  const tax = taxCents(subtotal, taxBps);
  const canSave = !!clientId && minorLines.length > 0 && minorLines.every((l) => l.quantity > 0);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    const payload = {
      ...(editing ? {} : { type, dealId: initial.dealId ?? null }),
      clientId,
      projectId,
      currency,
      taxRateBps: taxBps,
      paymentTerms: terms,
      notes,
      dueAt,
      lineItems: minorLines,
    };
    const res = await fetch(editing ? `/api/documents/${initial.id}` : "/api/documents", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { document?: { id: string; documentNumber: string }; error?: string };
    setSaving(false);
    if (!res.ok || !json.document) {
      toast.error(json.error ?? "Couldn't save the document.");
      return;
    }
    toast.success(editing ? "Saved" : `${json.document.documentNumber} created`);
    router.push(`/documents/${json.document.id}`);
    router.refresh();
  }

  return (
    <Page
      title={editing ? "Edit Draft" : `New ${type === "quote" ? "Quote" : type === "invoice" ? "Invoice" : "Contract"}`}
      back={editing ? { href: `/documents/${initial.id}`, label: "Cancel" } : { href: "/documents", label: "Documents" }}
      actions={
        <Button size="sm" onClick={save} disabled={!canSave || saving}>
          {saving ? "Saving…" : editing ? "Save" : "Create"}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        {!editing && (
          <div className="mb-6">
            <SegmentedControl
              value={type}
              onChange={setType}
              options={[
                { value: "quote", label: "Quote" },
                { value: "invoice", label: "Invoice" },
                { value: "contract", label: "Contract" },
              ]}
            />
          </div>
        )}

        <ListSection header="Bill to">
          <ClientProjectRows clients={clients} projects={projects} clientId={clientId} projectId={projectId} onClient={setClientId} onProject={setProjectId} />
          <FieldRow label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="BHD">BHD — Bahraini Dinar</option>
              <option value="USD">USD — US Dollar</option>
            </Select>
          </FieldRow>
          {type !== "quote" && (
            <FieldRow label="Due date">
              <RowInput type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </FieldRow>
          )}
        </ListSection>

        <ListSection header="Items">
          {lines.map((l, i) => {
            const lineTotal = Math.round((Number(l.quantity) || 0) * majorToMinorUnits(Number(l.unitPrice) || 0, currency));
            return (
              <div key={l.key} className="flex items-start gap-2 py-2.5 pl-3 pr-4 hairline-b last:shadow-none">
                <button
                  type="button"
                  aria-label="Remove item"
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  className="mt-0.5 text-ios-red disabled:opacity-30"
                >
                  <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    value={l.description}
                    onChange={(e) => update(l.key, { description: e.target.value })}
                    placeholder={`Item ${i + 1}`}
                    className="w-full bg-transparent placeholder:text-label-3 focus:outline-none"
                  />
                  <div className="mt-1.5 flex items-center gap-2 text-subhead text-label-2">
                    <input
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value.replace(/[^0-9.]/g, "") })}
                      aria-label="Quantity"
                      className="w-12 rounded-md bg-fill/[0.12] px-2 py-1 text-center text-label tabular focus:outline-none"
                    />
                    <span>×</span>
                    <input
                      inputMode="decimal"
                      value={l.unitPrice}
                      onChange={(e) => update(l.key, { unitPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                      placeholder="Price"
                      aria-label="Unit price"
                      className="w-24 rounded-md bg-fill/[0.12] px-2 py-1 text-right text-label tabular placeholder:text-label-3 focus:outline-none"
                    />
                    <span className="ml-auto text-label tabular">{centsToDisplay(lineTotal, currency)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, { key: ++lineKey, description: "", quantity: "1", unitPrice: "" }])}
            className="flex min-h-[44px] w-full items-center gap-2 px-3 text-body text-accent active:bg-fill/20"
          >
            <Plus className="h-5 w-5 rounded-full bg-ios-green p-0.5 text-white" strokeWidth={3} />
            Add Item
          </button>
        </ListSection>

        <ListSection>
          <FieldRow label="Tax rate">
            <RowInput inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value.replace(/[^0-9.]/g, ""))} className="w-16" />
            <span className="ml-1 text-label-2">%</span>
          </FieldRow>
          <div className="space-y-1 px-4 py-3 text-subhead tabular">
            <div className="flex justify-between text-label-2">
              <span>Subtotal</span>
              <span>{centsToDisplay(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-label-2">
              <span>Tax</span>
              <span>{centsToDisplay(tax, currency)}</span>
            </div>
            <div className="flex justify-between pt-1 text-headline">
              <span>Total</span>
              <span>{centsToDisplay(subtotal + tax, currency)}</span>
            </div>
          </div>
        </ListSection>

        <ListSection header="Terms & notes">
          <div className="px-4 py-2.5 hairline-b">
            <input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms (e.g. 50% upfront)" className="w-full bg-transparent placeholder:text-label-3 focus:outline-none" />
          </div>
          <div className="px-4 py-2.5">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes shown on the document" rows={3} />
          </div>
        </ListSection>
      </div>
    </Page>
  );
}
