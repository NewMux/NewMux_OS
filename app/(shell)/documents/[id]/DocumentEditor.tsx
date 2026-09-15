"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { LineItemEditor, type EditableLineItem } from "@/components/documents/LineItemEditor";
import { ALLOWED_TRANSITIONS } from "@/lib/validators/document";
import type { DocumentRecord, DocumentStatus, Client, DocumentStatusHistoryEntry } from "@/lib/data/types";
import { Download } from "lucide-react";

export function DocumentEditor({
  document,
  lineItems: initialLineItems,
  client,
  history,
}: {
  document: DocumentRecord;
  lineItems: EditableLineItem[];
  client: Client;
  history: DocumentStatusHistoryEntry[];
}) {
  const router = useRouter();
  const [lineItems, setLineItems] = useState<EditableLineItem[]>(initialLineItems);
  const [taxRateBps, setTaxRateBps] = useState(document.taxRateBps);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState<DocumentStatus | null>(null);
  const [dirty, setDirty] = useState(false);

  const editable = document.status === "draft";
  const nextStatuses = ALLOWED_TRANSITIONS[document.status];

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems }),
    });
    setSaving(false);
    setDirty(false);
    router.refresh();
  }

  async function handleTransition(to: DocumentStatus) {
    setTransitioning(to);
    await fetch(`/api/documents/${document.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    setTransitioning(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{document.documentNumber}</h1>
          <p className="text-sm text-slate-500">{client.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={document.status} />
          <a
            href={`/api/documents/generate-pdf?id=${document.id}`}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
          >
            <Download className="h-4 w-4" /> PDF
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <LineItemEditor
          lineItems={lineItems}
          onChange={(items) => {
            setLineItems(items);
            setDirty(true);
          }}
          taxRateBps={taxRateBps}
          onTaxRateChange={(bps) => {
            setTaxRateBps(bps);
            setDirty(true);
          }}
          currency={document.currency}
        />
        {editable && (
          <Button onClick={handleSave} disabled={saving || !dirty} className="mt-4">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        )}
        {!editable && (
          <p className="mt-4 text-xs text-slate-500">
            Line items can only be edited while a document is in Draft status.
          </p>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.length === 0 && <p className="text-sm text-slate-500">No further transitions.</p>}
          {nextStatuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === "archived" || status === "draft" ? "secondary" : "default"}
              disabled={transitioning !== null}
              onClick={() => handleTransition(status)}
              className="capitalize"
            >
              {transitioning === status ? "Updating…" : `Mark as ${status}`}
            </Button>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
          {history.map((h) => (
            <p key={h.id} className="text-xs text-slate-500">
              {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created as ${h.toStatus}`} ·{" "}
              {new Date(h.changedAt).toLocaleString()}
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}
