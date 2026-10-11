/**
 * Checks for Haman (lib/haman): every lookup runs against the demo data as a
 * partner and as a team member, every action points at a real route and
 * becomes a confirmation card without changing anything, the conversation
 * loop is driven with a stand-in for the Claude API (no key or network
 * needed), and the reply formatting is checked for unsafe links.
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

type Call = { url: string; headers: Record<string, string>; body: { model: string; output_config?: { effort?: string }; fallbacks?: unknown; system: { text: string; cache_control?: unknown }[]; tools: { name: string; cache_control?: unknown }[]; tool_choice?: { type: string }; messages: { role: string; content: unknown }[] } };

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
  const { ALL_ACTIONS, ActionInputError, actionToolsFor, proposeAction } = await import("../lib/haman/actions");
  const { textToDoc } = await import("../lib/haman/wikiText");
  type Ctx = Parameters<typeof runTool>[2];
  type Event = Parameters<Parameters<typeof askHaman>[2]>[0];

  const [user] = await query<{ id: string; fullName: string }>(`select id, full_name as "fullName" from users order by created_at limit 1`);
  const [client] = await query<{ id: string; name: string }>("select id, name from clients order by name limit 1");
  const [project] = await query<{ id: string }>("select id from projects order by name limit 1");
  const [page] = await query<{ id: string; title: string }>("select id, title from kb_pages where not is_template order by title limit 1");
  const partner: Ctx = { userId: user!.id, userName: user!.fullName, role: "partner_admin" };
  const member: Ctx = { userId: user!.id, userName: "Team Member", role: "lead_dev" };
  const marketer: Ctx = { userId: user!.id, userName: "Marketing", role: "marketing" };

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
    list_records: { kind: "team" },
    get_record: { kind: "project", id: project!.id },
  };
  check("Partners get every lookup; team members only the delivery ones", toolsFor("partner_admin").length === HAMAN_TOOLS.length && toolsFor("lead_dev").every((t) => t.access === "everyone"));
  for (const tool of HAMAN_TOOLS) {
    const result = await runTool(tool.name, inputs[tool.name] ?? {}, partner);
    const problems = [
      result.isError && "returned an error",
      // get_record hands back stored fields to edit, with each amount in major units beside them.
      tool.name !== "get_record" && /"\w*[Cc]ents"\s*:/.test(result.content) && "hands the model raw minor units",
      /NaN|undefined|Invalid Date/.test(result.content) && "contains NaN, undefined or Invalid Date",
    ].filter(Boolean);
    check(`${tool.name}`, problems.length === 0, `${problems.join("; ")}: ${result.content.slice(0, 200)}`);
    const asMember = await runTool(tool.name, inputs[tool.name] ?? {}, member);
    if (tool.access !== "everyone") check(`${tool.name} is refused for a team member`, asMember.isError && !/BHD|\$/.test(asMember.content));
    else check(`${tool.name} works for a team member`, !asMember.isError);
  }

  section("Lookups — the Marketing role sees everything except money");
  const marketingTools = toolsFor("marketing").map((t) => t.name);
  check("Marketing gets the CRM and marketing lookups", ["list_clients", "get_client", "pipeline", "follow_ups", "content_calendar", "campaigns", "leads_report"].every((n) => marketingTools.includes(n)));
  check("Marketing gets no finance lookups", !["finance_overview", "list_documents", "cash_flow", "profit_by_project", "list_expenses", "hosting_fees"].some((n) => marketingTools.includes(n)));
  for (const name of ["pipeline", "get_client", "list_clients", "leads_report", "campaigns", "search_os", "needs_attention"]) {
    const r = await runTool(name, inputs[name] ?? {}, marketer);
    check(`${name} for Marketing has no amounts`, !r.isError && !/BHD|USD|"value"|"owes"|"total":"|"weighted"|wonValue|revenue|outstanding/.test(r.content.replace(/"spent":"[^"]*"|"budget":"[^"]*"/g, "")), r.content.slice(0, 300));
  }
  check("Marketing's pipeline still counts deals by stage", /"byStage":\[\{"stage":"lead","deals":\d+\}/.test((await runTool("pipeline", {}, marketer)).content));
  const [someDeal] = await query<{ id: string }>("select id from deals limit 1");
  const dealForMarketing = await runTool("get_record", { kind: "deal", id: someDeal!.id }, marketer);
  check("get_record gives Marketing a deal without its value", !dealForMarketing.isError && !/valueCents|valueMajor/.test(dealForMarketing.content));
  check("get_record refuses Marketing a document", /isn't open/.test((await runTool("get_record", { kind: "document", id: someDeal!.id }, marketer)).content));
  check("list_records refuses Marketing bank accounts and payouts", /isn't open/.test((await runTool("list_records", { kind: "bank_accounts" }, marketer)).content) && /isn't open/.test((await runTool("list_records", { kind: "payouts" }, marketer)).content));
  const marketingFiles = await runTool("list_records", { kind: "files" }, marketer);
  check("list_records gives Marketing no contracts or finance files", !/"category":"(contract|finance|receipt)"/.test(marketingFiles.content));
  const marketingActions = actionToolsFor("marketing");
  const dealTool = marketingActions.find((t) => t.name === "create_deal")!;
  check("Marketing's create_deal has no value or currency to fill in", !("value" in dealTool.input_schema.properties) && !("currency" in dealTool.input_schema.properties));
  check("Marketing can plan posts and campaigns but not record payments or touch the Vault", ["create_post", "create_campaign", "log_campaign_numbers"].every((n) => marketingActions.some((t) => t.name === n)) && !["record_payment", "create_expense", "reveal_vault_secret", "set_profit_split_rule"].some((n) => marketingActions.some((t) => t.name === n)));
  const dealCard = await proposeAction("create_deal", { target: "New lead", title: "New lead", value: 900, currency: "BHD", source: "Instagram" }, "marketing");
  check("A deal Marketing prepares carries no value, even if one is given", !("value" in (dealCard.request.body ?? {})) && !dealCard.fields.some((f) => /BHD/.test(f.value)));
  const post = await proposeAction("create_post", { target: "Case study", title: "Ox Roastery case study", channel: "linkedin", status: "drafting", publishAt: "2026-10-20T10:00:00+03:00" }, "marketing");
  check("A post becomes a request to the content calendar", post.request.path === "/api/marketing/posts" && post.fields.some((f) => f.label === "Publish at" || f.label === "Goes out" || /Oct/.test(f.value)));

  section("Lookups — role filtering and bad input");
  const memberSearch = await runTool("search_os", { query: client!.name.slice(0, 5) }, member);
  check("A team member's search returns no clients, contacts, deals or documents", !/"kind":"(client|contact|deal|document)"/.test(memberSearch.content));
  const memberAttention = await runTool("needs_attention", {}, member);
  check("A team member's Needs Attention has no hosting fees, files or follow-ups", !/"kind":"(hosting|follow_up|file)"/.test(memberAttention.content));
  const byName = await runTool("get_client", { client_id: client!.name }, partner);
  check("A name where an id belongs is explained, not run", byName.isError && /search_os/.test(byName.content));
  check("A lookup that doesn't exist is refused", (await runTool("reveal_secret", {}, partner)).isError);
  check("No lookup touches the Vault", !HAMAN_TOOLS.some((t) => /vault|secret|password|credential/i.test(t.name)));
  const kinds = ["team", "wiki_spaces", "meetings", "reminders", "bank_accounts", "parties", "deduction_types", "split_rules", "ventures", "products", "recurring_expenses", "payouts", "contacts", "deals", "certifications", "partnerships", "product_pipeline", "files", "vault_items"];
  const listed = await Promise.all(kinds.map((kind) => runTool("list_records", { kind }, partner)));
  check("list_records runs for every kind", listed.every((r) => !r.isError && !/"error"/.test(r.content)), listed.find((r) => r.isError || /"error"/.test(r.content))?.content);
  check("list_records gives Vault names, never values or previews", !/ciphertext|masked|maskedPreview|authTag/i.test(listed[kinds.indexOf("vault_items")]!.content));
  check("list_records keeps partner kinds from a team member", /isn't open/.test((await runTool("list_records", { kind: "bank_accounts" }, member)).content));
  const [doc] = await query<{ id: string }>("select id from documents where type = 'invoice' limit 1");
  const docRecord = await runTool("get_record", { kind: "document", id: doc!.id }, partner);
  check("get_record reads a document with its line items and payments, amounts in major units too", /"lineItems"/.test(docRecord.content) && /"payments"/.test(docRecord.content) && /"totalMajor"|Major"/.test(docRecord.content));
  check("get_record keeps partner records from a team member", /isn't open/.test((await runTool("get_record", { kind: "document", id: doc!.id }, member)).content));
  const userRow = await runTool("get_record", { kind: "task", id: (await query<{ id: string }>("select id from tasks limit 1"))[0]!.id }, partner);
  check("get_record never returns a password hash", !/passwordHash|password_hash/.test(userRow.content));
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
  check("Uses the default model and offers a partner every lookup and action", first.model === "claude-opus-5-5" && first.tools.length === HAMAN_TOOLS.length + actionToolsFor("partner_admin").length);
  check("Asks for balanced effort by default", first.output_config?.effort === "medium");
  check("Opts into Anthropic's safety fallback on models that have one", first.fallbacks === "default" && calls[0]!.headers["anthropic-beta"] === "server-side-fallback-2026-07-01");
  check("Caches the lookups and persona, not the dated line", !!first.tools.at(-1)!.cache_control && !!first.system[0]!.cache_control && !first.system[1]!.cache_control);
  check("Tells the model who is asking, their role and the date", first.system[1]!.text.includes(`${partner.userName}, a partner`) && /Bahrain time/.test(first.system[1]!.text));
  const followUp = calls[1]!.body.messages;
  const results = followUp[2]!.content as { tool_use_id: string; content: string }[];
  check("Sends both results back in one turn, matched to their calls", followUp.length === 3 && results.length === 2 && results[0]!.tool_use_id === "t1" && /owedByClients/.test(results[0]!.content) && results[1]!.tool_use_id === "t2" && /totalOutstanding/.test(results[1]!.content));
  check("Emits one readable status line", events.length === 1 && events[0]!.type === "status" && events[0]!.text === "Checking the finances · Checking invoices and documents");

  calls = mockClaude((_call, n) => (n === 1 ? asks(toolUse("x", "finance_overview")) : says("That part isn't open to your account.")));
  await askHaman([{ role: "user", content: "What's the bank balance?" }], member, () => {});
  check(
    "A team member is offered no finance, CRM, company, settings or Vault lookups or actions",
    !calls[0]!.body.tools.some((t) => ["finance_overview", "get_client", "pipeline", "list_documents", "record_payment", "create_client", "delete_vault_secret", "reveal_vault_secret", "set_profit_split_rule", "update_company_profile", "delete_project"].includes(t.name)) &&
      calls[0]!.body.tools.some((t) => t.name === "create_task") &&
      /a team member/.test(calls[0]!.body.system[1]!.text),
  );
  const refused = (calls[1]!.body.messages[2]!.content as { is_error?: boolean; content: string }[])[0]!;
  check("A partner lookup named for a team member returns an error and no data", refused.is_error === true && !/BHD/.test(refused.content));

  calls = mockClaude((call) => (call.body.tool_choice?.type === "none" ? says("Here's what I have.") : asks(toolUse("l", "list_projects"))));
  const looped = await askHaman([{ role: "user", content: "Keep looking" }], partner, () => {});
  check("Stops after eight rounds: the last one may not call lookups", calls.length === 8 && calls[7]!.body.tool_choice?.type === "none" && looped === "Here's what I have.");

  const realError = console.error;
  console.error = () => {};
  process.env.HAMAN_MODEL = "claude-haiku-4-5-20251001";
  calls = mockClaude(() => ({ status: 401, json: { error: { message: "invalid x-api-key sk-ant-secret" } } }));
  const failure = await askHaman([{ role: "user", content: "hi" }], partner, () => {}).catch((e: unknown) => e);
  check("HAMAN_MODEL picks the model", calls[0]!.body.model === "claude-haiku-4-5-20251001");
  check("A model outside the list gets no effort or fallback it may not accept", calls[0]!.body.output_config === undefined && calls[0]!.body.fallbacks === undefined);
  check("A rejected key gives a safe message that doesn't repeat the API's text", failure instanceof HamanError && /API key was rejected/.test(failure.message) && !/sk-ant/.test(failure.message));
  mockClaude(() => ({ status: 529, json: {} }));
  const busy = await askHaman([{ role: "user", content: "hi" }], partner, () => {}).catch((e: unknown) => e);
  check("An overloaded API says so", busy instanceof HamanError && /busy right now/.test(busy.message));
  console.error = realError;

  section("Actions — every one points at a real route and becomes a card");
  const names = ALL_ACTIONS.map((a) => a.name);
  check("Action names are unique and don't clash with lookups", new Set(names).size === names.length && !names.some((n) => HAMAN_TOOLS.some((t) => t.name === n)));
  check("Nothing resets passwords, unlocks the Vault or stores a secret", !ALL_ACTIONS.some((a) => /password|vault\/(setup|unlock|lock)|^\/api\/vault$/.test(a.path) || a.name === "create_vault_secret"));
  for (const a of ALL_ACTIONS) {
    const routeFile = path.join("app", a.path.split("?")[0]!.replace(/\{\w+\}/g, "[id]"), "route.ts");
    const source = fs.existsSync(routeFile) ? fs.readFileSync(routeFile, "utf8") : "";
    check(`${a.name} → ${a.method} ${a.path}`, new RegExp(`export (const|async function) ${a.method}\\b`).test(source), `no ${a.method} in ${routeFile}`);
  }
  const partnerTools = actionToolsFor("partner_admin");
  check("Every action's input schema is an object with a target", partnerTools.every((t) => t.input_schema.type === "object" && t.input_schema.required.includes("target") && typeof t.input_schema.properties === "object"));

  const before = (await query<{ n: number }>("select count(*)::int as n from tasks"))[0]!.n;
  const card = await proposeAction("create_task", { target: "Follow up with Ox", projectId: project!.id, title: "Follow up with Ox", dueAt: "2026-10-20", priority: "high" }, "partner_admin");
  const projectName = (await query<{ name: string }>("select name from projects where id = $1", [project!.id]))[0]!.name;
  check("A task becomes a request to the tasks route", card.request.method === "POST" && card.request.path === "/api/tasks" && (card.request.body as { title?: string }).title === "Follow up with Ox");
  check("The card names the project instead of showing its id", card.fields.some((f) => f.label === "Project" && f.value === projectName) && !card.fields.some((f) => /[0-9a-f]{8}-[0-9a-f]{4}/.test(f.value)));
  check("Dates on the card are readable", card.fields.some((f) => f.label === "Due" && /Oct/.test(f.value)));
  check("Preparing a change changes nothing", (await query<{ n: number }>("select count(*)::int as n from tasks"))[0]!.n === before);
  const pay = await proposeAction("record_payment", { target: "INV-0001", id: doc!.id, amount: 500, method: "transfer", paidOn: "2026-10-11" }, "partner_admin");
  check("Money on the card is formatted", pay.request.path === `/api/documents/${doc!.id}/payments` && pay.fields.some((f) => f.label === "Amount" && f.value.includes("500.000")));
  const rejects = async (name: string, input: unknown, role: "partner_admin" | "lead_dev" = "partner_admin") => proposeAction(name, input, role).then(() => false, (e: unknown) => e instanceof ActionInputError);
  check("A missing required field comes back to Haman", await rejects("create_task", { target: "x", projectId: project!.id }));
  check("A name where an id belongs is refused", await rejects("delete_client", { target: "Ox", id: "Ox Roastery" }));
  check("A path can't be steered with the id", await rejects("delete_task", { target: "x", id: "../../users/00000000-0000-4000-8000-000000000001" }));
  check("A card needs a target", await rejects("delete_task", { id: project!.id }));
  check("A team member can't prepare a partner action", await rejects("record_payment", { target: "x", id: doc!.id, amount: 1, method: "cash" }, "lead_dev"));
  check("A team member can't delete a project", await rejects("delete_project", { target: "x", id: project!.id }, "lead_dev"));
  const del = await proposeAction("delete_task", { target: "Old task", id: project!.id }, "partner_admin");
  check("Deletes are marked as such and send no body", del.kind === "delete" && del.request.method === "DELETE" && del.request.body === undefined);
  const reveal = await proposeAction("reveal_vault_secret", { target: "Server root", id: project!.id }, "partner_admin");
  check("Showing a secret is its own kind of card", reveal.kind === "reveal" && reveal.request.path.endsWith("/reveal"));
  const unlink = await proposeAction("unlink_hosting_invoice", { target: "x", id: project!.id, documentId: doc!.id }, "partner_admin");
  check("Query-string ids are filled in too", unlink.request.path === `/api/hosting/${project!.id}/invoices?documentId=${doc!.id}`);
  const wiki = await proposeAction("write_wiki_page", { target: page!.title, id: page!.id, text: "# Plan\n- one\n- two\n\n[x] done" }, "lead_dev");
  const content = (wiki.request.body as { content: { content: { type: string }[] } }).content.content;
  check("Wiki text becomes editor content", JSON.stringify(content.map((n) => n.type)) === JSON.stringify(["heading", "bulletList", "taskList"]));
  check("Wiki text keeps paragraphs and bold", JSON.stringify(textToDoc("Hello **there**\nsame paragraph\n\nNext").content) === JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "there", marks: [{ type: "bold" }] }, { type: "text", text: " same paragraph" }] }, { type: "paragraph", content: [{ type: "text", text: "Next" }] }]));

  section("Actions — in the conversation");
  calls = mockClaude((_call, n) =>
    n === 1 ? asks(toolUse("a1", "create_task", { target: "Call Ox", projectId: project!.id, title: "Call Ox" }), toolUse("a2", "create_task", { target: "Bad" })) : says("I've prepared the task for you to confirm."),
  );
  const actionEvents: Event[] = [];
  await askHaman([{ role: "user", content: "Add a task to call Ox" }], partner, (e) => actionEvents.push(e));
  const cards = actionEvents.filter((e) => e.type === "action");
  const actionResults = calls[1]!.body.messages[2]!.content as { tool_use_id: string; content: string; is_error?: boolean }[];
  check("A valid action is sent to the browser as one card", cards.length === 1 && cards[0]!.type === "action" && cards[0]!.action.title === "Create a task");
  check("Haman hears that nothing has changed until the user confirms", /Nothing has changed yet/.test(actionResults[0]!.content) && !actionResults[0]!.is_error);
  check("An invalid action comes back to him as an error to fix", actionResults[1]!.is_error === true && /Required/.test(actionResults[1]!.content));
  check("The status line says he's preparing a change", actionEvents.some((e) => e.type === "status" && /Preparing the change/.test(e.text)));
  check("Still nothing changed in the database", (await query<{ n: number }>("select count(*)::int as n from tasks"))[0]!.n === before);

  section("Model and depth — chosen in Settings");
  const { setSetting } = await import("../lib/data/settings");
  const { normalizeSettings } = await import("../lib/haman/models");
  await setSetting("haman", { model: "claude-haiku-5-5", effort: "low" });
  calls = mockClaude(() => says("Hi."));
  await askHaman([{ role: "user", content: "hi" }], partner, () => {});
  check("A saved choice picks the model and effort", calls[0]!.body.model === "claude-haiku-5-5" && calls[0]!.body.output_config?.effort === "low");
  check("No fallback is asked for on Haiku (it has none)", calls[0]!.body.fallbacks === undefined && !calls[0]!.headers["anthropic-beta"]);
  process.env.HAMAN_MODEL = "claude-sonnet-5-5";
  calls = mockClaude(() => says("Hi."));
  await askHaman([{ role: "user", content: "hi" }], partner, () => {});
  check("A saved choice wins over HAMAN_MODEL", calls[0]!.body.model === "claude-haiku-5-5");
  delete process.env.HAMAN_MODEL;
  check("An unknown saved model or effort falls back to the defaults", JSON.stringify(normalizeSettings({ model: "gpt-9", effort: "max" as never })) === JSON.stringify({ model: "claude-opus-5-5", effort: "medium" }));
  await query("delete from app_settings where key = 'haman'");
  calls = mockClaude(() => ({ json: { stop_reason: "refusal", content: [] } }));
  const declined = await askHaman([{ role: "user", content: "something declined" }], partner, () => {});
  check("A declined request gets a plain answer, not an error", /can't help with that/.test(declined));

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
