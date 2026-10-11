import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessMarketing, canSeeMoney } from "@/lib/rbac";
import { getLeadsReport, type LeadSourceRow } from "@/lib/data/marketing";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { SummaryCard } from "@/components/ui/Widget";
import { compactMoney } from "@/lib/money";
import { addDaysYmd, todayYmd } from "@/lib/time";
import { cn, plural } from "@/lib/utils";

export const metadata = { title: "Leads" };

const PERIODS = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "365", label: "Year", days: 365 },
  { id: "all", label: "All time", days: null },
] as const;

/** Won out of the deals that have closed either way. */
const winRate = (r: LeadSourceRow) => (r.won + r.lost === 0 ? null : Math.round((r.won / (r.won + r.lost)) * 100));

/**
 * Leads from marketing: deals by where they came from (the deal's Source)
 * and by the campaign that brought them, with how many were won. Partners
 * also see what the won deals were worth.
 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await auth();
  if (!canAccessMarketing(session)) redirect("/home");
  const money = canSeeMoney(session);
  const wanted = (await searchParams).period;
  const period = PERIODS.find((p) => p.id === wanted) ?? PERIODS[1];
  const from = period.days === null ? null : addDaysYmd(todayYmd(), -period.days);
  const { bySource, byCampaign, total } = await getLeadsReport({ from, money });

  const row = (r: LeadSourceRow, href?: string) => {
    const rate = winRate(r);
    const share = total.deals ? r.deals / total.deals : 0;
    return (
      <ListRow
        key={r.source}
        href={href}
        title={
          <span className="flex items-baseline gap-2">
            {r.source}
            <span className="text-subhead text-label-2">{r.deals}</span>
          </span>
        }
        subtitle={
          <span className="block">
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-fill/15">
              <span className="block h-full rounded-full bg-ios-pink" style={{ width: `${share * 100}%` }} />
            </span>
            <span className="mt-1 block">{[`${r.open} open`, `${r.won} won`, `${r.lost} lost`, rate === null ? null : `${rate}% win rate`].filter(Boolean).join(" · ")}</span>
          </span>
        }
        detail={money && r.wonValueBhdCents > 0 ? compactMoney(r.wonValueBhdCents) : undefined}
        multiline
      />
    );
  };

  const rate = winRate(total);
  return (
    <Page
      title="Leads"
      back={{ href: "/marketing", label: "Marketing" }}
      accessory={
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`/marketing/leads?period=${p.id}`}
              className={cn("rounded-full px-3 py-1.5 text-subhead font-medium", p.id === period.id ? "bg-label text-bg" : "bg-fill/[0.12] text-label")}
            >
              {p.label}
            </Link>
          ))}
        </div>
      }
    >
      <div className="mx-auto max-w-2xl">
        <SummaryCard
          items={[
            { label: "New deals", value: String(total.deals), caption: period.days === null ? "all time" : `last ${period.label}` },
            { label: "Won", value: String(total.won), caption: rate === null ? "none closed yet" : `${rate}% win rate` },
            money ? { label: "Won value", value: compactMoney(total.wonValueBhdCents), caption: "BHD" } : { label: "Still open", value: String(total.open), caption: plural(total.open, "deal") },
          ]}
        />
        <ListSection header="By source" info="The Source on each deal: set it when adding a deal (Website, Referral, Instagram…).">
          {bySource.map((r) => row(r))}
          {bySource.length === 0 && <ListRow title="No deals in this period" />}
        </ListSection>
        <ListSection header="By campaign" info="Deals linked to a campaign on the deal itself.">
          {byCampaign.map((r) => row(r, `/marketing/campaigns?id=${r.campaignId}`))}
          {byCampaign.length === 0 && <ListRow title="No deals linked to a campaign yet" subtitle="Pick the campaign when adding or editing a deal." multiline />}
        </ListSection>
      </div>
    </Page>
  );
}
