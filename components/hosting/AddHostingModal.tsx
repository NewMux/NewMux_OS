"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";
import type { Client, HostingItemType, RecurringExpenseCycle } from "@/lib/data/types";

export function AddHostingModal({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [item, setItem] = useState<HostingItemType>("server");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<RecurringExpenseCycle>("quarterly");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/hosting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, item, amount: Number(amount), currency: "BHD", cycle }),
    });
    setSaving(false);
    setAmount("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add subscription
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">Hosting subscription</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={item}
              onChange={(e) => setItem(e.target.value as HostingItemType)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="server">Server</option>
              <option value="domain">Domain</option>
              <option value="other">Other</option>
            </select>
            <Input type="number" step="0.001" placeholder="Amount (BHD)" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value as RecurringExpenseCycle)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
            <Button type="submit" disabled={saving || !clientId || !amount}>
              {saving ? "Saving…" : "Add subscription"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
