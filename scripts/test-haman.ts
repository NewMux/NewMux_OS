/**
 * Checks for Haman (lib/haman): every lookup runs against the demo data as a
 * partner and as a team member, the conversation loop is driven with a
 * stand-in for the Claude API (no key or network needed), and the reply
 * formatting is checked for unsafe links.
 *
 *   npm run test:haman
 *
 * Uses a throwaway embedded database with the demo seed. Set
 * TEST_DATABASE_URL to run against a Postgres that already holds it.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "newmux-haman-"));
  delete process.env.DATABASE_URL;
}

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
}
const section = (title: string) => console.log(`\n${title}`);

type Call = { url: string; headers: Record<string, string>; body: { model: string; system: { text: string; cache_control?: unknown }[]; tools: { name: string; cache_control?: unknown }[]; tool_choice?: { type: string }; messages: { role: string; content: unknown }[] } };

/** Replaces fetch with a scripted Claude API and records what was sent. */
function mockClaude(script: (call: Call, n: number) => { status?: number; json: unknown }): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const call: Call = { url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) };
    calls.push(call);
    const { status = 200, json } = script(call, calls.length);
    return new Response(JSON.stringify(json), { status });
  }) as typeof fetch;
  return calls;
}
const toolUse = (id: string, name: string, input: unknown = {}) => ({ type: "tool_use", id, name, input });
const says = (text: string) => ({ json: { stop_reason: "end_turn", content: [{ type: "text", text }] } });
const asks = (...blocks: unknown[]) => ({ json: { stop_reason: "tool_use", content: blocks } });

