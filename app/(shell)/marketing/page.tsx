import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessMarketing, canSeeMoney } from "@/lib/rbac";
import { getLeadsReport, listMarketingCampaigns, listPosts } from "@/lib/data/marketing";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { NavIcon } from "@/components/shell/NavIcon";
import { Page } from "@/components/ui/Page";
import { IconTile, ListRow, ListSection, SectionLink } from "@/components/ui/List";
import { SummaryCard } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { CAMPAIGN_CHANNEL, POST_CHANNEL, POST_STATUS } from "@/lib/labels";
import { addDaysYmd, formatDate, formatTime, relativeDay, toYmd, todayYmd } from "@/lib/time";
import type { NavIconName } from "@/lib/nav";
import type { SysColor } from "@/lib/colors";
import { plural } from "@/lib/utils";

export const metadata = { title: "Marketing" };

const SECTIONS: { href: string; label: string; subtitle: string; icon: NavIconName; color: SysColor }[] = [
  { href: "/marketing/content", label: "Content Calendar", subtitle: "Posts by day, and a board from idea to published", icon: "content", color: "pink" },
  { href: "/marketing/campaigns", label: "Campaigns", subtitle: "Plans, budgets and what each one brings in", icon: "campaigns", color: "orange" },
  { href: "/marketing/leads", label: "Leads", subtitle: "Where new deals come from, and which ones are won", icon: "leads", color: "purple" },
  { href: "/marketing/brand", label: "Brand & Assets", subtitle: "Brand guide, logos, templates and post images", icon: "brand", color: "indigo" },
];

/** Marketing at a glance: what's going out, what needs finishing, campaigns running, and where leads come from. */
export default async function MarketingPage() {
  const session = await auth();
  if (!canAccessMarketing(session)) redirect("/home");
  const today = todayYmd();
  const nowIso = new Date().toISOString();
  const [posts, campaigns, leads] = await Promise.all([
    listPosts({ from: new Date(Date.now() - 14 * 86_400_000).toISOString(), to: new Date(`${addDaysYmd(today, 8)}T00:00:00+03:00`).toISOString() }),
    listMarketingCampaigns({ money: canSeeMoney(session) }),
    getLeadsReport({ from: addDaysYmd(today, -30), money: false }),
  ]);
  const thisWeek = posts.filter((p) => p.publishAt && p.publishAt >= nowIso && p.status !== "published");
  // Should have gone out (date passed, not published), or goes out within 3 days and isn't ready.
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const needsWork = posts.filter((p) => p.publishAt && p.status !== "published" && (p.publishAt < nowIso || (p.publishAt < soon && p.status !== "scheduled")));
  const active = campaigns.filter((c) => c.status === "active");

  return (
    <Page title="Marketing" actions={<QuickAddMenu extra={[{ label: "New post", href: "/marketing/content?new=1" }, { label: "New campaign", href: "/marketing/campaigns?new=1" }]} />}>
      <SummaryCard
        items={[
          { label: "This week", value: String(thisWeek.length), caption: "posts going out", href: "/marketing/content" },
          { label: "Needs work", value: String(needsWork.length), caption: "late or not ready", href: "/marketing/content", tone: needsWork.length ? "negative" : undefined },
          { label: "Campaigns", value: String(active.length), caption: "running", href: "/marketing/campaigns" },
          { label: "New deals", value: String(leads.total.deals), caption: `${leads.total.won} won · 30 days`, href: "/marketing/leads" },
        ]}
      />
      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection variant="prominent" header="Going Out" action={<SectionLink href="/marketing/content">Calendar</SectionLink>}>
            {thisWeek.slice(0, 8).map((p) => (
              <ListRow
                key={p.id}
                href="/marketing/content"
                title={p.title}
                subtitle={`${relativeDay(toYmd(p.publishAt!))} ${formatTime(p.publishAt!)} · ${POST_CHANNEL[p.channel].label}${p.ownerName ? ` · ${p.ownerName}` : ""}`}
                trailing={<Badge color={POST_STATUS[p.status].color}>{POST_STATUS[p.status].label}</Badge>}
              />
            ))}
            {thisWeek.length === 0 && <ListRow title="Nothing scheduled for the next 7 days" href="/marketing/content?new=1" subtitle="Plan a post" />}
          </ListSection>
          {needsWork.length > 0 && (
            <ListSection variant="prominent" header="Needs Work">
              {needsWork.slice(0, 6).map((p) => (
                <ListRow
                  key={p.id}
                  href="/marketing/content"
                  title={p.title}
                  subtitle={`${p.publishAt! < nowIso ? "Was due" : "Due"} ${formatDate(p.publishAt, { weekday: "short", day: "numeric", month: "short" })} · ${POST_STATUS[p.status].label}`}
                  trailing={<Badge color={p.publishAt! < nowIso ? "red" : "orange"}>{p.publishAt! < nowIso ? "Late" : "Soon"}</Badge>}
                />
              ))}
            </ListSection>
          )}
          <ListSection>
            {SECTIONS.map((s) => (
              <ListRow
                key={s.href}
                href={s.href}
                leading={<IconTile icon={({ className }) => <NavIcon icon={s.icon} className={className} />} color={s.color} />}
                title={s.label}
                subtitle={s.subtitle}
              />
            ))}
          </ListSection>
        </div>
        <div>
          <ListSection variant="prominent" header="Running Campaigns" action={<SectionLink href="/marketing/campaigns" />}>
            {active.slice(0, 6).map((c) => (
              <ListRow key={c.id} href={`/marketing/campaigns?id=${c.id}`} title={c.name} subtitle={`${CAMPAIGN_CHANNEL[c.channel]} · ${plural(c.leadsCaptured, "lead")} · ${plural(c.deals, "deal")}`} detail={c.wonDeals ? `${c.wonDeals} won` : undefined} />
            ))}
            {active.length === 0 && <ListRow title="No campaigns running" href="/marketing/campaigns?new=1" subtitle="Plan one" />}
          </ListSection>
          <ListSection variant="prominent" header="Where Leads Come From" action={<SectionLink href="/marketing/leads" />}>
            {leads.bySource.slice(0, 5).map((r) => (
              <ListRow key={r.source} href="/marketing/leads" title={r.source} detail={`${r.deals} · ${r.won} won`} />
            ))}
            {leads.bySource.length === 0 && <ListRow title="No new deals in the last 30 days" />}
          </ListSection>
        </div>
      </div>
    </Page>
  );
}
