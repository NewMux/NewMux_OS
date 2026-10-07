import type { HostingSubscription } from "./data/types";
import { daysUntil } from "./time";

export type HostingAlertLevel = "overdue" | "due_soon" | "upcoming" | "ok";

/** PRD section 6: 14-day alert, 3-day alert, then overdue once the due date passes. */
export function hostingAlertLevel(sub: Pick<HostingSubscription, "nextDueDate" | "status">): HostingAlertLevel {
  if (!sub.nextDueDate || sub.status === "paused" || sub.status === "not_started") return "ok";
  const days = daysUntil(sub.nextDueDate);
  if (days < 0) return "overdue";
  if (days <= 3) return "due_soon";
  if (days <= 14) return "upcoming";
  return "ok";
}
