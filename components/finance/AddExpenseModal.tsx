"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus } from "lucide-react";
import type { Client, Project, RecurringExpenseCycle } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";

export function AddExpenseModal({
  clients,
  projects,
}: {
  clients: Client[];
  projects: Project[];
}) {
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
    await apiMutate("/api/finance/recurring-expenses", {
      method: "POST",
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      </DialogTrigger>
      <DialogContent title="Recurring expense">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="hosting">Hosting</option>
            <option value="software subscription">Software subscription</option>
            <option value="marketing">Marketing</option>
            <option value="admin">Admin</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="USD">USD</option>
              <option value="BHD">BHD</option>
            </select>
          </div>
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as RecurringExpenseCycle)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
          <select
            value={linkedClientId}
            onChange={(e) => setLinkedClientId(e.target.value)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
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
      </DialogContent>
    </Dialog>
  );
}
