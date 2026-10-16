/**
 * Checks for OS updates (lib/osChanges.ts) against a fake GitHub: a request
 * becomes a labelled issue, Claude's "finished" note becomes a pull request
 * into the default branch, checks and clashes decide when it's ready (and go
 * back to Claude, twice at most), partners are told once, merging needs every
 * check to pass, and Haman offers merging to partners only. No network.
 *
 *   npm run test:os-changes
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "newmux-os-changes-"));
delete process.env.DATABASE_URL;
delete process.env.GITHUB_BRANCH;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
process.env.GITHUB_REPO = "NewMux/NewMux_OS";

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
}
const section = (title: string) => console.log(`\n${title}`);

// --- A fake GitHub ---

type User = { login: string; type: string };
type Comment = { id: number; body: string; created_at: string; user: User };
type Issue = { number: number; title: string; body: string; state: "open" | "closed"; state_reason?: string; created_at: string; html_url: string; user: User; labels: { name: string }[] };
type Pull = {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  html_url: string;
  created_at: string;
  merged_at: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
};

const ME: User = { login: "jassim", type: "User" };
const CLAUDE: User = { login: "claude[bot]", type: "Bot" };
const ACTIONS: User = { login: "github-actions[bot]", type: "Bot" };

let clock = Date.now() - 60_000;
const tick = () => new Date((clock += 1000)).toISOString();

const gh = {
  next: 1,
  issues: new Map<number, Issue>(),
  comments: new Map<number, Comment[]>(),
  pulls: [] as Pull[],
  branches: new Map<string, string>(), // branch → head sha ("" = no commits)
  checks: new Map<string, { name: string; status: string; conclusion: string | null }[]>(),
  merges: [] as { pull: number; method: string; sha: string }[],
  log: [] as string[],
  squashAllowed: true,
};

function comment(number: number, body: string, user: User) {
  const list = gh.comments.get(number) ?? [];
  list.push({ id: list.length + 1, body, created_at: tick(), user });
  gh.comments.set(number, list);
}

/** What the workflow's last step writes. */
const finished = (number: number, conclusion = "success", branch?: string) =>
  comment(number, `Claude Code has finished. <!-- haman:finished conclusion=${conclusion}${branch ? ` branch=${branch}` : ""} -->`, ACTIONS);

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  gh.log.push(`${method} ${url.pathname}${url.search}`);
  if (!(init?.headers as Record<string, string>)?.Authorization?.startsWith("Bearer ")) return json(401, { message: "Bad credentials" });
  const p = url.pathname.replace("/repos/NewMux/NewMux_OS", "");
  let m: RegExpMatchArray | null;

  if (p === "" && method === "GET") return json(200, { default_branch: "live" });

  if (p === "/issues" && method === "GET") {
    const label = url.searchParams.get("labels");
    return json(200, [...gh.issues.values()].filter((i) => !label || i.labels.some((l) => l.name === label)).reverse());
  }
  if (p === "/issues" && method === "POST") {
    const issue: Issue = { number: gh.next++, title: body.title, body: body.body, state: "open", created_at: tick(), html_url: "", user: ME, labels: (body.labels ?? []).map((name: string) => ({ name })) };
    issue.html_url = `https://github.com/NewMux/NewMux_OS/issues/${issue.number}`;
    gh.issues.set(issue.number, issue);
    return json(201, issue);
  }
  if ((m = p.match(/^\/issues\/(\d+)$/))) {
    const n = Number(m[1]);
    const issue = gh.issues.get(n);
    const pull = gh.pulls.find((x) => x.number === n);
    if (!issue && !pull) return json(404, { message: "Not Found" });
    if (method === "PATCH") Object.assign(issue!, body);
    return json(200, issue ?? { ...pull, labels: [], pull_request: {} });
  }
  if ((m = p.match(/^\/issues\/(\d+)\/comments$/))) {
    const n = Number(m[1]);
    if (method === "POST") {
      comment(n, body.body, ME);
      return json(201, {});
    }
    return json(200, gh.comments.get(n) ?? []);
  }

  if (p === "/pulls" && method === "GET") {
    const head = url.searchParams.get("head");
    const state = url.searchParams.get("state");
    return json(200, [...gh.pulls].reverse().filter((x) => (!head || `NewMux:${x.head.ref}` === head) && (state === "all" || x.state === state)));
  }
  if (p === "/pulls" && method === "POST") {
    const sha = gh.branches.get(body.head);
    if (sha === undefined) return json(422, { message: "Validation Failed", errors: [{ message: `No branch ${body.head}` }] });
    if (sha === "") return json(422, { message: "Validation Failed", errors: [{ message: `No commits between ${body.base} and ${body.head}` }] });
    if (gh.pulls.some((x) => x.head.ref === body.head && x.state === "open")) return json(422, { message: "Validation Failed", errors: [{ message: `A pull request already exists for NewMux:${body.head}.` }] });
    const pull: Pull = { number: gh.next++, title: body.title, body: body.body, state: "open", html_url: "", created_at: tick(), merged_at: null, head: { ref: body.head, sha }, base: { ref: body.base }, mergeable: true, additions: 40, deletions: 3, changed_files: 2 };
    pull.html_url = `https://github.com/NewMux/NewMux_OS/pull/${pull.number}`;
    gh.pulls.push(pull);
    return json(201, pull);
  }
  if ((m = p.match(/^\/pulls\/(\d+)$/))) {
    const pull = gh.pulls.find((x) => x.number === Number(m![1]));
    if (!pull) return json(404, { message: "Not Found" });
    if (method === "PATCH") Object.assign(pull, body);
    return json(200, pull);
  }
  if ((m = p.match(/^\/pulls\/(\d+)\/merge$/)) && method === "PUT") {
    const pull = gh.pulls.find((x) => x.number === Number(m![1]))!;
    if (body.merge_method === "squash" && !gh.squashAllowed) return json(405, { message: "Squash merges are not allowed on this repository." });
    if (body.sha !== pull.head.sha) return json(409, { message: "Head branch was modified. Review and try the merge again." });
    gh.merges.push({ pull: pull.number, method: body.merge_method, sha: body.sha });
    pull.merged_at = tick();
    pull.state = "closed";
    const closes = pull.body.match(/Closes #(\d+)/);
    if (closes) gh.issues.get(Number(closes[1]))!.state = "closed";
    return json(200, { merged: true });
  }
  if ((m = p.match(/^\/commits\/(\w+)\/check-runs$/))) return json(200, { check_runs: gh.checks.get(m[1]!) ?? [] });

  return json(404, { message: `Fake GitHub has no ${method} ${p}` });
}) as typeof fetch;

