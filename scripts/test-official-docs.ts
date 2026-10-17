/**
 * Checks for official documents (PRD addendum 1.2, section 11): numbering,
 * signatories and their snapshot, signing only as yourself with your
 * password, no stored signature, locking and versions, the terms library
 * and its snapshots, the server fee and its hosting subscription, the
 * shared link, and quote amounts staying out of the accounts.
 *
 *   npm run test:official-docs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "newmux-official-"));
delete process.env.DATABASE_URL;
delete process.env.GITHUB_TOKEN;
process.env.AUTH_SECRET ??= "test-secret-for-official-documents-0000";

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
}
const section = (title: string) => console.log(`\n${title}`);
async function rejects(name: string, fn: () => Promise<unknown>, pattern: RegExp) {
  try {
    await fn();
    check(name, false, "didn't throw");
  } catch (e) {
    check(name, pattern.test((e as Error).message), (e as Error).message);
  }
}

/** A stand-in for the PDF the browser makes: a real header, and bytes we can find again. */
const fakePdf = (marker: string) => new TextEncoder().encode(`%PDF-1.4\n% ${marker}\n%%EOF`);

async function main() {
  const { query } = await import("../lib/db");
  const { many, one } = await import("../lib/data/sql");
  const docs = await import("../lib/data/documents");
  const official = await import("../lib/data/officialDocs");
  const signatories = await import("../lib/data/signatories");
  const terms = await import("../lib/data/terms");
  const finance = await import("../lib/data/finance");
  const { readTicket, signTicket } = await import("../lib/crypto/issueToken");
  const { createUser } = await import("../lib/data/users");
  const bcrypt = (await import("bcryptjs")).default;

  const jassim = (await one<{ id: string }>("select id from users where email = 'info@newmux.com'"))!;
  const mohammed = (await one<{ id: string }>("select id from users where email = 'm4ahmed7@gmail.com'"))!;
  const PASSWORD = "changeme123";
  const year = new Date().toISOString().slice(0, 4);
  const [client] = await query<{ id: string }>("insert into clients (name) values ('Voya') returning id");
  const clientId = client!.id;

  // The yearly sequences carry on from the numbers used before (the seed starts Quotation at #2606, Invoice at #00265).
  const seq = async (type: string) => (await one<{ lastValue: number }>("select last_value from doc_sequences where doc_type = $1 and year = $2", [type, Number(year)]))?.lastValue ?? 0;
  const next = async (code: string, type: string) => `NMX/${code}/${year}/${String((await seq(type)) + 1).padStart(3, "0")}`;
  const quoteNo = await next("QTN", "quote");
  const issue = async (id: string, who: string, opts: { sign?: boolean; password?: string } = {}) => {
    const { token, data } = await official.startIssue(id, { id: who }, { sign: opts.sign ?? true, password: opts.password ?? PASSWORD });
    return { doc: await official.finishIssue(id, { id: who }, token, fakePdf(data.number!)), data };
  };
  const quote = (extra: Record<string, unknown> = {}) =>
    docs.createDocument({
      type: "quote",
      clientId,
      currency: "BHD",
      taxRateBps: 0,
      title: "Voya booking platform",
      lineItems: [{ description: "Design and development", quantity: 1, unitPriceCents: 1_250_000 }],
      createdBy: jassim.id,
      ...extra,
    });

  section("Signatories (section 4)");
  const list = await signatories.listSignatories();
  check("Jassim and Mohammed are set up, Jassim by default", list.length === 2 && (await signatories.defaultSignatoryFor("quote"))?.fullName === "Jassim Baqer");
  const q1 = await quote();
  check("A new quote takes the default signatory", q1.signatoryId === list.find((s) => s.fullName === "Jassim Baqer")!.id);
  check("A draft has no number yet", docs.isDraftNumber(q1.documentNumber), q1.documentNumber);
  check("It's valid for 14 days by default", !!q1.validUntil);

  section("Signing (section 5)");
  await rejects("A quote can't be issued without signing", () => docs.transitionDocumentStatus(q1.id, "sent", jassim.id), /issued by signing/);
  await rejects("Nobody else can sign as Jassim", () => official.startIssue(q1.id, { id: mohammed.id }, { sign: true, password: PASSWORD }), /Only Jassim Baqer can sign/);
  await rejects("The password is checked again", () => official.startIssue(q1.id, { id: jassim.id }, { sign: true, password: "wrong" }), /password/);
  await rejects("Not without a password", () => official.startIssue(q1.id, { id: jassim.id }, { sign: true }), /password/);
  const { token, data } = await official.startIssue(q1.id, { id: jassim.id }, { sign: true, password: PASSWORD });
  check("Starting fixes the number: the next in the sequence, as NMX/QTN/YYYY/NNN", data.number === quoteNo && /^NMX\/QTN\/\d{4}\/\d{3,}$/.test(quoteNo), `${data.number} vs ${quoteNo}`);
  check("…and the signatory snapshot on the printed data", data.signatory?.name === "Jassim Baqer" && data.signatory.position === "Co-founder & COO");
  await rejects("The ticket is for that person only", () => official.finishIssue(q1.id, { id: mohammed.id }, token, fakePdf("x")), /expired/);
  const forged = await signTicket({ ...(await readTicket(token))!, d: "00000000-0000-0000-0000-000000000000" });
  await rejects("…and that document only", () => official.finishIssue(q1.id, { id: jassim.id }, forged, fakePdf("x")), /expired/);
  check("A tampered ticket doesn't read", (await readTicket(`${token.slice(0, -3)}abc`)) === null);
  check("An expired one doesn't either", (await readTicket(await signTicket({ ...(await readTicket(token))!, e: Date.now() - 1 }))) === null);
  await rejects("Only a PDF is accepted", () => official.finishIssue(q1.id, { id: jassim.id }, token, new TextEncoder().encode("<html>")), /isn't a PDF/);
  const issued = await official.finishIssue(q1.id, { id: jassim.id }, token, fakePdf("q1"));
  check("Issued and signed", issued.status === "sent" && !!(await docs.getDocumentById(q1.id))!.signedAt);
  const stored = await official.getIssuedPdf(q1.id);
  check("The PDF is stored as signed, with its SHA-256", !!stored && new TextDecoder().decode(stored.data).includes("q1") && stored.sha256.length === 64);
  const audit = await one<{ summary: string }>("select summary from audit_log where entity_id = $1 and summary like 'Signed and issued%'", [q1.id]);
  check("The audit log says who signed, the number and the hash", !!audit && audit.summary.includes(quoteNo) && audit.summary.includes("Jassim Baqer") && audit.summary.includes(stored!.sha256));
  const columns = await many<{ tableName: string; columnName: string }>(
    "select table_name, column_name from information_schema.columns where table_schema = 'public' and (column_name ilike '%signature%' or (column_name = 'data' and table_name not in ('file_blobs', 'document_pdfs')))",
  );
  check("No column anywhere holds a reusable signature", columns.length === 0, JSON.stringify(columns));
  await rejects("A ticket can't be used twice", () => official.finishIssue(q1.id, { id: jassim.id }, token, fakePdf("again")), /changed since/);

  section("Locked after issue, versions (sections 5.2, 8.2)");
  await rejects("A signed document can't be edited", () => docs.updateDocument(q1.id, { title: "Changed" }, jassim.id), /locked/);
  await rejects("…or moved back to draft", () => docs.transitionDocumentStatus(q1.id, "draft", jassim.id), /can't go from|signed/);
  await signatories.updateSignatory(list.find((s) => s.fullName === "Jassim Baqer")!.id, { fullName: "Jassim Baqer", position: "CEO & Co-founder", userId: jassim.id, isActive: true, defaultFor: ["quote", "letter"] }, jassim.id);
  const after = (await docs.getDocumentById(q1.id))!;
  check("Changing the position later doesn't change what was signed", after.signatoryPosition === "Co-founder & COO");
  const rev = await official.reviseDocument(q1.id, jassim.id);
  check("Revising makes a draft version 2 linked to the original", rev.status === "draft" && rev.version === 2 && rev.previousVersionId === q1.id);
  check("…with the same content", rev.title === "Voya booking platform" && (await docs.getLineItems(rev.id)).length === 1);
  check("Revising again returns the same open draft", (await official.reviseDocument(q1.id, jassim.id)).id === rev.id);
  await docs.updateDocument(rev.id, { title: "Voya booking platform v2" }, jassim.id);
  const r = await issue(rev.id, jassim.id);
  check("The revision takes the original's number with -R1", r.doc.documentNumber === `${quoteNo}-R1`, r.doc.documentNumber);
  check("…and the new position", r.data.signatory?.position === "CEO & Co-founder");
  const orig = (await docs.getDocumentById(q1.id))!;
  check("The original is voided, pointing at its replacement", orig.status === "void" && !!orig.voidReason?.includes("-R1"));
  check("The original's PDF is still kept", !!(await official.getIssuedPdf(q1.id)));
  check("Its shared link stops working", (await official.getSharedPdf(orig.shareToken!)) === "void");
  check("Versions list both", (await official.listVersions(rev.id)).map((v) => v.version).join() === "1,2");
  await rejects("A signed document can't be purged", () => docs.deleteDocument(q1.id, jassim.id), /stays on record/);
  const q2 = await quote();
  const expected2 = await next("QTN", "quote");
  const i2 = await issue(q2.id, jassim.id);
  check("The sequence carries on, and a revision used none of it", i2.doc.documentNumber === expected2 && Number(expected2.split("/")[3]) === Number(quoteNo.split("/")[3]) + 1, i2.doc.documentNumber);

  section("Letters and invoices");
  const letter = await docs.createDocument({ type: "letter", taxRateBps: 0, lineItems: [{ description: "x", quantity: 1, unitPriceCents: 5 }], createdBy: jassim.id, title: "Meeting follow-up" });
  check("A letter needs no client and carries no money", letter.clientId === null && letter.totalCents === 0 && (await docs.getLineItems(letter.id)).length === 0);
  await rejects("It can't be issued without a recipient and body", () => official.startIssue(letter.id, { id: jassim.id }, { sign: true, password: PASSWORD }), /who the letter is to/);
  await docs.updateDocument(letter.id, { recipient: "Mr. Ali\nCEO, Voya\nKingdom of Bahrain", body: "Dear Mr. Ali,\n\nThank you.\n\nKind regards," }, jassim.id);
  const l = await issue(letter.id, jassim.id);
  check("Letters are numbered NMX/LTR/YYYY/001", l.doc.documentNumber === `NMX/LTR/${year}/001`, l.doc.documentNumber);
  check("Drafts used no numbers", (await seq("quote")) === Number(expected2.split("/")[3]));
  check("Letters appear in the list without a client", (await docs.listDocuments({ type: "letter" })).length === 1);
  const invNo = await next("INV", "invoice");
  const inv = await docs.createDocument({ type: "invoice", clientId, taxRateBps: 0, lineItems: [{ description: "Work", quantity: 1, unitPriceCents: 500_000 }], createdBy: jassim.id });
  await docs.transitionDocumentStatus(inv.id, "sent", jassim.id);
  check("An invoice can still be issued unsigned (hosting fees do this), taking NMX/INV", (await docs.getDocumentById(inv.id))!.documentNumber === invNo, invNo);
  const unsignedQuote = await quote();
  await rejects("Quotes can't be issued unsigned", () => official.startIssue(unsignedQuote.id, { id: jassim.id }, { sign: false }), /has to be signed/);

  section("Terms & Conditions library (section 6)");
  const erp = (await terms.listTermsTemplates()).find((t) => t.name === "ERP System")!;
  check("Starter templates are seeded at version 1", erp.version === 1 && erp.clauses.length === 11);
  const q3 = await quote({ terms: { templateId: erp.id, templateName: erp.name, version: erp.version, clauses: erp.clauses.slice(0, 3).map((c) => ({ title: c.title, body: c.body })) } });
  await docs.updateDocument(q3.id, { terms: { templateId: erp.id, templateName: erp.name, version: 1, clauses: [{ title: "Scope", body: "Edited for this document only." }] } }, jassim.id);
  check("Editing a document's clauses doesn't touch the template", (await terms.getTermsTemplate(erp.id))!.clauses[0]!.body === erp.clauses[0]!.body);
  await issue(q3.id, jassim.id);
  const saved = await terms.saveTermsTemplate(erp.id, { name: "ERP System", isActive: true, clauses: [{ title: "New", body: "New master text.", defaultOn: true }] }, jassim.id);
  check("Saving changed text makes version 2", saved.version === 2);
  check("…and keeps every version", (await terms.listTemplateVersions(erp.id)).map((v) => v.version).join() === "2,1");
  check("An issued document keeps its terms", (await docs.getDocumentById(q3.id))!.terms!.clauses[0]!.body === "Edited for this document only.");
  const unchanged = await terms.saveTermsTemplate(erp.id, { name: "ERP System", isActive: false, clauses: [{ title: "New", body: "New master text.", defaultOn: true }] }, jassim.id);
  check("Hiding a template isn't a new version", unchanged.version === 2 && !unchanged.isActive);
  await rejects("Template names are unique", () => terms.saveTermsTemplate(null, { name: "saas", isActive: true, clauses: [] }, jassim.id), /already a template/);
  const pdfData = await official.officialPdfData(q3.id);
  check("The printed terms are the document's own", pdfData.terms?.clauses[0]?.body === "Edited for this document only.");

  section("Server fee (section 7) and the accounts");
  const before = await finance.getErpDashboardSummary();
  const q4 = await quote({ serverFee: { amountCents: 90_000, cycle: "quarterly", clientChooses: true, label: null }, paymentTerms: "50% on approval. IBAN {iban}." });
  check("The fee sits outside the total", q4.totalCents === 1_250_000 && q4.serverFeeCents === 90_000);
  const printed = await official.officialPdfData(q4.id);
  check("…prints as its own section", printed.serverFee?.amountCents === 90_000 && printed.serverFee.cycle === "quarterly" && printed.serverFee.clientChooses);
  check("{iban} becomes the company IBAN", !!printed.paymentTerms?.includes("BH96 ALSA 0032 3942 1001 00"));
  await issue(q4.id, jassim.id);
  await docs.transitionDocumentStatus(q4.id, "accepted", jassim.id);
  const afterQuote = await finance.getErpDashboardSummary();
  check("Quote amounts stay out of the accounts", JSON.stringify(afterQuote) === JSON.stringify(before));
  const contract = await official.convertToContract(q4.id, jassim.id);
  const sub = await one<{ amountCents: number; cycle: string; item: string }>("select amount_cents, cycle, item from hosting_subscriptions where id = $1", [contract.serverFeeSubscriptionId]);
  check("Converting to a contract creates the hosting subscription", !!sub && sub.amountCents === 90_000 && sub.cycle === "quarterly" && sub.item === "server");
  check("…and carries the content", contract.title === "Voya booking platform" && contract.serverFeeCents === 90_000 && contract.convertedFromQuotationId === q4.id);
  await rejects("Only once", () => official.convertToContract(q4.id, jassim.id), /already a contract/);
  await docs.updateDocument(contract.id, { serverFee: { amountCents: 120_000, cycle: "annual", clientChooses: false } }, jassim.id);
  check("Changing the fee on the contract leaves the subscription unless confirmed", (await one<{ amountCents: number }>("select amount_cents from hosting_subscriptions where id = $1", [contract.serverFeeSubscriptionId]))!.amountCents === 90_000);
  await docs.updateDocument(contract.id, { serverFee: { amountCents: 150_000, cycle: "annual", clientChooses: false }, applyFeeToSubscription: true }, jassim.id);
  check("…and updates it when confirmed", (await one<{ amountCents: number; cycle: string }>("select amount_cents, cycle from hosting_subscriptions where id = $1", [contract.serverFeeSubscriptionId]))!.cycle === "annual");
  await rejects("Mohammed can't sign the contract as Jassim", () => official.startIssue(contract.id, { id: mohammed.id }, { sign: true, password: PASSWORD }), /Only Jassim/);
  const ctrNo = await next("CTR", "contract");
  const c = await issue(contract.id, jassim.id);
  check("Contracts are numbered NMX/CTR/YYYY/NNN", c.doc.documentNumber === ctrNo, `${c.doc.documentNumber} vs ${ctrNo}`);
  const invFromQuote = await docs.convertQuotationToInvoice(q4.id, jassim.id, { mode: "deposit", depositPercent: 50 });
  check("Invoicing the quote reuses the same subscription", !!invFromQuote.id && (await docs.getDocumentById(invFromQuote.id))!.serverFeeSubscriptionId === contract.serverFeeSubscriptionId);
  check("Only one subscription was made", (await many("select id from hosting_subscriptions where label like 'Server and hosting (NMX/QTN%'")).length === 1);

  section("Sending (section 3, step 7)");
  const sent = await official.markSent(q2.id, "whatsapp", jassim.id);
  check("Sending records the time and channel and gives the link", !!sent.document.sentAt && sent.document.sentVia === "whatsapp" && !!sent.sharePath?.startsWith("/d/"));
  const shared = await official.getSharedPdf(sent.sharePath!.slice(3));
  check("The link serves the issued PDF", !!shared && shared !== "void" && new TextDecoder().decode(shared.data).startsWith("%PDF-"));
  check("A made-up link finds nothing", (await official.getSharedPdf("0".repeat(48))) === undefined && (await official.getSharedPdf("../etc")) === undefined);
  await rejects("A draft can't be sent", async () => official.markSent((await quote()).id, "email", jassim.id), /Issue it first/);

  section("Other logins");
  const dev = await createUser({ email: "dev@newmux.test", fullName: "Dana", role: "lead_dev", passwordHash: await bcrypt.hash("devpass1234", 4) });
  const s = await signatories.createSignatory({ fullName: "Dana", position: "Developer", userId: dev.id, isActive: true, defaultFor: [] }, jassim.id);
  const q5 = await quote({ signatoryId: s.id });
  await rejects("A partner can't sign for someone else even with their own password", () => official.startIssue(q5.id, { id: jassim.id }, { sign: true, password: PASSWORD }), /Only Dana/);
  await signatories.updateSignatory(s.id, { fullName: "Dana", position: "Developer", userId: dev.id, isActive: false, defaultFor: [] }, jassim.id);
  await rejects("An inactive signatory can't sign", () => official.startIssue(q5.id, { id: dev.id }, { sign: true, password: "devpass1234" }), /no longer active/);
  check("…but is kept for old documents", !!(await signatories.getSignatory(s.id)));

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
