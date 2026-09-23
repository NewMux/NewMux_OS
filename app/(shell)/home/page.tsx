import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { auth } from "@/lib/auth";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { SummaryCard } from "@/components/ui/Widget";
import { Avatar } from "@/components/ui/Avatar";
import { TaskRow } from "@/components/work/TaskRow";
import { FollowUpRow } from "@/components/crm/FollowUpRow";
import { NewMenu, type NewItemKind } from "@/components/shell/NewMenu";
import { getDashboardAlerts } from "@/lib/data/alerts";
import { getErpDashboardSummary } from "@/lib/data/finance";
import { getPipelineSummary, listOpenFollowUps, openPipelineTotals } from "@/lib/data/crm";
import { listTasks } from "@/lib/data/projects";
import { listUpcomingMeetings } from "@/lib/data/meetings";
import { isPartnerAdmin } from "@/lib/rbac";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { addDaysYmd, formatDate, formatTime, relativeDay, todayYmd, toYmd, APP_TZ } from "@/lib/time";
import { plural } from "@/lib/utils";

export const metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Home answers one question: what needs me today? */
export default async function HomePage() {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const firstName = (session.user.name ?? "").split(" ")[0] || "there";
  const today = todayYmd();
  const tomorrow = addDaysYmd(today, 1);

  const [alerts, myTasks, meetings, finance, pipeline, followUps] = await Promise.all([
    getDashboardAlerts({ includeFinance: admin }),
    listTasks({ assigneeId: session.user.id, openOnly: true }),
    listUpcomingMeetings(2),
    admin ? getErpDashboardSummary() : null,
    admin ? getPipelineSummary() : null,
    admin ? listOpenFollowUps() : [],
  ]);

  const soonMeetings = meetings.filter((m) => toYmd(m.startsAt) <= tomorrow).slice(0, 3);
  const dueTasks = myTasks.filter((t) => t.dueAt && t.dueAt <= tomorrow).slice(0, 5);
  const followUpsDue = followUps.filter((f) => f.dueAt && toYmd(f.dueAt) <= today);
  const attentionCount = alerts.hostingAlerts.length + alerts.renewalsWithin30Days.length + followUpsDue.length;
  const pipe = pipeline ? openPipelineTotals(pipeline) : null;
  const net = finance ? finance.collectedThisMonthBhdCents - finance.spentThisMonthBhdCents : 0;
  const createKinds: NewItemKind[] = admin ? ["deal", "task", "invoice", "expense", "page"] : ["task", "page"];

  return (
    <Page
      title={`${greeting()}, ${firstName}`}
      subtitle={formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
      actions={
        <>
          <NewMenu kinds={createKinds} />
          <Link href="/settings" aria-label="Settings" className="press md:hidden">
            <Avatar name={session.user.name ?? "?"} size={34} />
          </Link>
        </>
      }
    >
      {finance && pipe && (
        <SummaryCard
          items={[
            { label: "This month", value: compactMoney(net, "BHD"), caption: "net cash", href: "/finance", tone: net < 0 ? "negative" : undefined },
            { label: "Receivables", value: compactMoney(finance.totalOutstandingBhdCents), caption: plural(finance.unpaidInvoiceCount + finance.partiallyPaidInvoiceCount, "invoice"), href: "/documents?type=invoice" },
            { label: "Pipeline", value: compactMoney(pipe.weightedBhdCents), caption: plural(pipe.count, "deal"), href: "/crm/pipeline" },
          ]}
        />
      )}

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <ListSection header="Today" action={<Link href="/tasks" className="text-subhead text-accent">All Tasks</Link>}>
          {soonMeetings.map((m) => (
            <ListRow
              key={m.id}
              href="/meetings"
              leading={<CalendarDays className="h-[22px] w-[22px] text-label-2" strokeWidth={1.7} />}
              title={m.title}
              subtitle={[`${relativeDay(toYmd(m.startsAt))} ${formatTime(m.startsAt)}`, m.clientName ?? m.projectName].filter(Boolean).join(" · ")}
            />
          ))}
          {dueTasks.map((t) => (
            <TaskRow key={t.id} task={t} hideAssignee />
          ))}
          {soonMeetings.length === 0 && dueTasks.length === 0 && (
            <ListRow title="Nothing due today" subtitle={myTasks.length ? `${plural(myTasks.length, "open task")} later on` : "Enjoy the calm."} href="/tasks" />
          )}
        </ListSection>

        {attentionCount > 0 && (
          <ListSection header="Needs Attention">
            {alerts.hostingAlerts.map(({ subscription: h, overdue }) => (
              <ListRow
                key={h.id}
                href="/hosting"
                title={`${h.clientName} — ${h.label ?? h.item} fee`}
                subtitle={<span className={overdue ? "text-ios-red" : undefined}>{overdue ? `Overdue since ${formatDate(h.nextDueDate)}` : `Due ${relativeDay(h.nextDueDate!)}`}</span>}
                detail={centsToDisplay(h.amountCents, h.currency)}
              />
            ))}
            {alerts.renewalsWithin30Days.map((r) => (
              <ListRow
                key={r.label}
                href={admin ? "/company" : undefined}
                title={r.label}
                subtitle={<span className={r.overdue ? "text-ios-red" : undefined}>{r.overdue ? `Expired ${formatDate(r.dueDate)}` : `Renews ${relativeDay(r.dueDate)}`}</span>}
              />
            ))}
            {followUpsDue.map((a) => (
              <FollowUpRow key={a.id} activity={a} />
            ))}
          </ListSection>
        )}
      </div>
    </Page>
  );
}
