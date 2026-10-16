import { many } from "@/lib/data/sql";
import { getAttentionItems } from "@/lib/data/attention";
import {
  claimDueReminders,
  claimNotification,
  deletePushSubscriptionById,
  listPushSubscriptions,
  markPushSent,
  pruneNotificationLog,
} from "@/lib/data/notifications";
import { addDaysYmd, daysUntil, formatTime, todayYmd } from "@/lib/time";
import { sendPush, vapidKeys, type PushPayload } from "./webpush";

/** Daily notices (tasks due, renewals) go at the first check after this hour, Bahrain time. */
export const MORNING_HOUR = 9;
/** How long before a meeting its notice goes. */
export const MEETING_LEAD_MINUTES = 15;

/** Bahrain is UTC+3 all year. */
const bahrainHour = (now: Date) => (now.getUTCHours() + 3) % 24;

/** Sends to every device of these people. Devices the browser has dropped are removed. Returns how many got it. */
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!vapidKeys()) return 0;
  const subs = await listPushSubscriptions([...new Set(userIds)]);
  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        const result = await sendPush(sub, payload);
        if (result.ok) {
          await markPushSent(sub.id);
          return 1;
        }
        if (result.gone) await deletePushSubscriptionById(sub.id);
        else console.error(`[push] ${new URL(sub.endpoint).host} refused a notification: ${result.status}`);
      } catch (error) {
        console.error("[push] send failed", error);
      }
      return 0;
    }),
  );
  return results.reduce<number>((a, b) => a + b, 0);
}

/** Sends `payload` to each user who hasn't had `key` yet. */
export async function once(userIds: string[], key: string, payload: PushPayload): Promise<number> {
  const fresh: string[] = [];
  for (const id of new Set(userIds)) if (await claimNotification(id, key)) fresh.push(id);
  return fresh.length ? sendToUsers(fresh, { tag: key, ...payload }) : 0;
}

export type RunSummary = { reminders: number; followUps: number; tasks: number; meetings: number; renewals: number; devicesReached: number; skipped?: string };

/**
 * Everything that has come due since the last check, run every few minutes
 * (the Cloudflare cron in cloudflare-worker.mjs, or instrumentation.ts on a
 * server). Each notice is recorded in notification_log first, so overlapping
 * or repeated runs never send it twice.
 *
 * - Reminders set for an exact time (Haman's "remind me at…"): at that time.
 * - CRM follow-ups: when due, to whoever set them. One set for a day without
 *   a time goes that morning.
 * - Tasks due today: that morning, to the assignee.
 * - Meetings: 15 minutes before, to everyone (meetings are company-wide).
 * - Renewals, expiring files and hosting fees to collect: to partners, a
 *   week before and on the day, in the morning. Snoozed ones are skipped.
 */
export async function runDueNotifications(now = new Date()): Promise<RunSummary> {
  const summary: RunSummary = { reminders: 0, followUps: 0, tasks: 0, meetings: 0, renewals: 0, devicesReached: 0 };
  if (!vapidKeys()) return { ...summary, skipped: "VAPID keys are not set" };
  const today = todayYmd();
  const morning = bahrainHour(now) >= MORNING_HOUR;

  // Exact-time reminders.
  for (const r of await claimDueReminders(now)) {
    summary.reminders += 1;
    summary.devicesReached += await sendToUsers([r.userId], { title: r.title, body: r.body ?? "Reminder", url: r.href ?? "/home", tag: `reminder:${r.id}` });
  }

  // CRM follow-ups (a date with no time is stored as midnight UTC: send it at 9:00 that day instead of 3:00).
  const followUps = await many<{ id: string; subject: string; dueAt: string; createdBy: string | null; about: string | null; href: string }>(
    `select a.id, a.subject, a.due_at, a.created_by, coalesce(d.title, c.name, ct.full_name) as about,
       case when a.deal_id is not null then '/crm/deals/' || a.deal_id when a.client_id is not null then '/clients/' || a.client_id else '/crm/activities' end as href
     from activities a
     left join deals d on d.id = a.deal_id left join clients c on c.id = a.client_id left join contacts ct on ct.id = a.contact_id
     where a.kind = 'follow_up' and a.completed_at is null and a.due_at <= $1 and a.due_at > $1::timestamptz - interval '2 days'`,
    [now.toISOString()],
  );
  const partners = (await many<{ id: string }>("select id from users where is_active and role = 'partner_admin'")).map((u) => u.id);
  for (const f of followUps) {
    const due = new Date(f.dueAt);
    const dateOnly = due.getUTCHours() === 0 && due.getUTCMinutes() === 0 && due.getUTCSeconds() === 0;
    if (dateOnly && due.getTime() + 6 * 3600_000 > now.getTime()) continue; // 06:00 UTC = 09:00 Bahrain
    const sent = await once(f.createdBy ? [f.createdBy] : partners, `follow_up:${f.id}`, { title: `Follow up: ${f.subject}`, body: f.about ?? "CRM follow-up due", url: f.href });
    if (sent) summary.followUps += 1;
    summary.devicesReached += sent;
  }

  // Meetings starting within the next few minutes.
  const meetings = await many<{ id: string; title: string; startsAt: string; location: string | null }>(
    `select id, title, starts_at, location from meetings where starts_at > $1 and starts_at <= $1::timestamptz + make_interval(mins => $2)`,
    [now.toISOString(), MEETING_LEAD_MINUTES],
  );
  if (meetings.length) {
    const everyone = (await many<{ id: string }>("select id from users where is_active")).map((u) => u.id);
    for (const m of meetings) {
      const sent = await once(everyone, `meeting:${m.id}:${m.startsAt}`, { title: `${formatTime(m.startsAt)} · ${m.title}`, body: m.location ? `Starts soon · ${m.location}` : "Starts soon", url: "/meetings" });
      if (sent) summary.meetings += 1;
      summary.devicesReached += sent;
    }
  }

  if (morning) {
    // Tasks due today.
    const tasks = await many<{ id: string; title: string; assigneeId: string; projectId: string; projectName: string }>(
      `select t.id, t.title, t.assignee_id, t.project_id, p.name as project_name from tasks t join projects p on p.id = t.project_id
       where t.due_at = $1::date and t.status <> 'done' and t.assignee_id is not null`,
      [today],
    );
    for (const t of tasks) {
      const sent = await once([t.assigneeId], `task:${t.id}:${today}`, { title: `Due today: ${t.title}`, body: t.projectName, url: `/projects/${t.projectId}?task=${t.id}` });
      if (sent) summary.tasks += 1;
      summary.devicesReached += sent;
    }

    // Renewals, expiring files and hosting fees: a week ahead and on the day.
    const items = await getAttentionItems({ includeFinance: true, includeCrm: false });
    for (const item of items) {
      const days = daysUntil(item.date);
      if (days !== 0 && days !== 7) continue;
      const when = days === 0 ? "today" : `in a week (${addDaysYmd(today, 7)})`;
      const sent = await once(partners, `attention:${item.key}:${item.date}:${days}`, {
        title: item.kind === "hosting" ? `To collect ${when}: ${item.title}` : `${item.title} ${days === 0 ? "is due today" : "is due in a week"}`,
        body: item.detail ?? (item.kind === "hosting" ? "Hosting fee" : "Renewal"),
        url: item.href,
      });
      if (sent) summary.renewals += 1;
      summary.devicesReached += sent;
    }
  }

  // Once a day is plenty for housekeeping.
  if (now.getUTCMinutes() < 5 && now.getUTCHours() === 0) await pruneNotificationLog();
  return summary;
}
