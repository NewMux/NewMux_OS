import { many, ValidationError } from "@/lib/data/sql";
import { ROLE_LABEL, type UserRole } from "@/lib/data/types";
import { gh, GitHubError, githubConfigured, githubRepo } from "@/lib/github";
import { once } from "@/lib/push/notify";
import { OS_CHANGE_STATUS, type OsChange, type OsChangeStatus } from "./osChangeTypes";

/**
 * OS updates: changes to NEWMUX OS itself, asked for in the app (or through
 * Haman) and built by Claude Code on GitHub.
 *
 * 1. Anyone signed in files a request. It becomes a GitHub issue labelled
 *    `haman`, which starts .github/workflows/claude.yml: Claude Code writes
 *    the change on a branch and, when it's done, the workflow leaves a
 *    "finished" note on the issue.
 * 2. Here, the note turns into a pull request (opened with our token, so the
 *    checks in .github/workflows/checks.yml run on it), and its checks are
 *    followed. Failing checks or a clash with newer changes are sent back to
 *    Claude (twice at most) without anyone asking.
 * 3. A partner merges it. Merging into the branch Cloudflare deploys is what
 *    puts it live, so nothing reaches the app until a partner says so.
 *
 * Asking for changes to a request is a comment starting "@claude", on the
 * pull request once there is one. Who asked is kept in the issue and the
 * comments as a hidden marker, for notifications.
 *
 * No table: GitHub is the record. Everything is worked out from the issue,
 * its comments, the pull request and its checks, in a handful of requests
 * (Workers allow 50 per request on the free plan).
 */

export const OS_CHANGE_LABEL = "haman";

export { OS_CHANGE_STATUS, type OsChange, type OsChangeStatus } from "./osChangeTypes";

type GhUser = { login: string; type?: string };
type GhIssue = { number: number; title: string; body: string | null; state: "open" | "closed"; created_at: string; html_url: string; user: GhUser; pull_request?: unknown };
type GhComment = { id: number; body: string; created_at: string; user: GhUser };
type GhPull = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  created_at: string;
  merged_at: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  mergeable?: boolean | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
};
type GhCheckRun = { name: string; status: string; conclusion: string | null };

/** Haman's own notes, and the workflow's. */
const USER_MARK = /<!-- newmux:user=([0-9a-f-]{36}) -->/i;
const FINISHED_MARK = /<!-- haman:finished conclusion=(\w+)(?: branch=(\S+))? -->/;
const NO_CHANGES_MARK = "<!-- haman:no-changes -->";
const AUTO_MARK = /<!-- haman:auto=(\w+) sha=(\w+) -->/;
const BYLINE = "\n\n---\nRequested by ";

/** A run that hasn't reported back after this long has died. */
const STALE_MS = 90 * 60_000;
/** Checks can take a minute to appear on a new pull request. */
const CHECKS_GRACE_MS = 3 * 60_000;
/** Times the app sends failing checks or a clash back to Claude by itself. */
const MAX_AUTO_FIXES = 2;

const isBot = (u: GhUser) => u.type === "Bot" || u.login.endsWith("[bot]");
const isClaude = (u: GhUser) => u.login === "claude[bot]" || u.login === "claude";
const ms = (s: string) => new Date(s).getTime();

function cleanText(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/g, "")
    .trim();
}

function splitBody(body: string | null): { details: string; requestedBy: string | null; requesterId: string | null } {
  const text = body ?? "";
  const at = text.lastIndexOf(BYLINE);
  const details = cleanText(at >= 0 ? text.slice(0, at) : text);
  const byline = at >= 0 ? text.slice(at + BYLINE.length) : "";
  const name = byline.match(/^\*\*(.+?)\*\*/)?.[1] ?? null;
  return { details, requestedBy: name, requesterId: text.match(USER_MARK)?.[1] ?? null };
}

function signature(user: { id: string; name: string }) {
  return `\n\n— ${user.name}, from NEWMUX OS <!-- newmux:user=${user.id} -->`;
}

// --- Reading ---

let defaultBranch: string | null = null;
async function baseBranch(): Promise<string> {
  if (process.env.GITHUB_BRANCH?.trim()) return process.env.GITHUB_BRANCH.trim();
  if (!defaultBranch) defaultBranch = (await gh<{ default_branch: string }>("/repos/{repo}")).default_branch;
  return defaultBranch;
}

