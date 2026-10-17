import bcrypt from "bcryptjs";
import { query, tx } from "@/lib/db";
import { many, must, one, ValidationError } from "./sql";
import { logAudit } from "./audit";
import { getCompanyDetails } from "./company";
import { getSignatory } from "./signatories";
import { createDocument, getDocumentById, getLineItems, isDraftNumber, numberForIssue, transitionDocumentStatus, DEFAULT_VALIDITY_DAYS } from "./documents";
import type { DocumentRecord, Payment } from "./types";
import { DOC_TYPE, MUST_SIGN, NO_MONEY } from "@/lib/labels";
import { addDaysYmd, todayYmd, toYmd } from "@/lib/time";
import { ISSUE_TICKET_MINUTES, readTicket, sha256Hex, signTicket } from "@/lib/crypto/issueToken";
import type { OfficialPdfData } from "@/lib/pdf/officialTypes";

/**
 * Issuing, revising, converting and sending official documents (PRD
 * addendum 1.2, sections 3, 5, 7 and 8).
 *
 * Signing never stores a signature. Step one (startIssue) checks that the
 * person is the one linked to the chosen signatory and asks for their
 * password again, then fixes the number and the signatory snapshot. The
 * browser draws the signature onto the PDF and step two (finishIssue)
 * stores that PDF as the unchangeable record of what was signed, with its
 * SHA-256 in the audit log. The drawn image exists only inside that PDF.
 */

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Fills {iban} in payment terms and clauses. */
const fill = (text: string | null, iban: string) => (text ? text.replace(/\{iban\}/gi, iban) : text);

export async function officialPdfData(documentId: string, opts: { statement?: boolean } = {}): Promise<OfficialPdfData> {
  const doc = await must<DocumentRecord>("Document", "select * from documents where id = $1", [documentId]);
  const [lineItems, company, client, contact, signatory, creditFor, payments, credited] = await Promise.all([
    getLineItems(documentId),
    getCompanyDetails(),
    doc.clientId ? one<{ name: string; billingAddress: string | null }>("select name, billing_address from clients where id = $1", [doc.clientId]) : undefined,
    doc.clientId
      ? one<{ fullName: string }>("select full_name from contacts where client_id = $1 order by is_primary desc, created_at limit 1", [doc.clientId])
      : undefined,
    !doc.signedAt && doc.signatoryId ? getSignatory(doc.signatoryId) : undefined,
    doc.creditForId ? one<{ documentNumber: string }>("select document_number from documents where id = $1", [doc.creditForId]) : undefined,
    opts.statement && doc.type === "invoice" ? many<Payment>("select * from payments where document_id = $1 order by paid_on", [documentId]) : Promise.resolve(null),
    doc.type === "invoice"
      ? one<{ cents: number }>("select coalesce(sum(total_cents), 0)::int8 as cents from documents where credit_for_id = $1 and type = 'credit_note' and status not in ('draft', 'void')", [documentId])
      : undefined,
  ]);
  const number = isDraftNumber(doc.documentNumber) ? null : doc.documentNumber;
  return {
    kind: "official",
    filename: `${(number ?? `Draft ${DOC_TYPE[doc.type]}`).replace(/\//g, "-")}.pdf`,
    id: doc.id,
    type: doc.type,
    status: doc.status,
    number,
    version: doc.version,
    externalRef: doc.externalRef,
    title: doc.title,
    overview: doc.overview,
    scope: doc.scope ?? [],
    recipient: doc.recipient,
    body: fill(doc.body, company.iban),
    date: doc.issuedAt ? toYmd(doc.issuedAt) : todayYmd(),
    validUntil: doc.validUntil,
    dueAt: doc.dueAt,
    client: client ? { name: client.name, contactName: contact?.fullName ?? null, address: client.billingAddress } : null,
    currency: doc.currency,
    lineItems: lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPriceCents: li.unitPriceCents })),
    subtotalCents: doc.subtotalCents,
    taxRateBps: doc.taxRateBps,
    taxCents: doc.taxCents,
    totalCents: doc.totalCents,
    paymentTerms: fill(doc.paymentTerms, company.iban),
    notes: doc.notes,
    terms: doc.terms?.clauses.length ? { templateName: doc.terms.templateName, clauses: doc.terms.clauses.map((c) => ({ title: c.title, body: fill(c.body, company.iban)! })) } : null,
    serverFee:
      doc.serverFeeCents !== null && doc.serverFeeCycle
        ? { amountCents: doc.serverFeeCents, cycle: doc.serverFeeCycle, clientChooses: doc.serverFeeClientChooses, label: doc.serverFeeLabel }
        : null,
    signatory: doc.signatoryName
      ? { name: doc.signatoryName, position: doc.signatoryPosition ?? "" }
      : signatory
        ? { name: signatory.fullName, position: signatory.position }
        : null,
    signed: !!doc.signedAt,
    creditFor: creditFor?.documentNumber ?? null,
    payments: payments ? payments.map((p) => ({ paidOn: p.paidOn, amountCents: p.amountCents, method: p.method })) : null,
    paidCents: (payments ?? []).reduce((s, p) => s + p.amountCents, 0),
    creditedCents: credited?.cents ?? 0,
    company,
  };
}

