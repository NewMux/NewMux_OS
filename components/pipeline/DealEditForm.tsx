"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { minorUnitDigits } from "@/lib/money";
import type { Deal, User } from "@/lib/data/types";

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export function DealEditForm({ deal, owners }: { deal: Deal; owners: User[] }) {
  const router = useRouter();
  const [name, setName] = useState(deal.name);
  const [quotedValue, setQuotedValue] = useState(String(deal.quotedValueCents / 10 ** minorUnitDigits(deal.currency)));
  const [ownerId, setOwnerId] = useState(deal.ownerId);
  const [contactPerson, setContactPerson] = useState(deal.contactPerson ?? "");
  const [contactEmail, setContactEmail] = useState(deal.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(deal.contactPhone ?? "");
  const [expectedCloseDate, setExpectedCloseDate] = useState(toDateInput(deal.expectedCloseDate));
  const [nextFollowUpDate, setNextFollowUpDate] = useState(toDateInput(deal.nextFollowUpDate));
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        quotedValue: Number(quotedValue) || 0,
        ownerId,
        contactPerson,
        contactEmail,
        contactPhone,
        expectedCloseDate,
        nextFollowUpDate,
        notes,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Deal name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Quoted value ({deal.currency})</label>
          <Input type="number" min="0" step="0.001" value={quotedValue} onChange={(e) => setQuotedValue(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Owner</label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Expected close date</label>
          <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Next follow-up</label>
          <Input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Contact person</label>
          <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Contact phone</label>
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">Contact email</label>
          <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-xs text-brand">Saved</span>}
      </div>
    </form>
  );
}
