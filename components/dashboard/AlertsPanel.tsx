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

      {nothingToShow && <p className="text-sm text-muted-foreground">Nothing urgent today.</p>}

      <div className="flex flex-col gap-3 text-sm">
        {alerts.todaysMeetings.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Meetings today</p>
            {alerts.todaysMeetings.map((m) => (
              <p key={m.id} className="text-foreground">
                {new Date(m.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {m.title}
              </p>
            ))}
          </div>
        )}

        {alerts.tasksDueTodayOrOverdue.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Tasks due today / overdue</p>
            {alerts.tasksDueTodayOrOverdue.map((t) => (
              <p key={t.id} className={t.overdue ? "text-danger" : "text-foreground"}>
                {t.title} {t.overdue && <Badge tone="danger" className="ml-1">Overdue</Badge>}
              </p>
            ))}
          </div>
        )}

        {alerts.dealFollowUps.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Deal follow-ups due</p>
            {alerts.dealFollowUps.map((r) => (
              <Link key={r.dealId} href={`/pipeline/${r.dealId}`} className="block hover:underline">
                <span className={r.status === "overdue" ? "text-danger" : "text-warning"}>
                  {r.dealName} — {r.stageLabel}
                  {r.status === "overdue" && <Badge tone="danger" className="ml-1">Overdue</Badge>}
                </span>
              </Link>
            ))}
          </div>
        )}

        {alerts.renewalsWithin30Days.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Upcoming renewals (≤30 days)</p>
            {alerts.renewalsWithin30Days.map((r, i) => (
              <p key={i} className={r.overdue ? "text-danger" : "text-warning"}>
                {r.label} — {new Date(r.dueDate).toLocaleDateString()}
                {r.overdue ? " (overdue)" : ""}
              </p>
            ))}
          </div>
        )}

        {alerts.hostingAlerts.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Hosting fee alerts</p>
            {alerts.hostingAlerts.map((h) => (
              <p key={h.subscription.id} className={h.overdue ? "text-danger" : "text-warning"}>
                {centsToDisplay(h.subscription.amountCents, h.subscription.currency)} {h.subscription.item}
                {h.subscription.nextDueDate ? ` — due ${new Date(h.subscription.nextDueDate).toLocaleDateString()}` : ""}
                {h.overdue ? " (overdue)" : ""}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
          <span>{alerts.activeProjectCount} active projects</span>
          <span>{alerts.completedProjectCount} completed</span>
        </div>
      </div>
    </Card>
  );
}
