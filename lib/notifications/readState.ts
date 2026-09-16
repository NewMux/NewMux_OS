/**
 * Which notifications this device has already seen.
 *
 * Read-state is per-device: an alert dismissed on desktop reappears unread on
 * the phone. The alternative — an array on the store — would be *worse*, since
 * the store resets on every restart and would both lose the state more often
 * and falsely imply it syncs. Moving to a notification_reads table is a
 * one-file change from here.
 *
 * Ids are content-derived (see lib/notifications/types.ts), which is what lets
 * this survive a restart at all.
 */
const KEY = "newmux-notifications-read";

/** Every access is guarded: private windows and blocked site data throw. */
export function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function write(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // A bell that cannot remember still shows the right alerts.
  }
}

export function markRead(id: string, dismissed: Set<string>): Set<string> {
  const next = new Set(dismissed).add(id);
  write(next);
  return next;
}

/**
 * Drop ids that are no longer in the feed, so the key cannot grow forever as
 * alerts resolve and new ones take their place.
 */
export function reconcile(dismissed: Set<string>, liveIds: string[]): Set<string> {
  const live = new Set(liveIds);
  const next = new Set([...dismissed].filter((id) => live.has(id)));
  if (next.size !== dismissed.size) write(next);
  return next;
}
