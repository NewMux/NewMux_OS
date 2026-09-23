/**
 * The business runs on Bahrain time (UTC+3, no DST). "Today", month
 * boundaries and due-date comparisons use this zone instead of whatever
 * timezone the server happens to run in.
 */
export const APP_TZ = "Asia/Bahrain";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD for the given instant in Bahrain. */
export function toYmd(date: Date | string = new Date()): string {
  return ymdFormatter.format(typeof date === "string" ? new Date(date) : date);
}

export function todayYmd(): string {
  return toYmd(new Date());
}

/** Adds whole days to a YYYY-MM-DD string. */
export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Adds months to a YYYY-MM-DD, clamping to month end (Jan 31 + 1 → Feb 28/29). */
export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole days from today (Bahrain) until `ymd`; negative when in the past. */
export function daysUntil(ymd: string): number {
  const a = Date.parse(`${todayYmd()}T00:00:00Z`);
  const b = Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** First day (YYYY-MM-01) of the month containing `ymd`. */
export function monthStartYmd(ymd: string = todayYmd()): string {
  return `${ymd.slice(0, 7)}-01`;
}

/**
 * Formats a date in Bahrain time as "Wed 23 Sep 2026" (only the requested
 * parts). Assembled from individual parts rather than a locale pattern, so
 * the server (Node ICU) and the browser always produce identical text — a
 * locale-pattern mismatch would break React hydration.
 */
export function formatDate(
  value: string | null | undefined,
  opts: Pick<Intl.DateTimeFormatOptions, "weekday" | "day" | "month" | "year" | "hour" | "minute"> = { day: "numeric", month: "short", year: "numeric" },
): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, hourCycle: "h23", ...opts }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const date = [get("weekday"), get("day"), get("month"), get("year")].filter(Boolean).join(" ");
  const time = opts.hour ? `${get("hour")}:${get("minute")}` : "";
  return [date, time].filter(Boolean).join(", ");
}

export function formatTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  return `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
}

/** "Today", "Tomorrow", "Yesterday", weekday within a week, else a short date. */
export function relativeDay(ymd: string): string {
  const diff = daysUntil(ymd);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return formatDate(ymd, { weekday: "long" });
  return formatDate(ymd, { day: "numeric", month: "short" });
}

/** "just now", "5m ago", "3h ago", "2d ago", else a date. */
export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso, { day: "numeric", month: "short" });
}