/** The newest pull request for an issue: on a Claude branch for it, or one that closes it. */
function pullFor(issueNumber: number, pulls: GhPull[]): GhPull | undefined {
  const closes = new RegExp(`\\b(?:closes|fixes|resolves)\\s+#${issueNumber}\\b`, "i");
  return pulls.find((p) => p.head.ref.startsWith(`claude/issue-${issueNumber}-`) || closes.test(p.body ?? ""));
}

async function recentPulls(): Promise<GhPull[]> {
  return gh<GhPull[]>("/repos/{repo}/pulls?state=all&per_page=50&sort=created&direction=desc");
}

async function comments(number: number): Promise<GhComment[]> {
  return gh<GhComment[]>(`/repos/{repo}/issues/${number}/comments?per_page=100`);
}

function checkSummary(runs: GhCheckRun[]) {
  const failedNames: string[] = [];
  let passed = 0;
  let failed = 0;
  let pending = 0;
  for (const r of runs) {
    if (r.status !== "completed") pending++;
    else if (["success", "neutral", "skipped"].includes(r.conclusion ?? "")) passed++;
    else {
      failed++;
      failedNames.push(r.name);
    }
  }
  return { passed, failed, pending, failedNames };
}

/**
 * Works out where one request is, and moves it along: opens the pull
 * request once Claude has finished, and hands failing checks or a clash
 * back to Claude. Closed requests are read from the issue and pull request
 * alone (no extra requests).
 */
async function resolve(issue: GhIssue, pulls: GhPull[], opts: { act: boolean }): Promise<OsChange> {
  const { details, requestedBy, requesterId } = splitBody(issue.body);
  let pull = pullFor(issue.number, pulls);
  const change: OsChange = {
    number: issue.number,
    title: issue.title,
    details,
    requestedBy,
    requesterId,
    createdAt: issue.created_at,
    status: "working",
    issueUrl: issue.html_url,
    pr: null,
    checks: null,
    reply: null,
    mergedAt: null,
  };
  const withPull = (p: GhPull) => {
    change.pr = { number: p.number, url: p.html_url, branch: p.head.ref, sha: p.head.sha, additions: p.additions ?? null, deletions: p.deletions ?? null, changedFiles: p.changed_files ?? null };
    change.mergedAt = p.merged_at;
  };

  if (pull?.merged_at) {
    withPull(pull);
    change.status = "merged";
    return change;
  }
  if (issue.state === "closed" && (!pull || pull.state === "closed")) {
    if (pull) withPull(pull);
    change.status = "closed";
    return change;
  }

  // Open: read the conversation on the issue and, if there is one, the pull request.
  const [issueComments, pullComments] = await Promise.all([comments(issue.number), pull && pull.state === "open" ? comments(pull.number) : Promise.resolve([])]);
  const all = [...issueComments, ...pullComments].sort((a, b) => ms(a.created_at) - ms(b.created_at));
  const claudeNote = [...all].reverse().find((c) => isClaude(c.user));
  if (claudeNote) change.reply = cleanText(claudeNote.body).slice(0, 2000) || null;

  // The last time someone asked Claude for something, and the last time a run finished.
  let lastAsk = ms(issue.created_at);
  for (const c of all) if (!isBot(c.user) && /(^|\s)@claude\b/i.test(c.body)) lastAsk = Math.max(lastAsk, ms(c.created_at));
  const finishes = all.filter((c) => FINISHED_MARK.test(c.body));
  const lastFinish = finishes.at(-1);
  const finishedAfterAsk = lastFinish && ms(lastFinish.created_at) >= lastAsk;
  if (!finishedAfterAsk) {
    if (pull && pull.state === "open") withPull(pull);
    change.status = Date.now() - lastAsk > STALE_MS ? "failed" : "working";
    return change;
  }
  const [, conclusion, branch] = lastFinish!.body.match(FINISHED_MARK)!;

  if (!pull || pull.state !== "open") {
    if (conclusion !== "success") {
      change.status = "failed";
      return change;
    }
    if (issueComments.some((c) => c.body.includes(NO_CHANGES_MARK) && ms(c.created_at) >= ms(lastFinish!.created_at))) {
      change.status = "answered";
      return change;
    }
    if (!branch || !opts.act) {
      change.status = branch ? "checking" : "answered";
      return change;
    }
    pull = await openPull(issue, branch, requestedBy, change.reply);
    if (!pull) {
      change.status = "answered";
      return change;
    }
  }

  // An open pull request: its checks and whether it still merges cleanly.
  const [detail, runs] = await Promise.all([
    gh<GhPull>(`/repos/{repo}/pulls/${pull.number}`),
    gh<{ check_runs: GhCheckRun[] }>(`/repos/{repo}/commits/${pull.head.sha}/check-runs?per_page=100`),
  ]);
  withPull(detail);
  const checks = checkSummary(runs.check_runs);
  change.checks = checks;
  if (checks.pending > 0 || (runs.check_runs.length === 0 && Date.now() - ms(detail.created_at) < CHECKS_GRACE_MS)) change.status = "checking";
  else if (checks.failed > 0) change.status = "checks_failed";
  else if (detail.mergeable === false) change.status = "conflict";
  else if (detail.mergeable == null) change.status = "checking"; // GitHub is still working it out
  else change.status = "ready";

  if (opts.act && (change.status === "checks_failed" || change.status === "conflict")) {
    const autos = all.filter((c) => AUTO_MARK.test(c.body));
    const already = autos.some((c) => c.body.match(AUTO_MARK)![2] === detail.head.sha);
    if (!already && autos.length < MAX_AUTO_FIXES) {
      const base = detail.base.ref;
      const ask =
        change.status === "checks_failed"
          ? `@claude The checks failed on this pull request: ${checks.failedNames.join(", ")}. Read their logs, fix the cause on this branch and push.`
          : `@claude This branch no longer merges cleanly into \`${base}\`. Merge \`${base}\` into it, resolve the conflicts keeping both sides' intent, check it still builds, and push.`;
      await gh(`/repos/{repo}/issues/${detail.number}/comments`, { method: "POST", body: { body: `${ask}\n\n<!-- haman:auto=${change.status} sha=${detail.head.sha} -->` } });
      change.status = "working";
    }
  }
  return change;
}

