/**
 * Which way the screen should move when a page mounts, iOS style: deeper
 * screens push in from the right, going back pops in from the left, and
 * switching between sections crossfades. Client-only module state.
 */
export type NavDirection = "push" | "pop" | "fade";

let lastPath: string | null = null;
let backPending = false;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    backPending = true;
  });
}

/** Call before navigating via an in-app back control. */
export function markBack() {
  backPending = true;
}

const depth = (path: string) => path.split("/").filter(Boolean).length;

/** Returns the animation for arriving at `path` (null on first load or a same-path update). */
export function takeDirection(path: string): NavDirection | null {
  const prev = lastPath;
  lastPath = path;
  if (prev === null || prev === path) {
    backPending = false;
    return null;
  }
  if (backPending) {
    backPending = false;
    return "pop";
  }
  if (path.startsWith(`${prev}/`) || depth(path) > depth(prev)) return "push";
  if (prev.startsWith(`${path}/`) || depth(path) < depth(prev)) return "pop";
  return "fade";
}
