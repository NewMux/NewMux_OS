"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, BarChart3 } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Menu } from "@/components/ui/Menu";
import { NavButton } from "@/components/ui/Page";
import { ListRow, ListSection, FieldRow, PlainRowInput, RowInput } from "@/components/ui/List";
import { Widget, Metric } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { FormSheet } from "@/components/ui/FormSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMutation } from "@/lib/useMutation";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { todayYmd } from "@/lib/time";
import type { CampaignAttribution } from "@/lib/data/campaigns";
import type { Campaign, CampaignChannel } from "@/lib/data/types";

const CHANNEL: Record<CampaignChannel, string> = { meta_ads: "Meta Ads", linkedin: "LinkedIn", google_search: "Google Search", outbound_email: "Outbound Email" };

export function GrowthScreen({
  rows,
  campaigns,
  mrr,
  subs,
}: {
  rows: CampaignAttribution[];
  campaigns: Campaign[];
  mrr: { mrrCents: number; arrCents: number };
  subs: { paying: number; trialing: number; pastDue: number };
}) {
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [metricFor, setMetricFor] = useState<string | null>(null);
  return (
    <Page
      title="Growth"
      subtitle="Campaign attribution and SaaS revenue (USD)"
      actions={
        <Menu
          trigger={
            <NavButton label="Add">
              <Plus className="h-5 w-5" />
            </NavButton>
          }
          items={[
            { label: "New Campaign", icon: Megaphone, onSelect: () => setCampaignOpen(true) },
            { label: "Log Today's Numbers", icon: BarChart3, disabled: campaigns.length === 0, onSelect: () => setMetricFor(campaigns[0]?.id ?? null) },
          ]}
        />
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Widget title="MRR">
          <Metric value={compactMoney(mrr.mrrCents, "USD")} caption={`ARR ${compactMoney(mrr.arrCents, "USD")}`} />
        </Widget>
        <Widget title="Subscribers">
          <Metric value={subs.paying} caption={`${subs.trialing} trialing · ${subs.pastDue} past due`} />
        </Widget>
        <Widget title="Ad Spend">
          <Metric value={compactMoney(rows.reduce((s, r) => s + r.spendCents, 0), "USD")} caption="all campaigns" />
        </Widget>
        <Widget title="Conversions">
          <Metric value={rows.reduce((s, r) => s + r.conversions, 0)} caption={`${rows.reduce((s, r) => s + r.leadsCaptured, 0)} leads`} />
        </Widget>
      </div>
      <div className="mx-auto max-w-3xl">
        {rows.length === 0 && <EmptyState icon={Megaphone} title="No campaigns yet" />}
        <ListSection header="Campaigns" footer="CAC = spend ÷ conversions. ROAS = revenue ÷ spend. Tap a campaign to log its numbers for today.">
          {rows.map((r) => (
            <ListRow
              key={r.campaignId}
              onClick={() => setMetricFor(r.campaignId)}
              title={
                <span className="flex items-center gap-2">
                  {r.name}
                  {!r.isActive && <Badge>Paused</Badge>}
                </span>
              }
              subtitle={`${CHANNEL[r.channel]} · ${r.leadsCaptured} leads · ${r.conversions} conv · CAC ${r.blendedCacCents === null ? "—" : centsToDisplay(r.blendedCacCents, "USD")}`}
              detail={
                <span className="flex flex-col items-end">
                  <span className="text-label">{centsToDisplay(r.spendCents, "USD")}</span>
                  <span className={r.roas !== null && r.roas >= 1 ? "text-footnote text-ios-green" : "text-footnote text-label-2"}>{r.roas === null ? "—" : `${r.roas.toFixed(1)}× ROAS`}</span>
                </span>
              }
            />
          ))}
        </ListSection>
      </div>
      <CampaignSheet open={campaignOpen} onOpenChange={setCampaignOpen} />
      <MetricSheet campaignId={metricFor} campaigns={campaigns} onClose={() => setMetricFor(null)} />
    </Page>
  );
}

function CampaignSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("meta_ads");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="New Campaign" submitLabel="Add" size="auto" canSubmit={!!name.trim()} onSubmit={async () => !!(await run("/api/campaigns", { body: { name, channel }, success: "Campaign added" }))}>
      <ListSection>
        <PlainRowInput placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <FieldRow label="Channel">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as CampaignChannel)}>
            {Object.entries(CHANNEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
    </FormSheet>
  );
}

function MetricSheet({ campaignId, campaigns, onClose }: { campaignId: string | null; campaigns: Campaign[]; onClose: () => void }) {
  const { run } = useMutation();
  const [id, setId] = useState("");
  const [f, setF] = useState({ date: todayYmd(), spend: "", leads: "", conversions: "", revenue: "" });
  useEffect(() => {
    if (campaignId) {
      setId(campaignId);
      setF({ date: todayYmd(), spend: "", leads: "", conversions: "", revenue: "" });
    }
  }, [campaignId]);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string) => v.replace(/[^0-9.]/g, "");
  return (
    <FormSheet
      open={!!campaignId}
      onOpenChange={(o) => !o && onClose()}
      title="Log Numbers"
      submitLabel="Save"
      canSubmit={!!id}
      onSubmit={async () =>
        !!(await run(`/api/campaigns/${id}/metrics`, {
          body: {
            metricDate: f.date,
            spendCents: Math.round((Number(f.spend) || 0) * 100),
            leadsCaptured: Math.round(Number(f.leads) || 0),
            conversions: Math.round(Number(f.conversions) || 0),
            revenueCents: Math.round((Number(f.revenue) || 0) * 100),
          },
          success: "Saved",
        }))
      }
    >
      <ListSection footer="Logging the same day again replaces that day's numbers.">
        <FieldRow label="Campaign">
          <Select value={id} onChange={(e) => setId(e.target.value)}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Date">
          <RowInput type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </FieldRow>
        <FieldRow label="Spend (USD)">
          <RowInput inputMode="decimal" placeholder="0.00" value={f.spend} onChange={(e) => set("spend", num(e.target.value))} />
        </FieldRow>
        <FieldRow label="Leads">
          <RowInput inputMode="numeric" placeholder="0" value={f.leads} onChange={(e) => set("leads", num(e.target.value))} />
        </FieldRow>
        <FieldRow label="Conversions">
          <RowInput inputMode="numeric" placeholder="0" value={f.conversions} onChange={(e) => set("conversions", num(e.target.value))} />
        </FieldRow>
        <FieldRow label="Revenue (USD)">
          <RowInput inputMode="decimal" placeholder="0.00" value={f.revenue} onChange={(e) => set("revenue", num(e.target.value))} />
        </FieldRow>
      </ListSection>
    </FormSheet>
  );
}
