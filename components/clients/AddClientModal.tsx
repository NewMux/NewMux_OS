"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";

export function AddClientModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactPerson, contactEmail, contactPhone }),
    });
    setSaving(false);
    setName("");
    setContactPerson("");
    setContactEmail("");
    setContactPhone("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">New client</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input placeholder="Client / company name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            <Input type="email" placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <Input placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <Button type="submit" disabled={saving || !name}>
              {saving ? "Saving…" : "Add client"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
