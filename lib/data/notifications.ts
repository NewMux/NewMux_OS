import type { Session } from "next-auth";
import { getDashboardAlerts } from "./alerts";
import { store } from "./store";
import { canAccessFinance } from "@/lib/rbac";
import { centsToDisplay } from "@/lib/money";
import {
  SEVERITY_ORDER,
  type AppNotification,
  type NotificationSeverity,
} from "@/lib/notifications/types";

export type {
  AppNotification,
  NotificationKind,
  NotificationSeverity,
} from "@/lib/notifications/types";

/** Whole days from today; negative is in the past. */
function daysFromToday(iso: string): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round(
    (startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000,
  );
}

function severityFor(iso: string): NotificationSeverity {
  const days = daysFromToday(iso);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "upcoming";
}

/** "in 12 days" / "3 days ago" / "today", for the notification body. */
function relative(iso: string): string {
  const days = daysFromToday(iso);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/** Stable slug for the id, so the same alert keeps the same id across renders. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function isoDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * The dashboard's alerts, reshaped into a feed the bell can render.
 *
 * This computes nothing new: lib/data/alerts.ts already decides what is due,
 * overdue or renewing, and having two definitions of "overdue" would guarantee
 * the badge and the dashboard eventually disagree.
 */
export async function listNotifications(
  session: Session | null,
): Promise<AppNotification[]> {
  if (!session) return [];

  const alerts = await getDashboardAlerts();
  const notifications: AppNotification[] = [];
  const finance = canAccessFinance(session);

  for (const meeting of alerts.todaysMeetings) {
    notifications.push({
      id: `meeting:${meeting.id}:${isoDay(meeting.startsAt)}`,
      kind: "meeting",
      severity: severityFor(meeting.startsAt),
      title: meeting.title,
      body: `Starts ${new Date(meeting.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      href: "/meetings",
      occurredAt: meeting.startsAt,
    });
  }

  for (const task of alerts.tasksDueTodayOrOverdue) {
    const project = store.projects.find((p) => p.id === task.projectId);
    notifications.push({
      id: `task:${task.id}:${isoDay(task.dueAt!)}`,
      kind: "task",
      severity: task.overdue ? "overdue" : "today",
      title: task.title,
      body: `${project?.name ?? "Project"} · due ${relative(task.dueAt!)}`,
      href: project ? `/projects/${project.id}` : "/meetings",
      occurredAt: task.dueAt!,
    });
  }

  for (const renewal of alerts.renewalsWithin30Days) {
    notifications.push({
      // Renewals have no stable record id, so the label carries it. The date
      // makes next year's renewal a distinct, unread notification.
      id: `renewal:${slug(renewal.label)}:${isoDay(renewal.dueDate)}`,
      kind: "renewal",
      severity: severityFor(renewal.dueDate),
      title: renewal.label,
      body: `Due ${relative(renewal.dueDate)}`,
      href: renewal.label.includes("—") ? "/projects" : "/company",
      occurredAt: renewal.dueDate,
    });
  }

  if (finance) {
    for (const { subscription, overdue } of alerts.hostingAlerts) {
      const client = store.clients.find((c) => c.id === subscription.clientId);
      const due = subscription.nextDueDate;
      if (!due) continue;
      notifications.push({
        id: `hosting:${subscription.id}:${isoDay(due)}`,
        kind: "hosting",
        severity: overdue ? "overdue" : severityFor(due),
        title: `${client?.name ?? "Unknown client"} · ${subscription.item}`,
        body: `${centsToDisplay(subscription.amountCents, subscription.currency)} due ${relative(due)}`,
        href: "/hosting",
        occurredAt: due,
      });
    }

    for (const followUp of alerts.dealFollowUps) {
      notifications.push({
        id: `follow_up:${followUp.dealId}:${isoDay(followUp.dueDate)}`,
        kind: "follow_up",
        severity: followUp.status === "overdue" ? "overdue" : "today",
        title: followUp.dealName,
        body: `${followUp.stageLabel} · follow up ${relative(followUp.dueDate)}`,
        href: `/pipeline/${followUp.dealId}`,
        occurredAt: followUp.dueDate,
      });
    }
  }

  return notifications.sort((a, b) => {
    const bySeverity =
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.occurredAt < b.occurredAt
      ? -1
      : a.occurredAt > b.occurredAt
        ? 1
        : 0;
  });
}
