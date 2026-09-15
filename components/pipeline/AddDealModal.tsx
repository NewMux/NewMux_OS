"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";
import type { User } from "@/lib/data/types";

export function AddDealModal({ owners }: { owners: User[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [quotedValue, setQuotedValue] = useState("");
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
      }),
    });
    setSaving(false);
    setName("");
    setContactPerson("");
    setContactEmail("");
    setContactPhone("");
    setQuotedValue("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New lead
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">New lead</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input placeholder="Deal name (e.g. Client — scope)" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            <Input type="email" placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <Input placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <Input type="number" min="0" step="0.001" placeholder="Quoted value (BHD)" value={quotedValue} onChange={(e) => setQuotedValue(e.target.value)} />
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