/** What a draft still needs before it can be issued. */
function missing(doc: DocumentRecord, lineCount: number): string | null {
  if (doc.type === "letter") {
    if (!doc.recipient?.trim()) return "Add who the letter is to.";
    if (!doc.title?.trim()) return "Add the letter's subject.";
    if (!doc.body?.trim()) return "Write the letter.";
    return null;
  }
  if (!doc.clientId) return "Choose the client.";
  if (!NO_MONEY.includes(doc.type) && doc.type !== "proposal" && lineCount === 0) return "Add at least one item.";
  if ((doc.type === "quote" || doc.type === "proposal" || doc.type === "contract") && !doc.title?.trim()) return "Give it a title (the project name).";
  if (doc.type === "proposal" && !doc.overview?.trim()) return "Write the overview.";
  if ((doc.type === "quote" || doc.type === "proposal") && doc.validUntil && doc.validUntil < todayYmd()) return "The validity date has passed. Set a new one.";
  return null;
}

/**
 * Step one of issuing. Signing: only the login linked to the chosen
 * signatory, with their password. Unsigned: invoices and credit notes only.
 * Returns the ticket for step two and the document as it will be printed.
 */
export async function startIssue(
  documentId: string,
  user: { id: string },
  opts: { sign: boolean; password?: string },
): Promise<{ token: string; data: OfficialPdfData }> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new ValidationError("That document no longer exists.");
  if (doc.status !== "draft") throw new ValidationError("It's already issued.");
  if (!opts.sign && MUST_SIGN.includes(doc.type)) throw new ValidationError(`A ${DOC_TYPE[doc.type].toLowerCase()} has to be signed to be issued.`);
  const problem = missing(doc, (await getLineItems(documentId)).length);
  if (problem) throw new ValidationError(problem);

  let snapshot: { name: string; position: string } | null = null;
  if (opts.sign) {
    if (!doc.signatoryId) throw new ValidationError("Choose who signs it.");
    const signatory = await getSignatory(doc.signatoryId);
    if (!signatory?.isActive) throw new ValidationError("That signatory is no longer active. Choose another.");
    // Signing is tied to the person's own login and can't be delegated (sections 5.2 and 10).
    if (signatory.userId !== user.id) throw new ValidationError(`Only ${signatory.fullName} can sign as ${signatory.fullName}. Choose yourself as the signatory, or ask them to sign it.`);
    const me = await one<{ passwordHash: string }>("select password_hash from users where id = $1 and is_active", [user.id]);
    if (!opts.password || !me || !(await bcrypt.compare(opts.password, me.passwordHash))) throw new ValidationError("That password isn't right.");
    snapshot = { name: signatory.fullName, position: signatory.position };
  }

  const updated = await tx(async () => {
    const number = await numberForIssue(doc);
    const offer = doc.type === "quote" || doc.type === "proposal";
    return must<DocumentRecord>(
      "Document",
      `update documents set document_number = $2,
         issued_at = (current_date + time '12:00') at time zone 'Asia/Bahrain',
         signatory_name = $3, signatory_position = $4,
         valid_until = case when $5::boolean and valid_until is null then $6::date else valid_until end,
         updated_at = now()
       where id = $1 and status = 'draft' returning *`,
      [documentId, number, snapshot?.name ?? null, snapshot?.position ?? null, offer, addDaysYmd(todayYmd(), DEFAULT_VALIDITY_DAYS)],
    );
  });
  const token = await signTicket({ d: documentId, u: user.id, n: updated.documentNumber, t: updated.updatedAt, s: opts.sign, e: Date.now() + ISSUE_TICKET_MINUTES * 60_000 });
  return { token, data: await officialPdfData(documentId) };
}

