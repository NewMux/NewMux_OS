"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";
import type { Client, Project, RecurringExpenseCycle } from "@/lib/data/types";

export function AddExpenseModal({ clients, projects }: { clients: Client[]; projects: Project[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("hosting");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [cycle, setCycle] = useState<RecurringExpenseCycle>("monthly");
  const [linkedClientId, setLinkedClientId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const client = clients.find((c) => c.id === linkedClientId);
    const project = projects.find((p) => p.clientId === linkedClientId);
    await fetch("/api/finance/recurring-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        amount: Number(amount),
        currency,
        cycle,
        linkedClientId: client?.id ?? null,
        linkedProjectId: project?.id ?? null,
      }),
    });
    setSaving(false);
    setName("");
    setAmount("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">Recurring expense</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="hosting">Hosting</option>
              <option value="software subscription">Software subscription</option>
              <option value="marketing">Marketing</option>
              <option value="admin">Admin</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" step="0.01" placeholder="Amount" required value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                <option value="USD">USD</option>
                <option value="BHD">BHD</option>
              </select>
            </div>
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value as RecurringExpenseCycle)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
            <select
              value={linkedClientId}
              onChange={(e) => setLinkedClientId(e.target.value)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Company-wide (no client)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={saving || !name || !amount}>
              {saving ? "Saving…" : "Add expense"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
