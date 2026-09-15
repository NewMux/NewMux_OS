"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus } from "lucide-react";
import type { User } from "@/lib/data/types";

export function AddDealModal({ owners }: { owners: User[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [quotedValue, setQuotedValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contactPerson,
        contactEmail,
        contactPhone,
        quotedValue: Number(quotedValue) || 0,
        currency: "BHD",
        ownerId,
        expectedCloseDate,
      }),
    });
    setSaving(false);
    setName("");
    setContactPerson("");
    setContactEmail("");
    setContactPhone("");
    setQuotedValue("");
    setExpectedCloseDate("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New lead
        </Button>
      </DialogTrigger>
      <DialogContent title="New lead">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Deal name (e.g. Client — scope)"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Contact person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <Input
            placeholder="Contact phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Input
            type="number"
            min="0"
            step="0.001"
            placeholder="Quoted value (BHD)"
            value={quotedValue}
            onChange={(e) => setQuotedValue(e.target.value)}
          />
          <label className="-mb-1 text-xs text-muted-foreground">
            Expected close date
          </label>
          <Input
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
          />
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
          <Button type="submit" disabled={saving || !name}>
            {saving ? "Saving…" : "Add lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
