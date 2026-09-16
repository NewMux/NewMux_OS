/**
 * Recently visited entities, for the command palette's empty state.
 *
 * Per-device by design and isolated here: the store resets on every restart,
 * so a server-side list would be wiped more often than this one and would
 * falsely imply it syncs across devices. Moving to a table later is a
 * one-file change.
 */
const KEY = "newmux-recent";
const MAX = 6;

export type RecentEntry = { title: string; subtitle: string | null; href: string };

/** Every access is guarded: private windows and blocked site data throw. */
export function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as RecentEntry).href === "string" &&
        typeof (entry as RecentEntry).title === "string",
    );
  } catch {
    return [];
  }
}

export function pushRecent(entry: RecentEntry): void {
  try {
    const next = [entry, ...readRecent().filter((e) => e.href !== entry.href)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A palette that cannot remember is still a working palette.
  }
}
