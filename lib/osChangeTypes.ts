/** OS updates (lib/osChanges.ts): the shapes and labels, safe for client components. */

export type OsChangeStatus = "working" | "failed" | "answered" | "checking" | "checks_failed" | "conflict" | "ready" | "merged" | "closed";

export const OS_CHANGE_STATUS: Record<OsChangeStatus, { label: string; short: string; color: "blue" | "orange" | "red" | "green" | "gray" | "purple" }> = {
  working: { label: "Claude is working on it", short: "Working", color: "blue" },
  failed: { label: "Claude couldn't finish", short: "Stopped", color: "red" },
  answered: { label: "Claude replied, no code changed", short: "Replied", color: "gray" },
  checking: { label: "Running checks", short: "Checking", color: "orange" },
  checks_failed: { label: "Checks failed", short: "Checks failed", color: "red" },
  conflict: { label: "Clashes with newer changes", short: "Clash", color: "orange" },
  ready: { label: "Ready to merge", short: "Ready", color: "green" },
  merged: { label: "Merged", short: "Merged", color: "purple" },
  closed: { label: "Closed", short: "Closed", color: "gray" },
};

export type OsChange = {
  number: number;
  title: string;
  details: string;
  requestedBy: string | null;
  requesterId: string | null;
  createdAt: string;
  status: OsChangeStatus;
  issueUrl: string;
  pr: { number: number; url: string; branch: string; sha: string; additions: number | null; deletions: number | null; changedFiles: number | null } | null;
  checks: { passed: number; failed: number; pending: number; failedNames: string[] } | null;
  /** Claude's latest note, trimmed. */
  reply: string | null;
  /** When the PR merged. */
  mergedAt: string | null;
};
