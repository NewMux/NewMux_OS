/**
 * Notification shape and its labels, free of any lib/data import so the bell
 * can import them as values. Same rule as lib/search/types.ts — enforced by
 * scripts/check-client-imports.mjs.
 */
export type NotificationSeverity = "overdue" | "today" | "upcoming";

export type NotificationKind =
  | "meeting"
  | "task"
  | "renewal"
  | "hosting"
  | "follow_up";

export type AppNotification = {
  /**
   * Derived from content, never freshly generated: the same alert must get the
   * same id on every poll, or read-state would never stick. The date is part
   * of it so next month's renewal of the same subscription arrives as a new,
   * unread notification rather than inheriting the last one's dismissal.
   *
   * Ids built on a record id are only as stable as that record id. Against the
   * in-memory store those are UUIDs regenerated on restart, so read-state
   * survives a reload but not a restart; against a real database it survives
   * both. The renewal ids, slugged from their label, are stable either way.
   */
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  href: string;
  /** ISO date this notification is about — its due date, not when it was made. */
  occurredAt: string;
};

export const SEVERITY_ORDER: NotificationSeverity[] = ["overdue", "today", "upcoming"];

export const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Coming up",
};

export const KIND_LABELS: Record<NotificationKind, string> = {
  meeting: "Meeting",
  task: "Task",
  renewal: "Renewal",
  hosting: "Hosting fee",
  follow_up: "Follow-up",
};
