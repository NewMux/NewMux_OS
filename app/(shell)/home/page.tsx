import Link from "next/link";
import {
  AlarmClock,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CircleCheckBig,
  FileText,
  Handshake,
  Receipt,
  Search,
  Server,
  Star,
  Wallet,
  Bell,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Widget, Metric } from "@/components/ui/Widget";
import { Avatar } from "@/components/ui/Avatar";
import { TaskRow } from "@/components/work/TaskRow";
import { FollowUpRow } from "@/components/crm/FollowUpRow";
import { NavIcon } from "@/components/shell/NavIcon";
import { getDashboardAlerts } from "@/lib/data/alerts";
import { getErpDashboardSummary } from "@/lib/data/finance";
import { getPipelineSummary, listOpenFollowUps, openPipelineTotals } from "@/lib/data/crm";
import { listFavorites, listRecentPages } from "@/lib/data/kb";
import { listTasks } from "@/lib/data/projects";
import { listUpcomingMeetings } from "@/lib/data/meetings";
import { isPartnerAdmin } from "@/lib/rbac";
import { MORE_LINKS, forRole } from "@/lib/nav";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { addDaysYmd, formatDate, formatTime, relativeDay, todayYmd, toYmd, APP_TZ } from "@/lib/time";
import { cn, plural } from "@/lib/utils";

