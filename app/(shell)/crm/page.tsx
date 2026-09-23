import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Building2, Contact, SquareKanban, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { getPipelineSummary, listActivities, listDeals, listOpenFollowUps, openPipelineTotals } from "@/lib/data/crm";
import { one } from "@/lib/data/sql";
import { Page, NavButton } from "@/components/ui/Page";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Widget, Metric } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { FollowUpRow } from "@/components/crm/FollowUpRow";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { DEAL_STAGE } from "@/lib/labels";
import { OPEN_DEAL_STAGES } from "@/lib/data/types";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { solidBg } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata = { title: "CRM" };

export default async function CrmPage() {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const [summary, followUps, openDeals, recent, counts] = await Promise.all([
    getPipelineSummary(),
    listOpenFollowUps(),
    listDeals({ open: true }),
    listActivities({ limit: 6 }),
    one<{ clients: number; contacts: number }>("select (select count(*)::int from clients) as clients, (select count(*)::int from contacts) as contacts"),
  ]);
  const totals = openPipelineTotals(summary);
  const won = summary.find((s) => s.stage === "won")!;
  const maxStage = Math.max(...summary.filter((s) => OPEN_DEAL_STAGES.includes(s.stage)).map((s) => s.totalBhdCents), 1);
  const closingSoon = [...openDeals].filter((d) => d.expectedClose).sort((a, b) => a.expectedClose!.localeCompare(b.expectedClose!)).slice(0, 5);

  return (
    <Page
      title="CRM"
      actions={
        <NavButton label="New deal" href="/crm/pipeline?new=1">
          <Plus className="h-5 w-5" />
        </NavButton>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Widget title="Open Pipeline" icon={SquareKanban} color="indigo" href="/crm/pipeline">
          <Metric value={compactMoney(totals.totalBhdCents)} caption={`${totals.count} deals`} />
        </Widget>
        <Widget title="Weighted" icon={SquareKanban} color="purple" href="/crm/pipeline">
          <Metric value={compactMoney(totals.weightedBhdCents)} caption="by probability" />
        </Widget>
        <Widget title="Won" icon={Trophy} color="green">
          <Metric value={compactMoney(won.totalBhdCents)} caption={`${won.count} deals`} />
        </Widget>
        <Widget title="Follow-ups" icon={Activity} color="orange" href="/crm/activities">
          <Metric value={followUps.length} caption="open" />
        </Widget>
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection header="Pipeline by Stage" action={<Link href="/crm/pipeline" className="text-subhead text-accent">Board</Link>}>
            {summary
              .filter((s) => OPEN_DEAL_STAGES.includes(s.stage))
              .map((s) => (
                <ListRow
                  key={s.stage}
                  href="/crm/pipeline"
                  title={
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", solidBg[DEAL_STAGE[s.stage].color])} />
                      {DEAL_STAGE[s.stage].label}
                      <span className="text-subhead text-label-2">{s.count}</span>
                    </span>
                  }
                  subtitle={
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fill/15">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(s.totalBhdCents / maxStage) * 100}%` }} />
                    </span>
                  }
                  detail={compactMoney(s.totalBhdCents)}
                />
              ))}
          </ListSection>

          <ListSection header="Closing Soon">
            {closingSoon.map((d) => (
              <ListRow
                key={d.id}
                href={`/crm/deals/${d.id}`}
                title={d.title}
                subtitle={d.clientName ?? d.contactName ?? "New prospect"}
                detail={centsToDisplay(d.valueCents, d.currency)}
                trailing={<Badge color={DEAL_STAGE[d.stage].color}>{DEAL_STAGE[d.stage].label}</Badge>}
              />
            ))}
            {closingSoon.length === 0 && <ListRow title="No open deals with a close date" />}
          </ListSection>

          <ListSection>
            <ListRow href="/clients" leading={<IconTile icon={Building2} color="indigo" />} title="Clients" detail={counts?.clients} />
            <ListRow href="/contacts" leading={<IconTile icon={Contact} color="gray" />} title="Contacts" detail={counts?.contacts} />
            <ListRow href="/crm/activities" leading={<IconTile icon={Activity} color="orange" />} title="All Activity" />
          </ListSection>
        </div>
        <div>
          <ListSection header="Follow-ups">
            {followUps.slice(0, 8).map((a) => (
              <FollowUpRow key={a.id} activity={a} />
            ))}
            {followUps.length === 0 && <ListRow title="You're all caught up" />}
          </ListSection>
          <ListSection header="Recent Activity" action={<Link href="/crm/activities" className="text-subhead text-accent">See All</Link>}>
            <ActivityTimeline activities={recent} showContext />
          </ListSection>
        </div>
      </div>
    </Page>
  );
}
