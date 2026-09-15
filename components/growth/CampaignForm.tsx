"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus } from "lucide-react";
import type { Campaign, CampaignChannel } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";

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
    await apiMutate("/api/campaigns", {
      method: "POST",
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
    await apiMutate(`/api/campaigns/${campaignId}/metrics`, {
      method: "POST",
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add data
        </Button>
      </DialogTrigger>
      <DialogContent title="Growth data">
        <div className="mb-3 flex gap-2 text-xs">
          <button
            onClick={() => setMode("metric")}
            className={
              mode === "metric" ? "text-brand" : "text-muted-foreground"
            }
          >
            Log today&apos;s metrics
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={() => setMode("campaign")}
            className={
              mode === "campaign" ? "text-brand" : "text-muted-foreground"
            }
          >
            New campaign
          </button>
        </div>

        {mode === "campaign" ? (
          <form onSubmit={handleCreateCampaign} className="flex flex-col gap-3">
            <Input
              placeholder="Campaign name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
              <Input
                type="number"
                placeholder="Spend ($)"
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Leads"
                value={leads}
                onChange={(e) => setLeads(e.target.value)}
              />
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
      </DialogContent>
    </Dialog>
  );
}
