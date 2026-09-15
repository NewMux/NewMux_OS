"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";
import type { Campaign, CampaignChannel } from "@/lib/data/types";

export function CampaignForm({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"campaign" | "metric">("metric");

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("meta_ads");

  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [spend, setSpend] = useState("0");
  const [leads, setLeads] = useState("0");
  const [conversions, setConversions] = useState("0");
  const [revenue, setRevenue] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, channel }),
    });
    setSaving(false);
    setName("");
    setOpen(false);
    router.refresh();
  }

  async function handleAddMetric(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/campaigns/${campaignId}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metricDate: new Date().toISOString().slice(0, 10),
        spendCents: Math.round(Number(spend) * 100),
        leadsCaptured: Number(leads),
        conversions: Number(conversions),
        revenueCents: Math.round(Number(revenue) * 100),
      }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add data
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-foreground">Growth data</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="mb-3 flex gap-2 text-xs">
            <button
              onClick={() => setMode("metric")}
              className={mode === "metric" ? "text-brand" : "text-muted-foreground"}
            >
              Log today&apos;s metrics
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={() => setMode("campaign")}
              className={mode === "campaign" ? "text-brand" : "text-muted-foreground"}
            >
              New campaign
            </button>
          </div>

          {mode === "campaign" ? (
            <form onSubmit={handleCreateCampaign} className="flex flex-col gap-3">
              <Input placeholder="Campaign name" required value={name} onChange={(e) => setName(e.target.value)} />
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as CampaignChannel)}
                className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="meta_ads">Meta Ads</option>
                <option value="linkedin">LinkedIn</option>
                <option value="google_search">Google Search</option>
                <option value="outbound_email">Outbound Email</option>
              </select>
              <Button type="submit" disabled={saving || !name}>
                {saving ? "Creating…" : "Create campaign"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAddMetric} className="flex flex-col gap-3">
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Spend ($)" value={spend} onChange={(e) => setSpend(e.target.value)} />
                <Input type="number" placeholder="Leads" value={leads} onChange={(e) => setLeads(e.target.value)} />
                <Input
                  type="number"
                  placeholder="Conversions"
                  value={conversions}
                  onChange={(e) => setConversions(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Revenue ($)"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={saving || !campaignId}>
                {saving ? "Saving…" : "Log metrics"}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