async function main() {
  const { query } = await import("../lib/db");
  const { HAMAN_TOOLS, runTool, toolsFor } = await import("../lib/haman/tools");
  const { askHaman, hamanConfigured, HamanError } = await import("../lib/haman/agent");
  const { toBlocks, toSpans } = await import("../lib/haman/markdown");
  type Ctx = Parameters<typeof runTool>[2];
  type Event = Parameters<Parameters<typeof askHaman>[2]>[0];

  const [user] = await query<{ id: string; fullName: string }>(`select id, full_name as "fullName" from users order by created_at limit 1`);
  const [client] = await query<{ id: string; name: string }>("select id, name from clients order by name limit 1");
  const [project] = await query<{ id: string }>("select id from projects order by name limit 1");
  const [page] = await query<{ id: string; title: string }>("select id, title from kb_pages where not is_template order by title limit 1");
  const partner: Ctx = { userId: user!.id, userName: user!.fullName, role: "partner_admin" };
  const member: Ctx = { userId: user!.id, userName: "Team Member", role: "lead_dev" };

  section("Lookups — each one runs, as a partner and as a team member");
  const inputs: Record<string, unknown> = {
    search_os: { query: client!.name.slice(0, 5) },
    list_tasks: { scope: "everyone" },
    get_project: { project_id: project!.id },
    upcoming_meetings: { days: 60 },
    search_wiki: { query: page!.title.split(" ")[0] },
    read_wiki_page: { page_id: page!.id },
    list_documents: { unpaid_only: true },
    cash_flow: { months_back: 3 },
    list_expenses: { from: "2026-01-01" },
    get_client: { client_id: client!.id },
  };
  check("Partners get every lookup; team members only the delivery ones", toolsFor("partner_admin").length === HAMAN_TOOLS.length && toolsFor("lead_dev").every((t) => t.access === "everyone"));
  for (const tool of HAMAN_TOOLS) {
    const result = await runTool(tool.name, inputs[tool.name] ?? {}, partner);
    const problems = [
      result.isError && "returned an error",
      /"\w*[Cc]ents"\s*:/.test(result.content) && "hands the model raw minor units",
      /NaN|undefined|Invalid Date/.test(result.content) && "contains NaN, undefined or Invalid Date",
    ].filter(Boolean);
    check(`${tool.name}`, problems.length === 0, `${problems.join("; ")}: ${result.content.slice(0, 200)}`);
    const asMember = await runTool(tool.name, inputs[tool.name] ?? {}, member);
    if (tool.access === "partner") check(`${tool.name} is refused for a team member`, asMember.isError && !/BHD|\$/.test(asMember.content));
    else check(`${tool.name} works for a team member`, !asMember.isError);
  }

  section("Lookups — role filtering and bad input");
  const memberSearch = await runTool("search_os", { query: client!.name.slice(0, 5) }, member);
  check("A team member's search returns no clients, contacts, deals or documents", !/"kind":"(client|contact|deal|document)"/.test(memberSearch.content));
  const memberAttention = await runTool("needs_attention", {}, member);
  check("A team member's Needs Attention has no hosting fees, files or follow-ups", !/"kind":"(hosting|follow_up|file)"/.test(memberAttention.content));
  const byName = await runTool("get_client", { client_id: client!.name }, partner);
  check("A name where an id belongs is explained, not run", byName.isError && /search_os/.test(byName.content));
  check("A lookup that doesn't exist is refused", (await runTool("reveal_secret", {}, partner)).isError);
  check("No lookup touches the Vault", !HAMAN_TOOLS.some((t) => /vault|secret|password|credential/i.test(t.name)));
  const missing = await runTool("get_project", { project_id: "00000000-0000-4000-8000-00000000ffff" }, partner);
  check("A missing record is reported", /No project has that id/.test(missing.content));

  section("Conversation loop — against a stand-in for the Claude API");
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.HAMAN_MODEL;
  check("Not set up without ANTHROPIC_API_KEY", !hamanConfigured());
  process.env.ANTHROPIC_API_KEY = "test-key";
  check("Set up with it", hamanConfigured());

  let calls = mockClaude((_call, n) => (n === 1 ? asks({ type: "text", text: "Checking." }, toolUse("t1", "finance_overview"), toolUse("t2", "list_documents", { unpaid_only: true })) : says("Clients owe **BHD 1.000**.")));
  const events: Event[] = [];
  const reply = await askHaman([{ role: "user", content: "Who owes us money?" }], partner, (e) => events.push(e));
  const first = calls[0]!.body;
  check("Returns the model's final text", reply === "Clients owe **BHD 1.000**.");
  check("Calls the Messages API with the key and version headers", calls[0]!.url === "https://api.anthropic.com/v1/messages" && calls[0]!.headers["x-api-key"] === "test-key" && calls[0]!.headers["anthropic-version"] === "2023-06-01");
  check("Uses the default model and offers a partner every lookup", first.model === "claude-sonnet-5-5" && first.tools.length === HAMAN_TOOLS.length);
  check("Caches the lookups and persona, not the dated line", !!first.tools.at(-1)!.cache_control && !!first.system[0]!.cache_control && !first.system[1]!.cache_control);
  check("Tells the model who is asking, their role and the date", first.system[1]!.text.includes(`${partner.userName}, a partner`) && /Bahrain time/.test(first.system[1]!.text));
  const followUp = calls[1]!.body.messages;
  const results = followUp[2]!.content as { tool_use_id: string; content: string }[];
  check("Sends both results back in one turn, matched to their calls", followUp.length === 3 && results.length === 2 && results[0]!.tool_use_id === "t1" && /owedByClients/.test(results[0]!.content) && results[1]!.tool_use_id === "t2" && /totalOutstanding/.test(results[1]!.content));
  check("Emits one readable status line", events.length === 1 && events[0]!.type === "status" && events[0]!.text === "Checking the finances · Checking invoices and documents");

  calls = mockClaude((_call, n) => (n === 1 ? asks(toolUse("x", "finance_overview")) : says("That part isn't open to your account.")));
  await askHaman([{ role: "user", content: "What's the bank balance?" }], member, () => {});
  check("A team member is offered no finance or CRM lookups", !calls[0]!.body.tools.some((t) => ["finance_overview", "get_client", "pipeline", "list_documents"].includes(t.name)) && /a team member/.test(calls[0]!.body.system[1]!.text));
  const refused = (calls[1]!.body.messages[2]!.content as { is_error?: boolean; content: string }[])[0]!;
  check("A partner lookup named for a team member returns an error and no data", refused.is_error === true && !/BHD/.test(refused.content));

  calls = mockClaude((call) => (call.body.tool_choice?.type === "none" ? says("Here's what I have.") : asks(toolUse("l", "list_projects"))));
  const looped = await askHaman([{ role: "user", content: "Keep looking" }], partner, () => {});
  check("Stops after six rounds: the last one may not call lookups", calls.length === 6 && calls[5]!.body.tool_choice?.type === "none" && looped === "Here's what I have.");

  const realError = console.error;
  console.error = () => {};
  process.env.HAMAN_MODEL = "claude-haiku-4-5-20251001";
  calls = mockClaude(() => ({ status: 401, json: { error: { message: "invalid x-api-key sk-ant-secret" } } }));
  const failure = await askHaman([{ role: "user", content: "hi" }], partner, () => {}).catch((e: unknown) => e);
  check("HAMAN_MODEL picks the model", calls[0]!.body.model === "claude-haiku-4-5-20251001");
  check("A rejected key gives a safe message that doesn't repeat the API's text", failure instanceof HamanError && /API key was rejected/.test(failure.message) && !/sk-ant/.test(failure.message));
  mockClaude(() => ({ status: 529, json: {} }));
  const busy = await askHaman([{ role: "user", content: "hi" }], partner, () => {}).catch((e: unknown) => e);
  check("An overloaded API says so", busy instanceof HamanError && /busy right now/.test(busy.message));
  console.error = realError;

  section("Replies — formatting");
  const blocks = toBlocks("Clients owe **BHD 315.000**.\n\n- [Ox Roastery](/clients/1): BHD 15.000\n- Voya: BHD 300.000\n\n## Next\n1. Call Ox\n2) Email Voya");
  check("Paragraphs, bullets, numbered lists; headings become plain lines", JSON.stringify(blocks.map((b) => (b.kind === "p" ? b.lines.length : `${b.kind}${b.items.length}`))) === JSON.stringify([1, "ul2", 1, "ol2"]));
  const spans = toSpans("Owed: **BHD 315.000** by [Ox](/clients/1)");
  check("Bold and in-app links", JSON.stringify(spans.map((s) => s.kind)) === JSON.stringify(["text", "bold", "text", "link"]) && spans[3]!.kind === "link" && spans[3]!.internal);
  for (const href of ["javascript:alert(1)", "//evil.example/p", "data:text/html,hi", "mailto:a@b.c"]) {
    check(`${href.split(/[:/]/)[0] || "protocol-relative"} is never made a link`, !toSpans(`[x](${href})`).some((s) => s.kind === "link"));
  }
  check("HTML stays as text", JSON.stringify(toSpans("<img src=x onerror=alert(1)>")) === JSON.stringify([{ kind: "text", text: "<img src=x onerror=alert(1)>" }]));

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