/** Opens the pull request for Claude's branch. Undefined when the branch has nothing new (Claude only replied). */
async function openPull(issue: GhIssue, branch: string, requestedBy: string | null, note: string | null): Promise<GhPull | undefined> {
  try {
    return await gh<GhPull>("/repos/{repo}/pulls", {
      method: "POST",
      body: {
        title: issue.title,
        head: branch,
        base: await baseBranch(),
        body: `Closes #${issue.number}\n\nBuilt by Claude Code from a request in NEWMUX OS${requestedBy ? ` by ${requestedBy}` : ""}. A partner merges it from Settings → OS Updates, and merging puts it live.${note ? `\n\n### Claude Code's note\n\n${note}` : ""}`,
      },
    });
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 422) throw error;
    if (/already exists/i.test(error.message)) {
      const existing = await gh<GhPull[]>(`/repos/{repo}/pulls?state=open&head=${encodeURIComponent(`${githubRepo().split("/")[0]}:${branch}`)}`);
      return existing[0];
    }
    // "No commits between …": Claude answered without changing anything.
    await gh(`/repos/{repo}/issues/${issue.number}/comments`, { method: "POST", body: { body: `Claude finished without changing any code, so there's nothing to merge. ${NO_CHANGES_MARK}` } });
    return undefined;
  }
}

export async function listOsChanges(limit = 20): Promise<OsChange[]> {
  const [issues, pulls] = await Promise.all([
    gh<GhIssue[]>(`/repos/{repo}/issues?labels=${OS_CHANGE_LABEL}&state=all&per_page=${limit}&sort=created&direction=desc`),
    recentPulls(),
  ]);
  return Promise.all(issues.filter((i) => !i.pull_request).map((i) => resolve(i, pulls, { act: true })));
}

export async function getOsChange(number: number): Promise<OsChange> {
  const [issue, pulls] = await Promise.all([getIssue(number), recentPulls()]);
  return resolve(issue, pulls, { act: true });
}

async function getIssue(number: number): Promise<GhIssue> {
  try {
    const issue = await gh<GhIssue & { labels: { name: string }[] }>(`/repos/{repo}/issues/${number}`);
    if (issue.pull_request || !issue.labels.some((l) => l.name === OS_CHANGE_LABEL)) throw new ValidationError("That isn't an OS update request.");
    return issue;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) throw new ValidationError("There's no OS update request with that number.");
    throw error;
  }
}

// --- Changing ---

type Who = { id: string; name: string; role: UserRole };

export async function requestOsChange(input: { title: string; details: string }, who: Who): Promise<OsChange> {
  const body = `${input.details.trim()}${BYLINE}**${who.name}** (${ROLE_LABEL[who.role]}) in NEWMUX OS. <!-- newmux:user=${who.id} -->`;
  const issue = await gh<GhIssue>("/repos/{repo}/issues", { method: "POST", body: { title: input.title.trim(), body, labels: [OS_CHANGE_LABEL] } });
  return { ...(await resolve(issue, [], { act: false })), status: "working" };
}