/**
 * Step two: stores the PDF the browser made (with the drawn signature) as
 * the issued record, and issues the document. A revision replaces the
 * version it revises, which is voided.
 */
export async function finishIssue(documentId: string, user: { id: string }, token: string, pdf: Uint8Array): Promise<DocumentRecord> {
  const ticket = await readTicket(token);
  if (!ticket || ticket.d !== documentId || ticket.u !== user.id) throw new ValidationError("The signing session expired. Sign it again.");
  if (pdf.byteLength > MAX_PDF_BYTES) throw new ValidationError("The PDF is too large.");
  if (new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-") throw new ValidationError("That isn't a PDF.");
  const sha = await sha256Hex(pdf);
  const shareToken = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");

  const issued = await tx(async () => {
    const doc = await must<DocumentRecord>("Document", "select * from documents where id = $1 for update", [documentId]);
    if (doc.status !== "draft" || doc.documentNumber !== ticket.n || doc.updatedAt !== ticket.t) {
      throw new ValidationError("It changed since you started. Sign it again.");
    }
    await query("delete from document_pdfs where document_id = $1", [documentId]);
    await query("insert into document_pdfs (document_id, data, sha256, size_bytes) values ($1, $2, $3, $4)", [documentId, Buffer.from(pdf), sha, pdf.byteLength]);
    await query(
      `update documents set signed_by = $2, signed_at = case when $3::boolean then now() end, pdf_sha256 = $4, share_token = $5
       where id = $1`,
      [documentId, ticket.s ? user.id : null, ticket.s, sha, shareToken],
    );
    const result = await transitionDocumentStatus(documentId, "sent", user.id, { issuing: true });
    await logAudit({
      entityType: "document",
      entityId: documentId,
      action: "update",
      summary: ticket.s
        ? `Signed and issued ${doc.documentNumber} as ${doc.signatoryName}, ${doc.signatoryPosition} (SHA-256 ${sha})`
        : `Issued ${doc.documentNumber} unsigned (SHA-256 ${sha})`,
      changedBy: user.id,
    });
    if (doc.previousVersionId) {
      const prev = await one<DocumentRecord>("select * from documents where id = $1", [doc.previousVersionId]);
      if (prev && !["draft", "void"].includes(prev.status)) {
        await transitionDocumentStatus(prev.id, "void", user.id, { reason: `Replaced by ${doc.documentNumber}.` });
      }
    }
    return result;
  });
  return issued;
}

/** The stored PDF of an issued document. */
export async function getIssuedPdf(documentId: string): Promise<{ number: string; data: Uint8Array; sha256: string } | undefined> {
  const row = await one<{ documentNumber: string; data: Uint8Array; sha256: string }>(
    "select d.document_number, p.data, p.sha256 from document_pdfs p join documents d on d.id = p.document_id where p.document_id = $1",
    [documentId],
  );
  return row ? { number: row.documentNumber, data: new Uint8Array(row.data), sha256: row.sha256 } : undefined;
}

/** The PDF behind a link sent to a client. Gone once the document is voided. */
export async function getSharedPdf(shareToken: string): Promise<{ number: string; data: Uint8Array } | "void" | undefined> {
  if (!/^[0-9a-f]{48}$/.test(shareToken)) return undefined;
  const row = await one<{ documentNumber: string; status: string; data: Uint8Array }>(
    "select d.document_number, d.status, p.data from documents d join document_pdfs p on p.document_id = d.id where d.share_token = $1",
    [shareToken],
  );
  if (!row) return undefined;
  if (row.status === "void") return "void";
  return { number: row.documentNumber, data: new Uint8Array(row.data) };
}

/** Records that it went to the client, and returns the link to send. */
export async function markSent(documentId: string, via: "email" | "whatsapp" | "download" | "other", by: string): Promise<{ sharePath: string | null; document: DocumentRecord }> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new ValidationError("That document no longer exists.");
  if (["draft", "void"].includes(doc.status)) throw new ValidationError(doc.status === "draft" ? "Issue it first." : "It's void.");
  const updated = await must<DocumentRecord>("Document", "update documents set sent_at = coalesce(sent_at, now()), sent_via = $2 where id = $1 returning *", [documentId, via]);
  await logAudit({ entityType: "document", entityId: documentId, action: "update", summary: `Sent ${doc.documentNumber} by ${via === "whatsapp" ? "WhatsApp" : via}`, changedBy: by });
  return { sharePath: updated.shareToken ? `/d/${updated.shareToken}` : null, document: updated };
}

