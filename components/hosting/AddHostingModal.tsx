"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiMutate } from "@/lib/api/client";
import { Plus } from "lucide-react";
import type {
  Client,
  HostingItemType,
  RecurringExpenseCycle,
} from "@/lib/data/types";

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
    await apiMutate("/api/hosting", {
      method: "POST",
      body: JSON.stringify({
        clientId,
        item,
        amount: Number(amount),
        currency: "BHD",
        cycle,
      }),
    });
    setSaving(false);
    setAmount("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add subscription
        </Button>
      </DialogTrigger>
      <DialogContent title="Hosting subscription">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
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
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="server">Server</option>
            <option value="domain">Domain</option>
            <option value="other">Other</option>
          </select>
          <Input
            type="number"
            step="0.001"
            placeholder="Amount (BHD)"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as RecurringExpenseCycle)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
          <Button type="submit" disabled={saving || !clientId || !amount}>
            {saving ? "Saving…" : "Add subscription"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