/** Asks Claude for more changes: on the pull request when there is one, else on the issue (a fresh attempt). */
export async function reviseOsChange(number: number, text: string, who: Who): Promise<OsChange> {
  const change = await getOsChange(number);
  if (change.status === "merged" || change.status === "closed") throw new ValidationError("That request is finished. Make a new request instead.");
  if (change.status === "working") throw new ValidationError("Claude is still working on it. Wait until it's done, then ask for changes.");
  const target = change.pr?.number ?? number;
  await gh(`/repos/{repo}/issues/${target}/comments`, { method: "POST", body: { body: `@claude ${text.trim()}${signature(who)}` } });
  return { ...change, status: "working" };
}

/** Merges a request's pull request (partners only, checked by the route). Only when it's ready. */
export async function mergeOsChange(number: number, who: Who): Promise<OsChange> {
  const change = await getOsChange(number);
  if (change.status !== "ready" || !change.pr) {
    throw new ValidationError(change.status === "merged" ? "That's already merged." : `It can't be merged yet: ${OS_CHANGE_STATUS[change.status].label.toLowerCase()}.`);
  }
  const pull = await gh<GhPull>(`/repos/{repo}/pulls/${change.pr.number}`);
  const commit = { commit_title: `${change.title} (#${change.pr.number})`, commit_message: `Closes #${number}\n\nRequested in NEWMUX OS${change.requestedBy ? ` by ${change.requestedBy}` : ""}; merged by ${who.name}.`, sha: pull.head.sha };
  try {
    await gh(`/repos/{repo}/pulls/${change.pr.number}/merge`, { method: "PUT", body: { ...commit, merge_method: "squash" } });
  } catch (error) {
    // The repository may not allow squash merges.
    if (!(error instanceof GitHubError) || error.status !== 405 || !/squash/i.test(error.message)) throw mergeError(error);
    await gh(`/repos/{repo}/pulls/${change.pr.number}/merge`, { method: "PUT", body: { ...commit, merge_method: "merge" } }).catch((e) => {
      throw mergeError(e);
    });
  }
  if (change.requesterId) await once([change.requesterId], `os-merged:${number}`, { title: "Your OS update is going live", body: `${change.title} — merged by ${who.name}. It's live once the deploy finishes, in a few minutes.`, url: "/settings/updates" });
  return { ...change, status: "merged", mergedAt: new Date().toISOString() };
}

function mergeError(error: unknown) {
  if (error instanceof GitHubError && (error.status === 405 || error.status === 409)) return new ValidationError(`GitHub wouldn't merge it: ${error.message}`);
  return error;
}

/** Withdraws a request: closes the issue and its pull request, if open. */
export async function closeOsChange(number: number): Promise<void> {
  const change = await getOsChange(number);
  if (change.status === "merged") throw new ValidationError("That's already merged. To undo it, ask for a change that reverses it.");
  if (change.pr && change.status !== "closed") await gh(`/repos/{repo}/pulls/${change.pr.number}`, { method: "PATCH", body: { state: "closed" } });
  await gh(`/repos/{repo}/issues/${number}`, { method: "PATCH", body: { state: "closed", state_reason: "not_planned" } });
}

// --- In the background ---

/**
 * Run by the notifications cron: moves open requests along (opens pull
 * requests, sends failing checks back) and tells people: partners and the
 * requester when one is ready to merge, the requester when Claude couldn't
 * finish. Does nothing until GitHub is connected.
 */
export async function syncOsChanges(): Promise<{ open: number; notified: number }> {
  if (!githubConfigured()) return { open: 0, notified: 0 };
  const changes = (await listOsChanges(15)).filter((c) => c.status !== "merged" && c.status !== "closed");
  const partners = (await many<{ id: string }>("select id from users where is_active and role = 'partner_admin'")).map((u) => u.id);
  let notified = 0;
  for (const c of changes) {
    const mine = c.requesterId ? [c.requesterId] : [];
    if (c.status === "ready") notified += await once([...partners, ...mine], `os-ready:${c.number}:${c.pr?.sha}`, { title: "OS update ready to merge", body: c.title, url: "/settings/updates" });
    else if (c.status === "failed" || c.status === "answered") notified += await once(mine, `os-${c.status}:${c.number}:${c.reply?.length ?? 0}`, { title: c.status === "failed" ? "Claude couldn't finish an OS update" : "Claude replied to your OS update", body: c.title, url: "/settings/updates" });
  }
  return { open: changes.length, notified };
}