/** Claude pushes a commit to a branch: new head sha, on the PR too. */
function push(branch: string, sha: string) {
  gh.branches.set(branch, sha);
  const pull = gh.pulls.find((x) => x.head.ref === branch && x.state === "open");
  if (pull) pull.head.sha = sha;
}
const passing = (sha: string) => gh.checks.set(sha, [{ name: "checks", status: "completed", conclusion: "success" }, { name: "Workers Builds", status: "completed", conclusion: "success" }]);
const failing = (sha: string) => gh.checks.set(sha, [{ name: "checks", status: "completed", conclusion: "failure" }]);

async function main() {
  const { githubConfigured } = await import("../lib/github");
  const osc = await import("../lib/osChanges");
  const { many } = await import("../lib/data/sql");
  const { proposeAction, actionToolsFor } = await import("../lib/haman/actions");
  const { toolsFor, runTool } = await import("../lib/haman/tools");

  const { createUser } = await import("../lib/data/users");
  await createUser({ email: "dev@newmux.test", fullName: "Dana Dev", role: "lead_dev", passwordHash: "x" });
  await createUser({ email: "mk@newmux.test", fullName: "Mona Marketing", role: "marketing", passwordHash: "x" });
  const users = await many<{ id: string; fullName: string; role: "partner_admin" | "marketing" | "lead_dev" }>("select id, full_name, role from users where is_active order by full_name");
  const partner = users.find((u) => u.role === "partner_admin")!;
  const dev = users.find((u) => u.role === "lead_dev")!;
  const devWho = { id: dev.id, name: dev.fullName, role: dev.role };
  const partnerWho = { id: partner.id, name: partner.fullName, role: partner.role };
  const sentTo = async (key: string) => (await many<{ userId: string }>("select user_id from notification_log where key = $1", [key])).map((r) => r.userId);

  section("Without a token");
  delete process.env.GITHUB_TOKEN;
  check("Not configured", !githubConfigured());
  check("Sync does nothing", (await osc.syncOsChanges()).open === 0 && gh.log.length === 0);
  const offline = await runTool("list_os_changes", {}, { userId: dev.id, userName: dev.fullName, role: dev.role });
  check("Haman says GitHub isn't connected", offline.content.includes("GitHub isn't connected"), offline.content);
  process.env.GITHUB_TOKEN = "github_pat_test";

  section("Asking for a change");
  const asked = await osc.requestOsChange({ title: "Add a VAT report", details: "Finance should show VAT collected per quarter." }, devWho);
  const issue = gh.issues.get(asked.number)!;
  check("Files an issue labelled haman", issue.labels.some((l) => l.name === "haman"));
  check("The issue names who asked and carries their id", issue.body.includes(`**${dev.fullName}** (Team member)`) && issue.body.includes(`newmux:user=${dev.id}`));
  check("Reads back as working, with the details and requester", asked.status === "working" && asked.details === "Finance should show VAT collected per quarter." && asked.requesterId === dev.id && asked.requestedBy === dev.fullName);
  check("Still working while Claude hasn't finished", (await osc.getOsChange(asked.number)).status === "working");
  comment(asked.number, "@claude what about this?", CLAUDE);
  check("A bot mentioning @claude isn't a new ask", (await osc.getOsChange(asked.number)).status === "working");

  section("Claude finishes: the pull request");
  const branch = `claude/issue-${asked.number}-20261016-1200`;
  push(branch, "aaa111");
  comment(asked.number, "**Claude finished** — added the report.\n\n**Database change:** none.", CLAUDE);
  finished(asked.number, "success", branch);
  let c = await osc.getOsChange(asked.number);
  const pull = gh.pulls.find((x) => x.head.ref === branch)!;
  check("Opens a pull request for Claude's branch", !!pull && c.pr?.number === pull.number);
  check("Into the repository's default branch", pull.base.ref === "live");
  check("That closes the issue and carries Claude's note", pull.body.startsWith(`Closes #${asked.number}`) && pull.body.includes("Database change:"));
  check("Waits for checks to appear", c.status === "checking", c.status);
  check("Shows Claude's note", !!c.reply?.includes("added the report"));
  await osc.getOsChange(asked.number);
  check("Opens it only once", gh.pulls.filter((x) => x.head.ref === branch).length === 1);

  gh.checks.set("aaa111", [{ name: "checks", status: "in_progress", conclusion: null }]);
  check("Running checks", (await osc.getOsChange(asked.number)).status === "checking");
  await assertRejects("Merging is refused while checks run", () => osc.mergeOsChange(asked.number, partnerWho), "can't be merged yet");
  passing("aaa111");
  pull.mergeable = null;
  check("Waits while GitHub works out mergeability", (await osc.getOsChange(asked.number)).status === "checking");
  pull.mergeable = true;
  c = await osc.getOsChange(asked.number);
  check("Ready once every check passes", c.status === "ready" && c.checks?.passed === 2 && c.pr?.changedFiles === 2);

  section("Telling people");
  let synced = await osc.syncOsChanges();
  const readyKey = `os-ready:${asked.number}:aaa111`;
  const told = await sentTo(readyKey);
  check("The sync sees the open request", synced.open >= 1);
  check("Partners and the requester are told it's ready", told.includes(partner.id) && told.includes(dev.id));
  check("Marketing isn't (unless they asked)", !told.some((id) => users.find((u) => u.id === id)?.role === "marketing"));
  synced = await osc.syncOsChanges();
  check("Only once", (await sentTo(readyKey)).length === told.length);

  section("Merging");
  await osc.mergeOsChange(asked.number, partnerWho);
  check("Squash-merges the head that passed", gh.merges.at(-1)?.method === "squash" && gh.merges.at(-1)?.sha === "aaa111");
  c = await osc.getOsChange(asked.number);
  check("Reads back as merged", c.status === "merged" && !!c.mergedAt);
  check("The requester is told it's going live", (await sentTo(`os-merged:${asked.number}`)).includes(dev.id));
  await assertRejects("Can't merge twice", () => osc.mergeOsChange(asked.number, partnerWho), "already merged");
  await assertRejects("Can't ask for changes to a merged one", () => osc.reviseOsChange(asked.number, "one more thing", devWho), "finished");

  section("Failed runs, revisions and replies");
  const second = await osc.requestOsChange({ title: "Rename Today", details: "Call the Today tab Home instead." }, devWho);
  finished(second.number, "failure");
  check("A failed run reads as failed", (await osc.getOsChange(second.number)).status === "failed");
  await osc.reviseOsChange(second.number, "Try again, only the tab label.", devWho);
  const ask = gh.comments.get(second.number)!.at(-1)!;
  check("Asking again is an @claude comment on the issue, signed", ask.body.startsWith("@claude Try again") && ask.body.includes(`newmux:user=${dev.id}`));
  check("And it's working again", (await osc.getOsChange(second.number)).status === "working");
  await assertRejects("Can't pile on while it works", () => osc.reviseOsChange(second.number, "and the icon", devWho), "still working");
  const branch2 = `claude/issue-${second.number}-20261016-1300`;
  push(branch2, "");
  finished(second.number, "success", branch2);
  c = await osc.getOsChange(second.number);
  check("A branch with nothing new reads as a reply", c.status === "answered", c.status);
  check("No pull request is opened", !gh.pulls.some((x) => x.head.ref === branch2));
  const notes = () => gh.comments.get(second.number)!.filter((x) => x.body.includes("haman:no-changes")).length;
  await osc.getOsChange(second.number);
  check("Says so on GitHub once", notes() === 1);

  section("Checks failing and clashes go back to Claude");
  const third = await osc.requestOsChange({ title: "Bigger avatars", details: "Make avatars in Team bigger." }, devWho);
  const branch3 = `claude/issue-${third.number}-20261016-1400`;
  push(branch3, "bbb001");
  finished(third.number, "success", branch3);
  await osc.getOsChange(third.number);
  const pull3 = gh.pulls.find((x) => x.head.ref === branch3)!;
  failing("bbb001");
  c = await osc.getOsChange(third.number);
  const autos = () => (gh.comments.get(pull3.number) ?? []).filter((x) => x.body.includes("haman:auto="));
  check("Failing checks are sent back to Claude on the pull request", autos().length === 1 && autos()[0]!.body.startsWith("@claude The checks failed") && autos()[0]!.body.includes("checks"));
  check("And it reads as working", c.status === "working");
  finished(pull3.number, "success");
  c = await osc.getOsChange(third.number);
  check("Same head still failing after the run: not sent again", autos().length === 1 && c.status === "checks_failed", c.status);
  push(branch3, "bbb002");
  failing("bbb002");
  await osc.getOsChange(third.number);
  check("A new head failing goes back once more", autos().length === 2);
  finished(pull3.number, "success");
  push(branch3, "bbb003");
  passing("bbb003");
  pull3.mergeable = false;
  c = await osc.getOsChange(third.number);
  check("A clash reads as a conflict once the auto-fixes are used up", c.status === "conflict" && autos().length === 2, c.status);
  check("Merging a clash is refused", await rejects(() => osc.mergeOsChange(third.number, partnerWho)));

  section("Clashes, merge methods and withdrawing");
  const fourth = await osc.requestOsChange({ title: "Dark mode tweak", details: "Darker cards in dark mode." }, partnerWho);
  const branch4 = `claude/issue-${fourth.number}-20261016-1500`;
  push(branch4, "ccc001");
  finished(fourth.number, "success", branch4);
  await osc.getOsChange(fourth.number);
  const pull4 = gh.pulls.find((x) => x.head.ref === branch4)!;
  passing("ccc001");
  pull4.mergeable = false;
  await osc.getOsChange(fourth.number);
  const conflictAsk = (gh.comments.get(pull4.number) ?? []).find((x) => x.body.includes("haman:auto=conflict"));
  check("A clash asks Claude to merge the base branch in", !!conflictAsk && conflictAsk.body.includes("`live`"));
  finished(pull4.number, "success");
  pull4.mergeable = true;
  gh.squashAllowed = false;
  c = await osc.getOsChange(fourth.number);
  check("Ready again after the fix", c.status === "ready", c.status);
  await osc.mergeOsChange(fourth.number, partnerWho);
  check("Falls back to a merge commit when squash isn't allowed", gh.merges.at(-1)?.method === "merge" && gh.merges.at(-1)?.pull === pull4.number);

  await osc.closeOsChange(third.number);
  c = await osc.getOsChange(third.number);
  check("Withdrawing closes the pull request and the issue", c.status === "closed" && pull3.state === "closed" && gh.issues.get(third.number)!.state === "closed");

  section("A run that never reports back");
  const fifth = await osc.requestOsChange({ title: "Old one", details: "Something from long ago." }, devWho);
  gh.issues.get(fifth.number)!.created_at = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  check("Reads as failed after 90 minutes", (await osc.getOsChange(fifth.number)).status === "failed");
  await assertRejects("A number that isn't a request is refused", () => osc.getOsChange(pull4.number), "isn't an OS update");
  await assertRejects("An unknown number is refused", () => osc.getOsChange(999), "no OS update");

  section("The list");
  const list = await osc.listOsChanges();
  check("Lists every request, newest first, without pull requests", list.map((x) => x.number).join() === [fifth, fourth, third, second, asked].map((x) => x.number).join(), list.map((x) => x.number).join());
  check("Merged and closed ones aren't read in detail", !gh.log.slice(-12).some((l) => l.includes(`/issues/${asked.number}/comments`)));

  section("Haman");
  const ctx = (u: typeof dev) => ({ userId: u.id, userName: u.fullName, role: u.role });
  check("Everyone can look them up", toolsFor("lead_dev").some((t) => t.name === "list_os_changes") && toolsFor("marketing").some((t) => t.name === "list_os_changes"));
  const looked = JSON.parse((await runTool("list_os_changes", {}, ctx(dev))).content);
  check("The lookup gives numbers, statuses and the screen", looked.href === "/settings/updates" && looked.changes.some((x: { number: number; status: string }) => x.number === asked.number && x.status === "merged"));
  const names = (role: "partner_admin" | "marketing" | "lead_dev") => actionToolsFor(role).map((t) => t.name);
  check("Everyone can request, revise and withdraw", ["lead_dev", "marketing", "partner_admin"].every((r) => ["request_os_change", "revise_os_change", "close_os_change"].every((n) => names(r as "lead_dev").includes(n))));
  check("Only partners are offered merging", names("partner_admin").includes("merge_os_change") && !names("marketing").includes("merge_os_change") && !names("lead_dev").includes("merge_os_change"));
  const mergeTool = actionToolsFor("partner_admin").find((t) => t.name === "merge_os_change")!;
  check("Merging takes the request's number", mergeTool.input_schema.required.includes("number"));
  const card = await proposeAction("request_os_change", { target: "NEWMUX OS", title: "Add a VAT report", details: "Show VAT per quarter in Finance." }, "lead_dev");
  check("A request card posts to /api/os-changes", card.request.method === "POST" && card.request.path === "/api/os-changes" && card.fields.some((f) => f.label === "Next"));
  const mergeCard = await proposeAction("merge_os_change", { target: "#7 Add a VAT report", number: "7" }, "partner_admin");
  check("A merge card posts to the request's merge route and says it goes live", mergeCard.request.path === "/api/os-changes/7/merge" && mergeCard.fields.some((f) => f.label === "Goes live"));
  check("A merge card needs a real number", await rejects(() => proposeAction("merge_os_change", { target: "x", number: "../../users" }, "partner_admin")));
  check("A team member can't propose a merge", await rejects(() => proposeAction("merge_os_change", { target: "x", number: 7 }, "lead_dev")));
  check("A request needs details", await rejects(() => proposeAction("request_os_change", { target: "x", title: "Hi", details: "" }, "lead_dev")));
  const revise = await proposeAction("revise_os_change", { target: "#7", number: 7, text: "Make the chart a bar chart." }, "marketing");
  check("A revision posts a comment for that request", revise.request.path === "/api/os-changes/7/comments" && revise.request.body?.text === "Make the chart a bar chart.");

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function assertRejects(name: string, fn: () => Promise<unknown>, includes: string) {
  try {
    await fn();
    check(name, false, "didn't throw");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(name, message.includes(includes), message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