/**
 * A new version of an issued document, as a draft with the same content. It
 * gets its original's number with -R1, -R2… when issued, and the original
 * is voided then. An open revision is reused.
 */
export async function reviseDocument(documentId: string, by: string): Promise<DocumentRecord> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new ValidationError("That document no longer exists.");
  if (["draft", "void"].includes(doc.status)) throw new ValidationError(doc.status === "draft" ? "It's a draft: edit it directly." : "It's void.");
  if (doc.type === "invoice" || doc.type === "credit_note") {
    const moved = await one("select 1 from payments where document_id = $1 union all select 1 from documents where credit_for_id = $1 and status <> 'void' limit 1", [documentId]);
    if (moved) throw new ValidationError("It has payments or credit notes. Issue a credit note instead of revising it.");
  }
  const open = await one<DocumentRecord>("select * from documents where previous_version_id = $1 and status = 'draft'", [documentId]);
  if (open) return open;
  return tx(async () => {
    const draft = await must<DocumentRecord>(
      "Document",
      `insert into documents (type, client_id, product_id, project_id, deal_id, profit_split_rule_id, converted_from_quotation_id, document_number,
         currency, subtotal_cents, tax_rate_bps, tax_cents, total_cents, payment_terms, notes, due_at, issued_at, external_ref, credit_for_id,
         hosting_subscription_id, created_by, title, overview, scope, recipient, body, valid_until, signatory_id, terms,
         server_fee_cents, server_fee_cycle, server_fee_client_chooses, server_fee_label, server_fee_subscription_id, version, previous_version_id)
       select type, client_id, product_id, project_id, deal_id, profit_split_rule_id, converted_from_quotation_id, $2,
         currency, subtotal_cents, tax_rate_bps, tax_cents, total_cents, payment_terms, notes, due_at, now(), external_ref, credit_for_id,
         hosting_subscription_id, $3, title, overview, scope, recipient, body,
         case when valid_until is not null and valid_until < current_date then null else valid_until end, signatory_id, terms,
         server_fee_cents, server_fee_cycle, server_fee_client_chooses, server_fee_label, server_fee_subscription_id, version + 1, id
       from documents where id = $1 returning *`,
      [documentId, `Draft-REV-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, by],
    );
    await query(
      `insert into document_line_items (document_id, description, quantity, unit_price_cents, sort_order)
       select $2, description, quantity, unit_price_cents, sort_order from document_line_items where document_id = $1`,
      [documentId, draft.id],
    );
    await query("insert into document_status_history (document_id, from_status, to_status, changed_by) values ($1, null, 'draft', $2)", [draft.id, by]);
    await logAudit({ entityType: "document", entityId: draft.id, action: "create", summary: `Started revision ${draft.version} of ${doc.documentNumber}`, changedBy: by });
    return draft;
  });
}

/** Every version of a document, oldest first. */
export async function listVersions(documentId: string): Promise<{ id: string; documentNumber: string; version: number; status: string; signedAt: string | null }[]> {
  return many(
    `with recursive back as (
       select id, previous_version_id from documents where id = $1
       union all select d.id, d.previous_version_id from documents d join back b on d.id = b.previous_version_id
     ), root as (select id from back where previous_version_id is null limit 1),
     fwd as (
       select id from root
       union all select d.id from documents d join fwd f on d.previous_version_id = f.id
     )
     select d.id, d.document_number, d.version, d.status, d.signed_at from documents d where d.id in (select id from fwd) order by d.version, d.created_at`,
    [documentId],
  );
}

/**
 * The server fee becomes a hosting subscription when a quote is converted
 * (section 7.2), once: later conversions reuse it.
 */
export async function ensureServerFeeSubscription(source: DocumentRecord, targetId: string, by: string): Promise<string | null> {
  if (source.serverFeeCents === null || !source.serverFeeCycle || !source.clientId) return null;
  let id = source.serverFeeSubscriptionId;
  if (!id) {
    const sub = await must<{ id: string }>(
      "Subscription",
      `insert into hosting_subscriptions (client_id, project_id, item, label, amount_cents, currency, cycle, next_due_date, status)
       values ($1, $2, 'server', $3, $4, $5, $6, $7, 'active') returning id`,
      [source.clientId, source.projectId, source.serverFeeLabel ?? `Server and hosting (${source.documentNumber})`, source.serverFeeCents, source.currency, source.serverFeeCycle, todayYmd()],
    );
    id = sub.id;
    await logAudit({ entityType: "hosting_subscription", entityId: id, action: "create", summary: `Server fee from ${source.documentNumber}`, changedBy: by });
    await query("update documents set server_fee_subscription_id = $2 where id = $1", [source.id, id]);
  }
  await query("update documents set server_fee_subscription_id = $2 where id = $1", [targetId, id]);
  return id;
}

/** An accepted quote or proposal becomes a contract with the same content (section 8.2). */
export async function convertToContract(sourceId: string, by: string): Promise<DocumentRecord> {
  const source = await getDocumentById(sourceId);
  if (!source) throw new ValidationError("That document no longer exists.");
  if (source.type !== "quote" && source.type !== "proposal") throw new ValidationError("Only quotes and proposals become contracts.");
  if (source.status !== "accepted") throw new ValidationError("Mark it accepted first.");
  const existing = await one<{ documentNumber: string }>(
    "select document_number from documents where converted_from_quotation_id = $1 and type = 'contract' and status <> 'void' limit 1",
    [sourceId],
  );
  if (existing) throw new ValidationError(`It's already a contract (${existing.documentNumber}).`);
  const lineItems = await getLineItems(sourceId);
  return tx(async () => {
    const contract = await createDocument({
      type: "contract",
      clientId: source.clientId,
      productId: source.productId,
      projectId: source.projectId,
      dealId: source.dealId,
      currency: source.currency,
      taxRateBps: source.taxRateBps,
      paymentTerms: source.paymentTerms,
      notes: source.notes,
      lineItems: lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPriceCents: li.unitPriceCents })),
      title: source.title,
      overview: source.overview,
      scope: source.scope,
      terms: source.terms,
      serverFee: source.serverFeeCents !== null && source.serverFeeCycle ? { amountCents: source.serverFeeCents, cycle: source.serverFeeCycle, clientChooses: source.serverFeeClientChooses, label: source.serverFeeLabel } : null,
      createdBy: by,
    });
    await query("update documents set converted_from_quotation_id = $2 where id = $1", [contract.id, source.id]);
    await ensureServerFeeSubscription(source, contract.id, by);
    await logAudit({ entityType: "document", entityId: contract.id, action: "create", summary: `Created a contract from ${source.documentNumber}`, changedBy: by });
    return (await getDocumentById(contract.id))!;
  });
}
