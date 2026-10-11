"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Pencil, Target } from "lucide-react";
import { QuickAddMenu, useCanSeeMoney } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CampaignNumbersSheet, CampaignSheet } from "@/components/marketing/MarketingSheets";
import type { Option } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { CAMPAIGN_CHANNEL, CAMPAIGN_STATUS } from "@/lib/labels";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { MarketingCampaign } from "@/lib/data/marketing";

function dates(c: MarketingCampaign) {
  const f = (d: string) => formatDate(d, { day: "numeric", month: "short" });
  if (c.startDate && c.endDate) return `${f(c.startDate)} – ${f(c.endDate)}`;
  if (c.startDate) return `From ${f(c.startDate)}`;
  return c.endDate ? `Until ${f(c.endDate)}` : null;
}

/** Campaigns as cards: the plan, and how it's doing (leads, deals, spend against budget). */
export function CampaignsScreen({ campaigns, users }: { campaigns: MarketingCampaign[]; users: Option[] }) {
  const money = useCanSeeMoney();
  const params = useSearchParams();
  const [editing, setEditing] = useState<MarketingCampaign | "new" | null>(null);
  const [logging, setLogging] = useState<MarketingCampaign | null>(null);
  useNewParam(() => setEditing("new"));
  // /marketing/campaigns?id=… (from a deal or a post) opens that campaign.
  useEffect(() => {
    const id = params.get("id");
    const c = id ? campaigns.find((x) => x.id === id) : undefined;
    if (c) setEditing(c);
  }, [params, campaigns]);

  return (
    <Page title="Campaigns" back={{ href: "/marketing", label: "Marketing" }} actions={<QuickAddMenu extra={[{ label: "New campaign", onSelect: () => setEditing("new") }]} />}>
      {campaigns.length === 0 ? (
        <EmptyState icon={Target} title="No campaigns yet" message="Plan one with its channel, dates, budget and goal, then link posts and deals to it." action={<Button onClick={() => setEditing("new")}>New Campaign</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => {
            const status = CAMPAIGN_STATUS[c.status];
            const spent = c.budgetCents ? Math.min(c.spendCents / c.budgetCents, 1) : null;
            return (
              <article key={c.id} className="rounded-card bg-bg-elevated p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-headline">{c.name}</h2>
                    <p className="truncate text-subhead text-label-2">{[CAMPAIGN_CHANNEL[c.channel], dates(c), c.ownerName].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Badge color={status.color}>{status.label}</Badge>
                </div>
                {c.goal && (
                  <p dir="auto" className="mt-2 line-clamp-2 text-subhead text-label">
                    {c.goal}
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Leads", value: c.leadsCaptured },
                    { label: "Deals", value: c.deals },
                    { label: "Won", value: c.wonDeals },
                    { label: "Posts", value: c.posts },
                  ].map((m) => (
                    <div key={m.label} className="rounded-[12px] bg-fill/[0.08] py-2">
                      <dt className="text-caption1 text-label-2">{m.label}</dt>
                      <dd className="font-rounded text-title3 tabular">{m.value}</dd>
                    </div>
                  ))}
                </dl>
                {(c.budgetCents || c.spendCents > 0) && (
                  <div className="mt-3">
                    <div className="flex justify-between text-footnote text-label-2">
                      <span>Spent {centsToDisplay(c.spendCents, c.currency)}</span>
                      {c.budgetCents ? <span>of {centsToDisplay(c.budgetCents, c.currency)}</span> : null}
                    </div>
                    {spent !== null && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill/15">
                        <div className={spent >= 1 ? "h-full rounded-full bg-ios-red" : "h-full rounded-full bg-accent"} style={{ width: `${spent * 100}%` }} />
                      </div>
                    )}
                  </div>
                )}
                {money && (c.wonValueBhdCents > 0 || c.revenueCents > 0) && (
                  <p className="mt-2 text-footnote text-label-2">
                    {[c.wonValueBhdCents > 0 ? `Won ${compactMoney(c.wonValueBhdCents)}` : null, c.revenueCents > 0 ? `Revenue ${centsToDisplay(c.revenueCents, c.currency)}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="tinted" className="flex-1" onClick={() => setLogging(c)}>
                    <BarChart3 className="h-4 w-4" /> Log Numbers
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <CampaignSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} campaign={editing && editing !== "new" ? editing : undefined} users={users} />
      <CampaignNumbersSheet open={!!logging} onOpenChange={(o) => !o && setLogging(null)} campaign={logging} />
    </Page>
  );
}
