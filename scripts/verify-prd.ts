/**
 * Acceptance checks for the Improvements PRD (Sep 2026), run against a
 * fresh, empty embedded database. Recreates the PRD's worked examples —
 * the 258.100 BHD balance, the partner ledger, project P&L, the 20%
 * reserve on Quotation #2605, the #00267 split override — and asserts the
 * figures the PRD expects, plus the document, hosting and expense rules.
 *
 *   npm run test:prd
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "newmux-verify-"));
process.env.PGLITE_DIR = dir;
process.env.DB_SKIP_SEED = "1";
delete process.env.DATABASE_URL;

let failures = 0;
let passes = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}
async function rejects(name: string, fn: () => Promise<unknown>, match: RegExp) {
  try {
    await fn();
    check(`${name} (should be refused)`, "accepted", "refused");
  } catch (e) {
    check(name, match.test((e as Error).message) ? "refused" : (e as Error).message, "refused");
  }
}
const section = (title: string) => console.log(`\n${title}`);
/** BHD major → fils. */
const bhd = (major: number) => Math.round(major * 1000);

async function main() {
  const { query } = await import("../lib/db");
  const finance = await import("../lib/data/finance");
  const docs = await import("../lib/data/documents");
  const ledger = await import("../lib/data/ledger");
  const reports = await import("../lib/data/reports");
  const { getInvoiceProfitBreakdown } = await import("../lib/data/profit");
  const { createExpense } = await import("../lib/data/expenses");
  const { one } = await import("../lib/data/sql");

  // --- Fixtures -----------------------------------------------------------
  const [admin] = await query<{ id: string }>(
    "insert into users (email, password_hash, full_name, role) values ('verify@newmux.test', 'x', 'Verifier', 'partner_admin') returning id",
  );
  const by = admin!.id;
  const mohammed = await finance.createParty("Mohammed");
  const jassim = await finance.createParty("Jassim");
  const reserveFund = (await finance.listParties()).find((p) => p.kind === "fund")!;
  check("The migration creates the Newmux Reserve fund", reserveFund?.name, "Newmux Reserve");

  const passThrough = await finance.createDeductionType("Pass-through cost", "fixed");
  const reserve = await finance.createDeductionType("Newmux Reserve", "percentage", reserveFund.id);

  const [client] = await query<{ id: string }>("insert into clients (name) values ('Marasi Alsawadi') returning id");
  const clientId = client!.id;
  const project = async (name: string) =>
    (await query<{ id: string }>("insert into projects (name, client_id, status) values ($1, $2, 'active_sprint') returning id", [name, clientId]))[0]!.id;

  const invoice = async (projectId: string | null, totalBhd: number, opts: { issuedAt?: string; ref?: string; send?: boolean } = {}) => {
    const doc = await docs.createDocument({
      type: "invoice",
      clientId,
      projectId,
      currency: "BHD",
      taxRateBps: 0,
      issuedAt: opts.issuedAt ?? "2026-08-01",
      externalRef: opts.ref,
      lineItems: [{ description: "Work", quantity: 1, unitPriceCents: bhd(totalBhd) }],
      createdBy: by,
    });
    if (opts.send !== false) await docs.transitionDocumentStatus(doc.id, "sent", by);
    return doc;
  };
  const split5050 = [
    { partyId: mohammed.id, percentageBps: 5000 },
    { partyId: jassim.id, percentageBps: 5000 },
  ];

  // --- Item 4: deduction base and ordering --------------------------------
  section("Item 4 — Quotation #2605: 185 BHD, 105 pass-through, 20% reserve of the remainder");
  const prj2605 = await project("Additional work (#2605)");
  await finance.upsertProfitSplitRule({
    scopeType: "project",
    scopeId: prj2605,
    splits: split5050,
    deductions: [
      { deductionTypeId: passThrough.id, value: bhd(105) },
      { deductionTypeId: reserve.id, value: 2000, base: "remaining" },
    ],
    updatedBy: by,
  });
  const inv2605 = await invoice(prj2605, 185, { ref: "Quotation #2605" });
  const b2605 = (await getInvoiceProfitBreakdown(inv2605.id))!;
  check("Reserve = 16.000", b2605.deductions.find((d) => d.fundPartyId)?.amountCents, bhd(16));
  check("Mohammed = 32.000", b2605.splits.find((s) => s.partyId === mohammed.id)?.amountCents, bhd(32));
  check("Jassim = 32.000", b2605.splits.find((s) => s.partyId === jassim.id)?.amountCents, bhd(32));
  check("The reserve is an allocation, not a cost (cost = 105.000)", b2605.costCents, bhd(105));

  section("Item 4 — the same result when the 105 is a real expense charged to the invoice");
  const prjExpense = await project("Pass-through as an expense");
  await finance.upsertProfitSplitRule({
    scopeType: "project",
    scopeId: prjExpense,
    splits: split5050,
    deductions: [{ deductionTypeId: reserve.id, value: 2000, base: "remaining" }],
    updatedBy: by,
  });
  const invExp = await invoice(prjExpense, 185);
  await createExpense({ description: "Vendor", category: "contractor", amountCents: bhd(105), currency: "BHD", spentOn: "2026-07-20", linkedProjectId: prjExpense, documentId: invExp.id }, by);
  const bExp = (await getInvoiceProfitBreakdown(invExp.id))!;
  check("Reserve = 16.000, split 32.000 / 32.000", [bExp.deductions.find((d) => d.fundPartyId)?.amountCents, ...bExp.splits.map((s) => s.amountCents)], [bhd(16), bhd(32), bhd(32)]);
  check("Legacy rules without a base still use the invoice total", (await (async () => {
    const p = await project("Legacy base");
    await finance.upsertProfitSplitRule({ scopeType: "project", scopeId: p, splits: split5050, deductions: [{ deductionTypeId: passThrough.id, value: bhd(105) }, { deductionTypeId: reserve.id, value: 2000 }], updatedBy: by });
    const inv = await invoice(p, 185);
    const b = (await getInvoiceProfitBreakdown(inv.id))!;
    await docs.transitionDocumentStatus(inv.id, "void", by, { reason: "fixture" });
    return b.deductions.find((d) => d.fundPartyId)?.amountCents;
  })()), bhd(37));

  // --- Item 5: split rule override per invoice ----------------------------
  section("Item 5 — Invoice #00267 follows its own rule, not the Marasi core project's");
  const marasi = await project("Marasi Alsawadi — core");
  await finance.upsertProfitSplitRule({ scopeType: "project", scopeId: marasi, splits: split5050, deductions: [], updatedBy: by });
  const inv267 = await invoice(marasi, 248, { ref: "#00267" });
  check("Defaults to the project's rule (124.000 each)", (await getInvoiceProfitBreakdown(inv267.id))!.splits.map((s) => s.amountCents), [bhd(124), bhd(124)]);
  await finance.upsertProfitSplitRule({
    scopeType: "document",
    scopeId: inv267.id,
    splits: split5050,
    deductions: [{ deductionTypeId: reserve.id, value: 2000, base: "remaining" }],
    updatedBy: by,
  });
  const b267 = (await getInvoiceProfitBreakdown(inv267.id))!;
  check("Override: reserve 49.600", b267.deductions.find((d) => d.fundPartyId)?.amountCents, bhd(49.6));
  check("Override: 99.200 each", b267.splits.map((s) => s.amountCents), [bhd(99.2), bhd(99.2)]);
  check("Override is scoped to the invoice", b267.ruleScope, "document");
  await finance.setInvoiceSplitRule(inv267.id, null, by);
  check("Back to the project default", (await getInvoiceProfitBreakdown(inv267.id))!.ruleScope, "project");
  await finance.upsertProfitSplitRule({
    scopeType: "document",
    scopeId: inv267.id,
    splits: split5050,
    deductions: [{ deductionTypeId: reserve.id, value: 2000, base: "remaining" }],
    updatedBy: by,
  });

  // --- Item 2: partner payouts and advances -------------------------------
  section("Item 2 — partner ledger: entitled / received / owed");
  // #00267 (99.2 each) + #2605 (32 each) + #2605-as-expense (32 each) = 163.2 each so far.
  // A 50/50 job of 136 (68 each) and a 100-BHD job done by Mohammed alone take them to 331.2 / 231.2.
  const joint = await project("Joint job");
  await finance.upsertProfitSplitRule({ scopeType: "project", scopeId: joint, splits: split5050, deductions: [], updatedBy: by });
  await invoice(joint, 136);
  const solo = await project("Mohammed's job");
  await finance.upsertProfitSplitRule({ scopeType: "project", scopeId: solo, splits: [{ partyId: mohammed.id, percentageBps: 10000 }], deductions: [], updatedBy: by });
  await invoice(solo, 100);
  await ledger.createPayout({ partyId: mohammed.id, type: "share", amountCents: bhd(131.2), currency: "BHD", paidOn: "2026-08-20" }, by);
  await ledger.createPayout({ partyId: jassim.id, type: "share", amountCents: bhd(131.2), currency: "BHD", paidOn: "2026-08-20" }, by);
  const advance = await ledger.createPayout({ partyId: mohammed.id, type: "advance", amountCents: bhd(60), currency: "BHD", paidOn: "2026-09-15" }, by);
  const { partners, funds } = await ledger.getPartyBalances();
  const row = (id: string) => partners.find((p) => p.party.id === id)!;
  check("Mohammed 331.200 / 191.200 / 140.000", [row(mohammed.id).entitledBhdCents, row(mohammed.id).paidBhdCents, row(mohammed.id).remainingBhdCents], [bhd(331.2), bhd(191.2), bhd(140)]);
  check("Jassim 231.200 / 131.200 / 100.000", [row(jassim.id).entitledBhdCents, row(jassim.id).paidBhdCents, row(jassim.id).remainingBhdCents], [bhd(231.2), bhd(131.2), bhd(100)]);

  // --- Item 6: the reserve as a tracked balance ---------------------------
  section("Item 6 — Newmux reserve balance");
  const fund = funds.find((f) => f.party.id === reserveFund.id)!;
  check("Accrued 49.600 + 16.000 + 16.000 = 81.600", fund.accruedBhdCents, bhd(81.6));

  // --- Item 3: project P&L includes linked expenses -----------------------
  section("Item 3 — Profit & loss by project counts linked expenses once");
  const prj1 = await project("PRJ-001");
  await invoice(prj1, 250);
  await invoice(prj1, 160);
  await createExpense({ description: "Freelancer A", category: "contractor", amountCents: bhd(120), currency: "BHD", spentOn: "2026-07-01", linkedProjectId: prj1 }, by);
  await createExpense({ description: "Freelancer B", category: "contractor", amountCents: bhd(70), currency: "BHD", spentOn: "2026-07-02", linkedProjectId: prj1 }, by);
  const prj2 = await project("PRJ-002");
  await invoice(prj2, 300);
  await createExpense({ description: "Freelancer", category: "contractor", amountCents: bhd(45.2), currency: "BHD", spentOn: "2026-07-03", linkedProjectId: prj2 }, by);
  const prj3 = await project("PRJ-003");
  await invoice(prj3, 290);
  await createExpense({ description: "Freelancer", category: "contractor", amountCents: bhd(44.5), currency: "BHD", spentOn: "2026-07-04", linkedProjectId: prj3 }, by);
  const pl = await reports.getProfitByProjectReport();
  const profitOf = (id: string) => pl.find((r) => r.projectId === id)?.netProfitBhdCents;
  check("PRJ-001 = 410 − 190 = 220.000", profitOf(prj1), bhd(220));
  check("PRJ-002 = 254.800", profitOf(prj2), bhd(254.8));
  check("PRJ-003 = 245.500", profitOf(prj3), bhd(245.5));
  check("#2605 project: 185 − 105 pass-through = 80.000 (reserve is not a cost)", profitOf(prj2605), bhd(80));
  const prj1Invoices = (await docs.listDocuments({ projectId: prj1 })).map((d) => d.id);
  const prj1Costs = (await Promise.all(prj1Invoices.map(getInvoiceProfitBreakdown))).reduce((s, b) => s + b!.costCents, 0);
  check("PRJ-001's 190 is spread over its invoices exactly once", prj1Costs, bhd(190));

  // --- Item 1: company account balance ------------------------------------
  section("Item 1 — account balance: opening 236.000 + September movements = 258.100");
  check("No balance until an account is set up", await ledger.getCompanyBalanceBhd("2026-09-24"), null);
  const account = await ledger.createBankAccount({ name: "Newmux — BBK", currency: "BHD", openingBalanceCents: bhd(236), openingBalanceDate: "2026-09-01" }, by);
  const pay = (docId: string, amount: number, paidOn: string) =>
    finance.addPayment({ documentId: docId, amountCents: bhd(amount), method: "benefitpay", paidOn, recordedBy: by });
  await pay(inv267.id, 248, "2026-08-25"); // before the opening date: already in the 236.000
  await pay(inv2605.id, 185, "2026-09-10");
  await createExpense({ description: "Vendor for #2605", category: "contractor", amountCents: bhd(105), currency: "BHD", spentOn: "2026-09-11" }, by);
  // (the 60.000 advance on 15 Sep is already recorded above)
  await createExpense({ description: "Instagram ads", category: "marketing", amountCents: bhd(10), currency: "BHD", spentOn: "2026-09-20", fundPartyId: reserveFund.id }, by);
  await pay(invExp.id, 12.1, "2026-09-22");
  await createExpense(
    { description: "Domain on Jassim's card", category: "hosting", amountCents: bhd(3), currency: "BHD", spentOn: "2026-09-21", paidByPartyId: jassim.id, reimbursementStatus: "pending" },
    by,
  );
  const balance = await ledger.getCompanyBalanceBhd("2026-09-24");
  check("Finance shows 258.100 BHD", balance?.balanceBhdCents, bhd(258.1));
  check("A partner-paid expense doesn't touch the account", balance?.accounts[0]?.outCents, bhd(175));

  section("Item 1 — reconcile with the bank statement");
  const rec = await ledger.reconcileAccount({ accountId: account.id, statementDate: "2026-09-24", statementBalanceCents: bhd(258.1), adjust: false, createdBy: by });
  check("Statement matches: difference 0", rec.statementBalanceCents - rec.computedBalanceCents, 0);
  await ledger.reconcileAccount({ accountId: account.id, statementDate: "2026-09-24", statementBalanceCents: bhd(258), adjust: true, note: "Bank fee", createdBy: by });
  check("An adjustment makes the balance match the bank", (await ledger.getCompanyBalanceBhd("2026-09-24"))?.balanceBhdCents, bhd(258));

  section("Item 6 — spending from the reserve");
  check("81.600 − 10.000 Instagram ads = 71.600", (await ledger.getPartyBalances()).funds[0]!.balanceBhdCents, bhd(71.6));

  section("Item 16 — paid by a partner, then reimbursed");
  const jBefore = (await ledger.getPartyBalances()).partners.find((p) => p.party.id === jassim.id)!;
  check("Jassim is owed the 3.000 he paid", jBefore.reimbursementDueBhdCents, bhd(3));
  check("…on top of his 100.000 share", jBefore.remainingBhdCents, bhd(103));

  // --- Items 7–10: documents ----------------------------------------------
  section("Item 7 — editable issue date");
  const late = await invoice(null, 50, { issuedAt: "2026-06-15" });
  check("Issue date is kept as entered (Bahrain)", new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(new Date((await docs.getDocumentById(late.id))!.issuedAt!)), "2026-06-15");
  await docs.updateDocument(late.id, { issuedAt: "2026-05-02" }, by);
  check("…and can be changed after sending", new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(new Date((await docs.getDocumentById(late.id))!.issuedAt!)), "2026-05-02");

  section("Item 8 — external reference");
  check("Stored on the invoice", (await docs.getDocumentById(inv267.id))!.externalRef, "#00267");

  section("Item 10 — status rules per document type");
  await rejects("An invoice can't be Signed", () => docs.transitionDocumentStatus(late.id, "signed", by), /can't go from/);
  await rejects("An invoice can't be marked Paid by hand", () => docs.transitionDocumentStatus(late.id, "paid" as never, by), /can't go from/);
  await pay(late.id, 20, "2026-09-01");
  check("A partial payment leaves it Sent (partly paid)", (await docs.getDocumentById(late.id))!.status, "sent");
  await rejects("Back to draft is refused once paid in part", () => docs.transitionDocumentStatus(late.id, "draft", by), /has payments/);
  await pay(late.id, 30, "2026-09-02");
  check("Paid once payments cover the total", (await docs.getDocumentById(late.id))!.status, "paid");

  section("Item 9 — void, credit notes, purge");
  const demo = await invoice(null, 75);
  await pay(demo.id, 75, "2026-09-05");
  await rejects("Voiding needs a reason", () => docs.transitionDocumentStatus(demo.id, "void", by), /reason/);
  const before = (await ledger.getCompanyBalanceBhd("2026-09-24"))!.balanceBhdCents;
  await docs.transitionDocumentStatus(demo.id, "void", by, { reason: "Demo data" });
  check("A void invoice's payments leave the balance", (await ledger.getCompanyBalanceBhd("2026-09-24"))!.balanceBhdCents, before - bhd(75));
  check("…and it is out of the invoice reports", (await reports.getInvoiceStatusReport()).paidCount, (await docs.listDocuments({ type: "invoice" })).filter((d) => ["paid", "archived"].includes(d.status) || (d.status === "sent" && d.paidCents >= d.totalCents - d.creditedCents)).length);
  await docs.deleteDocument(demo.id, by);
  check("A void invoice can be purged", await docs.getDocumentById(demo.id), undefined);

  const big = await invoice(null, 100);
  const credit = await docs.createDocument({
    type: "credit_note",
    clientId,
    currency: "BHD",
    taxRateBps: 0,
    creditForId: big.id,
    lineItems: [{ description: "Discount agreed", quantity: 1, unitPriceCents: bhd(30) }],
    createdBy: by,
  });
  await docs.transitionDocumentStatus(credit.id, "sent", by);
  await rejects("A credit can't exceed what's left on the invoice", () =>
    docs.createDocument({ type: "credit_note", clientId, currency: "BHD", taxRateBps: 0, creditForId: big.id, lineItems: [{ description: "Too much", quantity: 1, unitPriceCents: bhd(80) }], createdBy: by }),
    /left to credit/,
  );
  await rejects("Payments stop at the credited total (70.000)", () => pay(big.id, 71, "2026-09-06"), /still owed/);
  await pay(big.id, 70, "2026-09-06");
  check("Paid after 70.000 + a 30.000 credit note", (await docs.getDocumentById(big.id))!.status, "paid");

  // --- Item 37 + 34: quotes and the pipeline ------------------------------
  section("Items 34, 37 — quotes drive the pipeline; deposit and balance invoices");
  const quote = await docs.createDocument({
    type: "quote",
    clientId,
    currency: "BHD",
    taxRateBps: 0,
    lineItems: [{ description: "Voya booking platform", quantity: 1, unitPriceCents: bhd(490) }],
    createdBy: by,
  });
  const deal = () => one<{ stage: string; valueCents: number }>("select stage, value_cents from deals where id = (select deal_id from documents where id = $1)", [quote.id]);
  check("Creating a quote creates a deal with its value", await deal(), { stage: "qualified", valueCents: bhd(490) });
  await docs.transitionDocumentStatus(quote.id, "sent", by);
  check("Sending moves the deal to Proposal", (await deal())?.stage, "proposal");
  await docs.transitionDocumentStatus(quote.id, "accepted", by);
  check("Accepting wins the deal at the quote value", await deal(), { stage: "won", valueCents: bhd(490) });
  const deposit = await docs.convertQuotationToInvoice(quote.id, by, { mode: "deposit", depositPercent: 50 });
  check("50% deposit invoice = 245.000", deposit.totalCents, bhd(245));
  await rejects("Invoicing in full after a deposit is refused", () => docs.convertQuotationToInvoice(quote.id, by, { mode: "full" }), /remaining balance/);
  const rest = await docs.convertQuotationToInvoice(quote.id, by, { mode: "balance" });
  check("Balance invoice = 245.000", rest.totalCents, bhd(245));
  await rejects("Nothing left to invoice", () => docs.convertQuotationToInvoice(quote.id, by), /invoiced in full/);

  await extraChecks({ by, clientId, bhd, check, rejects, section, advanceId: advance.id, jassimId: jassim.id });

  console.log(`\n${passes} passed, ${failures} failed.`);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(failures ? 1 : 0);
}

/** Hosting, expense and housekeeping checks (items 12–20). */
async function extraChecks(t: {
  by: string;
  clientId: string;
  bhd: (n: number) => number;
  check: typeof check;
  rejects: typeof rejects;
  section: typeof section;
  advanceId: string;
  jassimId: string;
}) {
  const { check, rejects, section, bhd, by, clientId } = t;
  const { query } = await import("../lib/db");
  const hosting = await import("../lib/data/hosting");
  const reports = await import("../lib/data/reports");
  const docs = await import("../lib/data/documents");
  const finance = await import("../lib/data/finance");
  const expenses = await import("../lib/data/expenses");
  const ledger = await import("../lib/data/ledger");
  const { one } = await import("../lib/data/sql");
  const { deleteProject } = await import("../lib/data/projects");
  const { deleteClient } = await import("../lib/data/clients");
  const { todayYmd, addMonthsYmd } = await import("../lib/time");

  section("Item 13 — hosting fee with amount TBD and no due date");
  const tbd = await hosting.createHostingSubscription({ clientId, item: "domain", label: "alhussam.example", amountCents: null, currency: "BHD", cycle: "annual", nextDueDate: null, status: "not_started" });
  check("Saved with no amount and no due date", [tbd.amountCents, tbd.nextDueDate, tbd.status], [null, null, "not_started"]);
  const ox = await hosting.createHostingSubscription({ clientId, item: "server", amountCents: bhd(15), currency: "BHD", cycle: "quarterly", nextDueDate: "2026-09-20" });
  const cleared = await hosting.updateHostingSubscription(ox.id, { clientId, item: "server", amountCents: bhd(15), currency: "BHD", cycle: "quarterly", nextDueDate: null, status: "paused" });
  check("The next due date can be cleared", cleared.nextDueDate, null);
  await hosting.updateHostingSubscription(ox.id, { clientId, item: "server", amountCents: bhd(15), currency: "BHD", cycle: "quarterly", nextDueDate: "2026-09-20", status: "active" });
  await rejects("Collecting a TBD fee needs an amount", () => hosting.collectHostingFee(tbd.id, by), /amount/);

  section("Item 12 — Collect creates the invoice, records the payment, moves the due date");
  const collected = await hosting.collectHostingFee(ox.id, by, { paidOn: todayYmd(), method: "benefitpay" });
  check("Invoice is paid and linked to the fee", [collected.invoice.hostingSubscriptionId, (await docs.getDocumentById(collected.invoice.id))!.status], [ox.id, "paid"]);
  check("Next due date moves one quarter", collected.subscription.nextDueDate, addMonthsYmd("2026-09-20", 3));
  check("Last collected = payment date", collected.subscription.lastCollectedDate, todayYmd());
  const priced = await hosting.collectHostingFee(tbd.id, by, { amountCents: bhd(2.635), paidOn: todayYmd() });
  check("A TBD fee takes the collected amount as its price", priced.subscription.amountCents, bhd(2.635));

  section("Item 12 — an invoice issued elsewhere can be linked, and its payment counts");
  const manual = await docs.createDocument({ type: "invoice", clientId, currency: "BHD", taxRateBps: 0, issuedAt: todayYmd(), lineItems: [{ description: "Hosting (Notion era)", quantity: 1, unitPriceCents: bhd(60) }], createdBy: by });
  await docs.transitionDocumentStatus(manual.id, "sent", by);
  await hosting.linkHostingInvoice(ox.id, manual.id, { advance: true }, by);
  check("Linking can move the due date on", (await one<{ nextDueDate: string }>("select next_due_date from hosting_subscriptions where id = $1", [ox.id]))?.nextDueDate, addMonthsYmd("2026-09-20", 6));
  await finance.addPayment({ documentId: manual.id, amountCents: bhd(60), method: "paypal", paidOn: todayYmd(), recordedBy: by });
  const report = await reports.getHostingFeeReport();
  check("Collected this year = 15 + 2.635 + 60", report.collectedBhdCents, bhd(77.635));

  section("Item 14 — margin per hosting client");
  const [recurring] = await query<{ id: string }>(
    "insert into recurring_expenses (name, category, amount_cents, currency, cycle) values ('Vendor server', 'hosting', 5000, 'USD', 'annual') returning id",
  );
  const withCost = await hosting.createHostingSubscription({ clientId, item: "server", label: "Ox", amountCents: bhd(60), currency: "BHD", cycle: "annual", nextDueDate: "2027-01-01", recurringExpenseId: recurring!.id });
  const row = (await hosting.listHostingSubscriptions()).find((h) => h.id === withCost.id)!;
  check("Annual fee 60.000, cost ≈ 18.800 (50 USD)", [row.annualFeeBhdCents, row.annualCostBhdCents], [bhd(60), 18800]);
  const typed = await hosting.createHostingSubscription({ clientId, item: "domain", amountCents: bhd(10), currency: "BHD", cycle: "annual", costPerYearCents: bhd(4), costCurrency: "BHD" });
  check("…or a typed yearly cost", (await hosting.listHostingSubscriptions()).find((h) => h.id === typed.id)?.annualCostBhdCents, bhd(4));

  section("Items 15, 17 — venture expenses and stored exchange rates");
  const [venture] = await query<{ id: string }>("insert into ventures (name, slug) values ('Tbadel', 'tbadel-verify') returning id");
  const usd = await expenses.createExpense({ description: "Tbadel app store fee", category: "software subscription", amountCents: 9900, currency: "USD", amountBhdCents: bhd(37.5), spentOn: "2026-09-02", linkedVentureId: venture!.id }, by);
  check("The BHD amount actually charged is kept, with its rate", [usd.amountBhdCents, usd.fxRate], [bhd(37.5), 0.378788]);
  const pegged = await expenses.createExpense({ description: "Tbadel domain", category: "hosting", amountCents: 1000, currency: "USD", spentOn: "2026-09-03", linkedVentureId: venture!.id }, by);
  check("…or the official peg when not given", pegged.amountBhdCents, 3760);
  const spend = await expenses.getVentureSpend(venture!.id);
  check("Venture page total = 41.260", spend.allTimeBhdCents, bhd(41.26));

  section("Item 16 — reimbursing a partner");
  const jassim = t.jassimId;
  const owed = await one<{ id: string }>("select id from expenses where paid_by_party_id = $1 and reimbursement_status = 'pending'", [jassim]);
  const beforeBal = (await ledger.getCompanyBalanceBhd(todayYmd()))!.balanceBhdCents;
  await expenses.reimburseExpense(owed!.id, { paidOn: todayYmd() }, by);
  const after = (await ledger.getPartyBalances()).partners.find((p) => p.party.id === jassim)!;
  check("Nothing left to reimburse", after.reimbursementDueBhdCents, 0);
  check("The reimbursement leaves the account", (await ledger.getCompanyBalanceBhd(todayYmd()))!.balanceBhdCents, beforeBal - bhd(3));

  section("Item 20 — deletes are blocked while money is recorded");
  const prj = await query<{ id: string }>("select id from projects where name = 'PRJ-001'");
  await rejects("A project with invoices can't be deleted", () => deleteProject(prj[0]!.id), /archive/i);
  await rejects("A client with invoices can't be deleted", () => deleteClient(clientId), /documents?/);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