export const metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const firstName = (session.user.name ?? "").split(" ")[0] || "there";
  const today = todayYmd();

  const [alerts, myTasks, meetings, favorites, recents, finance, pipeline, followUps] = await Promise.all([
    getDashboardAlerts({ includeFinance: admin }),
    listTasks({ assigneeId: session.user.id, openOnly: true }),
    listUpcomingMeetings(7),
    listFavorites(session.user.id),
    listRecentPages(session.user.id, 5),
    admin ? getErpDashboardSummary() : null,
    admin ? getPipelineSummary() : null,
    admin ? listOpenFollowUps() : [],
  ]);

  const dueSoon = myTasks.filter((t) => t.dueAt && t.dueAt <= addDaysYmd(today, 1));
  const followUpsDue = followUps.filter((f) => f.dueAt && toYmd(f.dueAt) <= today);
  const pipe = pipeline ? openPipelineTotals(pipeline) : null;
  const net = finance ? finance.collectedThisMonthBhdCents - finance.spentThisMonthBhdCents : 0;

  const quick = [
    admin && { href: "/crm/pipeline?new=1", label: "Deal", icon: Handshake, color: "indigo" as const },
    { href: "/tasks?new=1", label: "Task", icon: CircleCheckBig, color: "orange" as const },
    admin && { href: "/documents/new?type=invoice", label: "Invoice", icon: FileText, color: "green" as const },
    admin && { href: "/finance/expenses?new=1", label: "Expense", icon: Receipt, color: "red" as const },
    { href: "/wiki?new=1", label: "Page", icon: BookOpen, color: "yellow" as const },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Handshake; color: "indigo" | "orange" | "green" | "red" | "yellow" }[];

  return (
    <Page
      title={`${greeting()}, ${firstName}`}
      subtitle={formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
      actions={
        <Link href="/settings" aria-label="Settings" className="press">
          <Avatar name={session.user.name ?? "?"} size={34} />
        </Link>
      }
      accessory={
        <Link href="/search" className="flex h-9 items-center gap-2 rounded-[10px] bg-fill/[0.12] px-2.5 text-body text-label-2 md:hidden">
          <Search className="h-4 w-4" />
          Search
        </Link>
      }
    >
      {/* Quick actions */}
      <div className="no-scrollbar -mx-4 mb-6 flex gap-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        {quick.map((q) => (
          <Link key={q.label} href={q.href} className="press flex w-[62px] shrink-0 flex-col items-center gap-1.5">
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-bg-elevated shadow-widget dark:shadow-none">
              <q.icon className={cn("h-6 w-6", { indigo: "text-ios-indigo", orange: "text-ios-orange", green: "text-ios-green", red: "text-ios-red", yellow: "text-ios-yellow" }[q.color])} />
            </span>
            <span className="text-caption1 font-medium text-label">{q.label}</span>
          </Link>
        ))}
      </div>

      {/* Widgets */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Widget title="Today" icon={CalendarDays} color="red" href="/meetings">
          <Metric value={alerts.todaysMeetings.length + dueSoon.length} caption={`${plural(alerts.todaysMeetings.length, "meeting")} · ${plural(dueSoon.length, "task")} due`} />
        </Widget>
        {finance ? (
          <>
            <Widget title="This Month" icon={Wallet} color="green" href="/finance">
              <Metric value={compactMoney(net, "BHD")} tone={net >= 0 ? undefined : "negative"} caption="net cash in − out" />
              <div className="mt-2 flex gap-3 text-caption1 text-label-2">
                <span className="flex items-center gap-0.5">
                  <ArrowDownLeft className="h-3 w-3 text-ios-green" />
                  {compactMoney(finance.collectedThisMonthBhdCents)}
                </span>
                <span className="flex items-center gap-0.5">
                  <ArrowUpRight className="h-3 w-3 text-ios-red" />
                  {compactMoney(finance.spentThisMonthBhdCents)}
                </span>
              </div>
            </Widget>
            <Widget title="Receivables" icon={FileText} color="orange" href="/documents?type=invoice">
              <Metric
                value={compactMoney(finance.totalOutstandingBhdCents)}
                caption={plural(finance.unpaidInvoiceCount + finance.partiallyPaidInvoiceCount, "open invoice")}
              />
            </Widget>
            <Widget title="Pipeline" icon={Handshake} color="indigo" href="/crm/pipeline">
              <Metric value={compactMoney(pipe!.weightedBhdCents)} caption={`weighted · ${plural(pipe!.count, "open deal")}`} />
            </Widget>
          </>
        ) : (
          <Widget title="My Tasks" icon={CircleCheckBig} color="orange" href="/tasks">
            <Metric value={myTasks.length} caption="open" />
          </Widget>
        )}
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          {(alerts.todaysMeetings.length > 0 || meetings.length > 0) && (
            <ListSection header="Up Next" action={<Link href="/meetings" className="text-subhead text-accent">Calendar</Link>}>
              {meetings.slice(0, 4).map((m) => (
                <ListRow
                  key={m.id}
                  href="/meetings"
                  leading={
                    <span className="flex w-11 flex-col items-center leading-tight">
                      <span className={cn("text-caption2 font-semibold uppercase", toYmd(m.startsAt) === today ? "text-ios-red" : "text-label-2")}>
                        {toYmd(m.startsAt) === today ? "Today" : formatDate(m.startsAt, { weekday: "short" })}
                      </span>
                      <span className="text-subhead font-semibold tabular">{formatTime(m.startsAt)}</span>
                    </span>
                  }
                  title={m.title}
                  subtitle={[m.clientName ?? m.projectName, m.location].filter(Boolean).join(" · ") || undefined}
                />
              ))}
            </ListSection>
          )}

          <ListSection header="My Tasks" action={<Link href="/tasks" className="text-subhead text-accent">See All</Link>}>
            {myTasks.slice(0, 6).map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
            {myTasks.length === 0 && <ListRow title="Nothing assigned to you" subtitle="Enjoy the calm." />}
          </ListSection>

          {admin && followUpsDue.length > 0 && (
            <ListSection header="Follow-ups Due" action={<Link href="/crm/activities" className="text-subhead text-accent">All</Link>}>
              {followUpsDue.slice(0, 5).map((a) => (
                <FollowUpRow key={a.id} activity={a} />
              ))}
            </ListSection>
          )}
        </div>

        <div>
          {(alerts.renewalsWithin30Days.length > 0 || alerts.hostingAlerts.length > 0) && (
            <ListSection header="Needs Attention">
              {alerts.hostingAlerts.map(({ subscription: h, overdue }) => (
                <ListRow
                  key={h.id}
                  href="/hosting"
                  leading={<IconTile icon={Server} color={overdue ? "red" : "orange"} />}
                  title={`${h.clientName} — ${h.label ?? h.item} fee`}
                  subtitle={overdue ? `Overdue since ${formatDate(h.nextDueDate)}` : `Due ${relativeDay(h.nextDueDate!)}`}
                  detail={centsToDisplay(h.amountCents, h.currency)}
                />
              ))}
              {alerts.renewalsWithin30Days.map((r) => (
                <ListRow
                  key={r.label}
                  href={admin ? "/company" : undefined}
                  leading={<IconTile icon={r.overdue ? Bell : AlarmClock} color={r.overdue ? "red" : "yellow"} />}
                  title={r.label}
                  subtitle={r.overdue ? `Expired ${formatDate(r.dueDate)}` : `Due ${relativeDay(r.dueDate)}`}
                />
              ))}
            </ListSection>
          )}

          <ListSection header="Wiki" action={<Link href="/wiki" className="text-subhead text-accent">Open</Link>}>
            {favorites.slice(0, 4).map((p) => (
              <ListRow
                key={p.id}
                href={`/wiki/${p.id}`}
                leading={<span className="flex h-[30px] w-[30px] items-center justify-center text-[22px]">{p.emoji ?? "📄"}</span>}
                title={p.title || "Untitled"}
                subtitle={p.spaceName}
                trailing={<Star className="h-4 w-4 fill-ios-yellow text-ios-yellow" />}
              />
            ))}
            {recents
              .filter((r) => !favorites.some((f) => f.id === r.id))
              .slice(0, 3)
              .map((p) => (
                <ListRow
                  key={p.id}
                  href={`/wiki/${p.id}`}
                  leading={<span className="flex h-[30px] w-[30px] items-center justify-center text-[22px]">{p.emoji ?? "📄"}</span>}
                  title={p.title || "Untitled"}
                  subtitle={`Recently viewed · ${p.spaceName}`}
                />
              ))}
            {favorites.length === 0 && recents.length === 0 && <ListRow href="/wiki" title="Browse the wiki" subtitle="SOPs, onboarding and client notes" />}
          </ListSection>

          <ListSection header="More" className="md:hidden">
            {forRole(MORE_LINKS, session.user.role).map((l) => (
              <ListRow
                key={l.href}
                href={l.href}
                leading={<IconTile icon={({ className }) => <NavIcon icon={l.icon} className={className} />} color={l.color} />}
                title={l.label}
              />
            ))}
          </ListSection>
        </div>
      </div>
    </Page>
  );
}
