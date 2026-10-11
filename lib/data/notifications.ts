import { query } from "@/lib/db";
import { many, one } from "./sql";

export type PushSubscriptionRow = { id: string; userId: string; endpoint: string; p256dh: string; auth: string; device: string | null };

export type Reminder = {
  id: string;
  userId: string;
  userName?: string;
  title: string;
  body: string | null;
  href: string | null;
  remindAt: string;
  sentAt: string | null;
  createdBy: string | null;
};

// --- Devices ---

/** Saves this device's push subscription for the user (re-subscribing moves it to them). */
export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string; device: string | null }): Promise<void> {
  await query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth, device) values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`,
    [userId, sub.endpoint, sub.p256dh, sub.auth, sub.device],
  );
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await query("delete from push_subscriptions where user_id = $1 and endpoint = $2", [userId, endpoint]);
}

export async function deletePushSubscriptionById(id: string): Promise<void> {
  await query("delete from push_subscriptions where id = $1", [id]);
}

export async function listPushSubscriptions(userIds: string[]): Promise<PushSubscriptionRow[]> {
  if (!userIds.length) return [];
  return many<PushSubscriptionRow>(
    `select s.id, s.user_id, s.endpoint, s.p256dh, s.auth, s.device from push_subscriptions s
     join users u on u.id = s.user_id where u.is_active and s.user_id::text = any($1)`,
    [userIds],
  );
}

export async function countPushSubscriptions(userId: string): Promise<number> {
  return (await one<{ n: number }>("select count(*)::int as n from push_subscriptions where user_id = $1", [userId]))?.n ?? 0;
}

export async function markPushSent(id: string): Promise<void> {
  await query("update push_subscriptions set last_sent_at = now() where id = $1", [id]);
}

// --- Reminders ---

export async function createReminder(input: { userId: string; title: string; body: string | null; href: string | null; remindAt: string; createdBy: string }): Promise<Reminder> {
  return (await one<Reminder>(
    `insert into reminders (user_id, title, body, href, remind_at, created_by) values ($1, $2, $3, $4, $5, $6) returning *`,
    [input.userId, input.title, input.body, input.href, input.remindAt, input.createdBy],
  ))!;
}

/** Reminders not sent yet, for or by this user, soonest first. */
export async function listUpcomingReminders(userId: string): Promise<Reminder[]> {
  return many<Reminder>(
    `select r.*, u.full_name as user_name from reminders r join users u on u.id = r.user_id
     where r.sent_at is null and (r.user_id = $1 or r.created_by = $1) order by r.remind_at limit 100`,
    [userId],
  );
}

export async function getReminder(id: string): Promise<Reminder | undefined> {
  return one<Reminder>("select * from reminders where id = $1", [id]);
}

export async function deleteReminder(id: string): Promise<void> {
  await query("delete from reminders where id = $1", [id]);
}

/** Due reminders, claimed so a second run running at the same moment can't send them again. */
export async function claimDueReminders(now: Date = new Date()): Promise<Reminder[]> {
  return many<Reminder>("update reminders set sent_at = now() where sent_at is null and remind_at <= $1 returning *", [now.toISOString()]);
}

// --- Sent log ---

/** Records that `key` went to the user; false when it already had (so don't send it again). */
export async function claimNotification(userId: string, key: string): Promise<boolean> {
  const rows = await query("insert into notification_log (user_id, key) values ($1, $2) on conflict do nothing returning key", [userId, key]);
  return rows.length > 0;
}

/** Keeps the log small: entries older than 90 days can't be sent again anyway. */
export async function pruneNotificationLog(): Promise<void> {
  await query("delete from notification_log where sent_at < now() - interval '90 days'");
}
