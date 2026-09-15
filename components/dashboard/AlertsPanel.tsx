import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { centsToDisplay } from "@/lib/money";
import type { DashboardAlerts } from "@/lib/data/alerts";

export function AlertsPanel({ alerts }: { alerts: DashboardAlerts }) {
  const nothingToShow =
    alerts.todaysMeetings.length === 0 &&
    alerts.tasksDueTodayOrOverdue.length === 0 &&
    alerts.renewalsWithin30Days.length === 0 &&
    alerts.hostingAlerts.length === 0 &&
    alerts.dealFollowUps.length === 0;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Today</CardTitle>
      </CardHeader>

      {nothingToShow && <p className="text-sm text-slate-500">Nothing urgent today.</p>}

      <div className="flex flex-col gap-3 text-sm">
        {alerts.todaysMeetings.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Meetings today</p>
            {alerts.todaysMeetings.map((m) => (
              <p key={m.id} className="text-slate-200">
                {new Date(m.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {m.title}
              </p>
            ))}
          </div>
        )}

        {alerts.tasksDueTodayOrOverdue.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Tasks due today / overdue</p>
            {alerts.tasksDueTodayOrOverdue.map((t) => (
              <p key={t.id} className={t.overdue ? "text-red-400" : "text-slate-200"}>
                {t.title} {t.overdue && <Badge className="ml-1 bg-red-500/20 text-red-300">Overdue</Badge>}
              </p>
            ))}
          </div>
        )}

        {alerts.dealFollowUps.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Deal follow-ups due</p>
            {alerts.dealFollowUps.map((r) => (
              <Link key={r.dealId} href={`/pipeline/${r.dealId}`} className="block hover:underline">
                <span className={r.status === "overdue" ? "text-red-400" : "text-amber-400"}>
                  {r.dealName} — {r.stageLabel}
                  {r.status === "overdue" && <Badge className="ml-1 bg-red-500/20 text-red-300">Overdue</Badge>}
                </span>
              </Link>
            ))}
          </div>
        )}

        {alerts.renewalsWithin30Days.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Upcoming renewals (≤30 days)</p>
            {alerts.renewalsWithin30Days.map((r, i) => (
              <p key={i} className={r.overdue ? "text-red-400" : "text-amber-400"}>
                {r.label} — {new Date(r.dueDate).toLocaleDateString()}
                {r.overdue ? " (overdue)" : ""}
              </p>
            ))}
          </div>
        )}

        {alerts.hostingAlerts.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Hosting fee alerts</p>
            {alerts.hostingAlerts.map((h) => (
              <p key={h.subscription.id} className={h.overdue ? "text-red-400" : "text-amber-400"}>
                {centsToDisplay(h.subscription.amountCents, h.subscription.currency)} {h.subscription.item}
                {h.subscription.nextDueDate ? ` — due ${new Date(h.subscription.nextDueDate).toLocaleDateString()}` : ""}
                {h.overdue ? " (overdue)" : ""}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-4 border-t border-white/10 pt-2 text-xs text-slate-500">
          <span>{alerts.activeProjectCount} active projects</span>
          <span>{alerts.completedProjectCount} completed</span>
        </div>
      </div>
    </Card>
  );
}
