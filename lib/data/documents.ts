import { query, tx } from "@/lib/db";
import { many, one, must, NotFoundError, ValidationError } from "./sql";
import { logAudit } from "./audit";
import type { Currency, Deal, DocumentLineItem, DocumentRecord, DocumentStatus, DocumentStatusHistoryEntry, DocumentTerms, DocumentType, RecurringExpenseCycle, ScopeItem } from "./types";
import { defaultSignatoryFor } from "./signatories";
import { centsToDisplay, subtotalCents as calcSubtotal, taxCents as calcTax, totalCents as calcTotal } from "@/lib/money";
import { canTransition } from "@/lib/validators/document";
import { addDaysYmd, todayYmd } from "@/lib/time";
import { DOC_STATUS, DOC_TYPE, MUST_SIGN, NO_MONEY, isDraftNumber } from "@/lib/labels";

export { listClients, getClientById, createClient, listProducts } from "./clients";

/** NMX/QTN/2026/001 and so on (PRD addendum 1.2, section 2.3). */
export const DOC_CODE: Record<DocumentType, string> = { quote: "QTN", proposal: "PRJ", contract: "CTR", invoice: "INV", credit_note: "CRN", letter: "LTR" };

/**
 * Drafts consume no number: they carry a placeholder until they're issued.
 * Documents numbered before this (QUO-2026-0004, INV-2026-0012) keep their
 * numbers, and the yearly sequence carries on from them.
 */
export { isDraftNumber };
const draftNumber = (type: DocumentType) => `Draft-${DOC_CODE[type]}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

/** Atomic, per-type, per-year numbering — safe across processes and restarts. */
async function nextDocumentNumber(type: DocumentType): Promise<string> {
  const year = Number(todayYmd().slice(0, 4));
  const [row] = await query<{ last_value: number }>(
    `insert into doc_sequences (doc_type, year, last_value) values ($1, $2, 1)
     on conflict (doc_type, year) do update set last_value = doc_sequences.last_value + 1
     returning last_value`,
    [type, year],
  );
  return `NMX/${DOC_CODE[type]}/${year}/${String(row!.last_value).padStart(3, "0")}`;
}

/** The number a draft takes when it's issued: the next in its sequence, or for a revision its original's number with -R1, -R2… */
export async function numberForIssue(doc: DocumentRecord): Promise<string> {
  if (!isDraftNumber(doc.documentNumber)) return doc.documentNumber;
  if (doc.previousVersionId) {
    const prev = await one<{ documentNumber: string }>("select document_number from documents where id = $1", [doc.previousVersionId]);
    if (prev && !isDraftNumber(prev.documentNumber)) return `${prev.documentNumber.replace(/-R\d+$/, "")}-R${doc.version - 1}`;
  }
  return nextDocumentNumber(doc.type);
}

/** YYYY-MM-DD → noon in Bahrain, so the stored instant can never slip to another day. */
const ISSUE_DATE_SQL = (param: string) => `((${param})::date + time '12:00') at time zone 'Asia/Bahrain'`;

export type DocumentListItem = DocumentRecord & {
  /** Null for a letter to someone who isn't a client. */
  clientName: string | null;
  clientShortName: string | null;
  projectName: string | null;
  paidCents: number;
  /** Issued credit notes against this invoice. */
  creditedCents: number;
};

export async function listDocuments(filter: {
  type?: DocumentType;
  clientId?: string;
  projectId?: string;
  dealId?: string;
  status?: DocumentStatus;
  /** Invoices made from this quote, and credit notes against this invoice. */
  derivedFrom?: string;
} = {}): Promise<DocumentListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (filter.type) add("d.type = ?", filter.type);
  if (filter.clientId) add("d.client_id = ?", filter.clientId);
  if (filter.projectId) add("d.project_id = ?", filter.projectId);
  if (filter.dealId) add("d.deal_id = ?", filter.dealId);
  if (filter.status) add("d.status = ?", filter.status);
  if (filter.derivedFrom) {
    params.push(filter.derivedFrom);
    where.push(`(d.converted_from_quotation_id = $${params.length} or d.credit_for_id = $${params.length})`);
  }
  return many<DocumentListItem>(
    `select d.*, c.name as client_name, c.short_name as client_short_name, p.name as project_name,
       coalesce((select sum(pay.amount_cents) from payments pay where pay.document_id = d.id), 0)::int8 as paid_cents,
       coalesce((select sum(cn.total_cents) from documents cn
                 where cn.credit_for_id = d.id and cn.type = 'credit_note' and cn.status not in ('draft', 'void')), 0)::int8 as credited_cents
     from documents d left join clients c on c.id = d.client_id left join projects p on p.id = d.project_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by coalesce(d.issued_at, d.created_at) desc, d.created_at desc`,
    params,
  );
}

export async function getDocumentById(id: string): Promise<DocumentRecord | undefined> {
  return one<DocumentRecord>("select * from documents where id = $1", [id]);
}

export async function getLineItems(documentId: string): Promise<DocumentLineItem[]> {
  return many<DocumentLineItem>("select * from document_line_items where document_id = $1 order by sort_order", [documentId]);
}

type LineItemInput = { description: string; quantity: number; unitPriceCents: number };

async function replaceLineItems(documentId: string, lineItems: LineItemInput[]) {
  await query("delete from document_line_items where document_id = $1", [documentId]);
  for (const [i, li] of lineItems.entries()) {
    await query(
      "insert into document_line_items (document_id, description, quantity, unit_price_cents, sort_order) values ($1, $2, $3, $4, $5)",
      [documentId, li.description, li.quantity, li.unitPriceCents, i],
    );
  }
}

async function recordStatus(documentId: string, from: DocumentStatus | null, to: DocumentStatus, by: string | null) {
  await query(
    "insert into document_status_history (document_id, from_status, to_status, changed_by) values ($1, $2, $3, $4)",
    [documentId, from, to, by],
  );
}

/** A credit note can't take an invoice below zero. */
async function assertCreditFits(creditForId: string, totalCents: number, currency: Currency, excludeId?: string) {
  const invoice = await must<DocumentRecord>("Invoice", "select * from documents where id = $1", [creditForId]);
  if (invoice.type !== "invoice") throw new ValidationError("A credit note must point at an invoice.");
  if (["draft", "void"].includes(invoice.status)) throw new ValidationError(`${invoice.documentNumber} hasn't been issued, so there's nothing to credit.`);
  if (invoice.currency !== currency) throw new ValidationError(`Use ${invoice.currency}, the currency of ${invoice.documentNumber}.`);
  const other = await one<{ cents: number }>(
    `select coalesce(sum(total_cents), 0)::int8 as cents from documents
     where credit_for_id = $1 and type = 'credit_note' and status <> 'void' and id <> coalesce($2::uuid, '00000000-0000-0000-0000-000000000000')`,
    [creditForId, excludeId ?? null],
  );
  const room = invoice.totalCents - (other?.cents ?? 0);
  if (totalCents > room) throw new ValidationError(`Only ${centsToDisplay(room, currency)} of ${invoice.documentNumber} is left to credit.`);
  return invoice;
}

/** Content of official documents (PRD addendum 1.2), shared by create and update. */
export type OfficialFields = {
  title?: string | null;
  overview?: string | null;
  scope?: ScopeItem[];
  recipient?: string | null;
  body?: string | null;
  validUntil?: string | null;
  signatoryId?: string | null;
  terms?: DocumentTerms | null;
  /** null removes it. */
  serverFee?: { amountCents: number; cycle: RecurringExpenseCycle; clientChooses: boolean; label?: string | null } | null;
};

/** Quotes and proposals stand for 14 days unless set otherwise (section 8.2). */
export const DEFAULT_VALIDITY_DAYS = 14;

/** What each type needs before it can be saved. Letters have no money; proposals may leave the investment out. */
function checkContent(type: DocumentType, input: { clientId?: string | null; lineItems: LineItemInput[] }) {
  if (type !== "letter" && !input.clientId) throw new ValidationError("Choose the client.");
  if (!NO_MONEY.includes(type) && type !== "proposal" && input.lineItems.length === 0) throw new ValidationError("Add at least one item.");
}

export async function createDocument(
  input: {
    type: DocumentType;
    clientId?: string | null;
    productId?: string | null;
    projectId?: string | null;
    dealId?: string | null;
    currency?: Currency;
    taxRateBps: number;
    paymentTerms?: string | null;
    notes?: string | null;
    dueAt?: string | null;
    issuedAt?: string | null;
    externalRef?: string | null;
    creditForId?: string | null;
    hostingSubscriptionId?: string | null;
    lineItems: LineItemInput[];
    createdBy: string;
  } & OfficialFields,
): Promise<DocumentRecord> {
  return tx(async () => {
    const lineItems = NO_MONEY.includes(input.type) ? [] : input.lineItems;
    checkContent(input.type, { clientId: input.clientId, lineItems });
    const subtotal = calcSubtotal(lineItems);
    const tax = calcTax(subtotal, input.taxRateBps);
    const total = calcTotal(subtotal, tax);
    if (input.type === "credit_note") {
      if (!input.creditForId) throw new ValidationError("Choose the invoice this credit note is for.");
      const invoice = await assertCreditFits(input.creditForId, total, input.currency ?? "BHD");
      input = { ...input, clientId: invoice.clientId, projectId: invoice.projectId };
    }
    // Invoices inherit the project's default profit-split rule (PRD 5.3.1).
    // Quotations never carry one — they create no financial entry (PRD 5.4).
    let profitSplitRuleId: string | null = null;
    if (input.type === "invoice" && input.projectId) {
      const project = await one<{ profitSplitRuleId: string | null }>("select profit_split_rule_id from projects where id = $1", [input.projectId]);
      profitSplitRuleId = project?.profitSplitRuleId ?? null;
    }
    const issuedAt = input.issuedAt ?? todayYmd();
    const offer = input.type === "quote" || input.type === "proposal";
    const signatoryId = input.signatoryId !== undefined ? input.signatoryId : ((await defaultSignatoryFor(input.type))?.id ?? null);
    const fee = feeColumns(input.serverFee);
    const doc = await must<DocumentRecord>(
      "Document",
      `insert into documents (type, client_id, product_id, project_id, deal_id, profit_split_rule_id, document_number,
         currency, subtotal_cents, tax_rate_bps, tax_cents, total_cents, payment_terms, notes, due_at, issued_at,
         external_ref, credit_for_id, hosting_subscription_id, created_by,
         title, overview, scope, recipient, body, valid_until, signatory_id, terms,
         server_fee_cents, server_fee_cycle, server_fee_client_chooses, server_fee_label)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, ${ISSUE_DATE_SQL("$16")}, $17,$18,$19,$20,
         $21, $22, $23::jsonb, $24, $25, $26, $27, $28::jsonb, $29, $30, $31, $32) returning *`,
      [
        input.type,
        input.clientId ?? null,
        input.productId ?? null,
        input.projectId ?? null,
        input.dealId ?? null,
        profitSplitRuleId,
        draftNumber(input.type),
        input.currency ?? "BHD",
        subtotal,
        input.taxRateBps,
        tax,
        total,
        input.paymentTerms ?? null,
        input.notes ?? null,
        input.dueAt ?? null,
        issuedAt,
        input.externalRef ?? null,
        input.creditForId ?? null,
        input.hostingSubscriptionId ?? null,
        input.createdBy,
        input.title ?? null,
        input.overview ?? null,
        JSON.stringify(input.scope ?? []),
        input.recipient ?? null,
        input.body ?? null,
        input.validUntil ?? (offer ? addDaysYmd(issuedAt, DEFAULT_VALIDITY_DAYS) : null),
        signatoryId,
        input.terms ? JSON.stringify(input.terms) : null,
        ...fee,
      ],
    );
    await replaceLineItems(doc.id, lineItems);
    await recordStatus(doc.id, null, "draft", input.createdBy);
    // Item 37: every quote sits in the pipeline.
    if (doc.type === "quote") return { ...doc, dealId: await ensureDealForQuote(doc, input.title ?? lineItems[0]?.description, input.createdBy) };
    return doc;
  });
}

function feeColumns(fee: OfficialFields["serverFee"]): [number | null, RecurringExpenseCycle | null, boolean, string | null] {
  if (!fee) return [null, null, false, null];
  return [fee.amountCents, fee.cycle, fee.clientChooses, fee.label?.trim() || null];
}

/**
 * Header fields and line items. Money-shaping fields (line items, tax,
 * currency, client) are locked once a document leaves draft; notes, terms,
 * the due date, the issue date and the external reference stay editable
 * until it is voided.
 */
export async function updateDocument(
  documentId: string,
  patch: {
    lineItems?: LineItemInput[];
    taxRateBps?: number;
    currency?: Currency;
    clientId?: string;
    projectId?: string | null;
    paymentTerms?: string | null;
    notes?: string | null;
    dueAt?: string | null;
    issuedAt?: string | null;
    externalRef?: string | null;
    /** The fee changed on a document whose fee is already a hosting subscription: update the subscription too (section 7.2). */
    applyFeeToSubscription?: boolean;
  } & OfficialFields,
  changedBy: string,
): Promise<DocumentRecord> {
  return tx(async () => {
    const doc = await must<DocumentRecord>("Document", "select * from documents where id = $1 for update", [documentId]);
    if (doc.status === "void") throw new ValidationError("Void documents can't be edited.");
    // Signed is locked: what was signed can't change (section 5.2). A change is a new version.
    const printed = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined && !["projectId", "externalRef", "applyFeeToSubscription"].includes(k));
    if (doc.signedAt && printed.length) throw new ValidationError("It's signed, so it's locked. Revise it to make a new version.");
    const official: (keyof OfficialFields)[] = ["title", "overview", "scope", "recipient", "body", "validUntil", "signatoryId", "terms", "serverFee"];
    const locked =
      patch.lineItems !== undefined || patch.taxRateBps !== undefined || patch.currency !== undefined || patch.clientId !== undefined || official.some((k) => patch[k] !== undefined);
    if (locked && doc.status !== "draft") {
      throw new ValidationError("The content, line items, tax, currency and client can only be changed while the document is a draft.");
    }
    if (patch.lineItems && NO_MONEY.includes(doc.type)) patch = { ...patch, lineItems: [] };
    if (patch.lineItems || patch.clientId !== undefined) checkContent(doc.type, { clientId: patch.clientId !== undefined ? patch.clientId : doc.clientId, lineItems: patch.lineItems ?? [{ description: "x", quantity: 1, unitPriceCents: 0 }] });
    if (doc.status === "archived" && (patch.projectId !== undefined || patch.dueAt !== undefined || patch.paymentTerms !== undefined)) {
      throw new ValidationError("Archived documents only allow the issue date, reference and notes to change.");
    }

    if (patch.lineItems) await replaceLineItems(documentId, patch.lineItems);
    const items = patch.lineItems ?? (await getLineItems(documentId));
    const taxRateBps = patch.taxRateBps ?? doc.taxRateBps;
    const subtotal = calcSubtotal(items);
    const tax = calcTax(subtotal, taxRateBps);
    if (doc.type === "credit_note" && doc.creditForId && patch.lineItems) {
      await assertCreditFits(doc.creditForId, calcTotal(subtotal, tax), patch.currency ?? doc.currency, doc.id);
    }

    const updated = await must<DocumentRecord>(
      "Document",
      `update documents set
         tax_rate_bps = $2, subtotal_cents = $3, tax_cents = $4, total_cents = $5,
         currency = coalesce($6, currency), client_id = coalesce($7, client_id),
         project_id = case when $8::boolean then $9::uuid else project_id end,
         payment_terms = case when $10::boolean then $11 else payment_terms end,
         notes = case when $12::boolean then $13 else notes end,
         due_at = case when $14::boolean then $15::date else due_at end,
         issued_at = case when $16::boolean then ${ISSUE_DATE_SQL("$17")} else issued_at end,
         external_ref = case when $18::boolean then $19 else external_ref end,
         updated_at = now()
       where id = $1 returning *`,
      [
        documentId,
        taxRateBps,
        subtotal,
        tax,
        calcTotal(subtotal, tax),
        patch.currency ?? null,
        patch.clientId ?? null,
        patch.projectId !== undefined,
        patch.projectId ?? null,
        patch.paymentTerms !== undefined,
        patch.paymentTerms ?? null,
        patch.notes !== undefined,
        patch.notes ?? null,
        patch.dueAt !== undefined,
        patch.dueAt ?? null,
        patch.issuedAt !== undefined && patch.issuedAt !== null,
        patch.issuedAt ?? todayYmd(),
        patch.externalRef !== undefined,
        patch.externalRef ?? null,
      ],
    );
    // A draft invoice moved to another project follows that project's rule, unless it has its own.
    if (doc.type === "invoice" && patch.projectId !== undefined && patch.projectId !== doc.projectId) {
      await query(
        `update documents set profit_split_rule_id = (select profit_split_rule_id from projects where id = $2)
         where id = $1 and not exists (select 1 from profit_split_rules where scope_type = 'document' and scope_id = $1)`,
        [documentId, patch.projectId],
      );
    }
    let result = updated;
    if (official.some((k) => patch[k] !== undefined)) result = await writeOfficialFields(documentId, patch, changedBy);
    if (doc.type === "quote" && updated.dealId && updated.totalCents !== doc.totalCents) await syncDealValue(updated);
    await logAudit({ entityType: "document", entityId: documentId, action: "update", summary: `Edited ${doc.documentNumber}`, changedBy });
    return result;
  });
}

async function writeOfficialFields(documentId: string, patch: OfficialFields & { applyFeeToSubscription?: boolean }, by: string): Promise<DocumentRecord> {
  const doc = await must<DocumentRecord>("Document", "select * from documents where id = $1", [documentId]);
  const set: string[] = [];
  const values: unknown[] = [documentId];
  const put = (col: string, v: unknown, cast = "") => {
    values.push(v);
    set.push(`${col} = $${values.length}${cast}`);
  };
  if (patch.title !== undefined) put("title", patch.title);
  if (patch.overview !== undefined) put("overview", patch.overview);
  if (patch.scope !== undefined) put("scope", JSON.stringify(patch.scope), "::jsonb");
  if (patch.recipient !== undefined) put("recipient", patch.recipient);
  if (patch.body !== undefined) put("body", patch.body);
  if (patch.validUntil !== undefined) put("valid_until", patch.validUntil);
  if (patch.signatoryId !== undefined) put("signatory_id", patch.signatoryId);
  if (patch.terms !== undefined) put("terms", patch.terms ? JSON.stringify(patch.terms) : null, "::jsonb");
  if (patch.serverFee !== undefined) {
    const [cents, cycle, chooses, label] = feeColumns(patch.serverFee);
    put("server_fee_cents", cents);
    put("server_fee_cycle", cycle);
    put("server_fee_client_chooses", chooses);
    put("server_fee_label", label);
    const changed = cents !== doc.serverFeeCents || cycle !== doc.serverFeeCycle;
    if (changed && doc.serverFeeSubscriptionId && patch.applyFeeToSubscription && cents !== null && cycle) {
      await query("update hosting_subscriptions set amount_cents = $2, cycle = $3, currency = $4 where id = $1", [doc.serverFeeSubscriptionId, cents, cycle, doc.currency]);
      await logAudit({ entityType: "hosting_subscription", entityId: doc.serverFeeSubscriptionId, action: "update", summary: `Server fee changed on ${doc.documentNumber}`, changedBy: by });
    }
  }
  return must<DocumentRecord>("Document", `update documents set ${set.join(", ")}, updated_at = now() where id = $1 returning *`, values);
}

export async function transitionDocumentStatus(
  documentId: string,
  to: DocumentStatus,
  changedBy: string | null,
  opts: { reason?: string | null; issuing?: boolean } = {},
): Promise<DocumentRecord> {
  return tx(async () => {
    const doc = await must<DocumentRecord>("Document", "select * from documents where id = $1 for update", [documentId]);
    if (doc.status === to) return doc;
    if (doc.status === "draft" && to === "sent" && !opts.issuing) {
      if (MUST_SIGN.includes(doc.type)) throw new ValidationError(`A ${DOC_TYPE[doc.type].toLowerCase()} is issued by signing it. Open it and choose Sign and Issue.`);
      // Invoices and credit notes can be issued unsigned (hosting fees are issued this way): they take their number now.
      if (isDraftNumber(doc.documentNumber)) {
        await query("update documents set document_number = $2 where id = $1", [documentId, await numberForIssue(doc)]);
      }
    }
    if (doc.signedAt && to === "draft") throw new ValidationError("It's signed. Void it, or revise it to make a new version.");
    if (!canTransition(doc.type, doc.status, to)) {
      throw new ValidationError(`A ${DOC_TYPE[doc.type].toLowerCase()} can't go from ${DOC_STATUS[doc.status].label} to ${DOC_STATUS[to].label}.`);
    }
    if (to === "void" && !opts.reason?.trim()) throw new ValidationError("Give a reason for voiding.");
    if (to === "draft" && doc.type === "invoice") {
      const paid = await one("select 1 from payments where document_id = $1 limit 1", [documentId]);
      if (paid) throw new ValidationError("This invoice has payments. Remove them before moving it back to draft.");
    }
    if (to === "void" && doc.type === "invoice") {
      const credit = await one<{ documentNumber: string }>(
        "select document_number from documents where credit_for_id = $1 and status not in ('draft', 'void') limit 1",
        [documentId],
      );
      if (credit) throw new ValidationError(`Void credit note ${credit.documentNumber} first.`);
    }
    const updated = await must<DocumentRecord>(
      "Document",
      `update documents set status = $2::document_status, updated_at = now(),
         issued_at = case when $2::document_status = 'sent' and issued_at is null then now() else issued_at end,
         accepted_at = case when $2::document_status = 'accepted' then now() else accepted_at end,
         archived_at = case when $2::document_status = 'archived' then now() else archived_at end,
         voided_at = case when $2::document_status = 'void' then now() else voided_at end,
         void_reason = case when $2::document_status = 'void' then $3 else void_reason end
       where id = $1 returning *`,
      [documentId, to, opts.reason?.trim() ?? null],
    );
    await recordStatus(documentId, doc.status, to, changedBy);
    if (to === "void") {
      await logAudit({ entityType: "document", entityId: documentId, action: "update", summary: `Voided ${doc.documentNumber}: ${opts.reason!.trim()}`, changedBy });
    }
    // A credit note that is issued or voided changes what its invoice still owes.
    if (doc.type === "credit_note" && doc.creditForId && (to === "sent" || to === "void")) {
      const { syncInvoicePaidStatus } = await import("./finance");
      await syncInvoicePaidStatus(doc.creditForId, changedBy);
    }
    if (doc.type === "quote" && updated.dealId) await syncDealStage(updated, changedBy);
    return updated;
  });
}

/**
 * Drafts can be deleted. Void documents can be purged by a partner (test
 * data, item 9); everything else is voided instead, so the books keep it.
 */
export async function deleteDocument(documentId: string, deletedBy: string): Promise<void> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new NotFoundError("Document");
  if (doc.status !== "draft" && doc.status !== "void") throw new ValidationError("Only drafts can be deleted. Void a sent document instead.");
  // What was signed stays on record (PRD addendum 1.2, section 5.2).
  if (doc.signedAt) throw new ValidationError("It was signed, so it stays on record. It's void and left out of every total.");
  const dependants = await one<{ documentNumber: string }>(
    "select document_number from documents where credit_for_id = $1 or converted_from_quotation_id = $1 limit 1",
    [documentId],
  );
  if (doc.status === "void" && dependants) throw new ValidationError(`${dependants.documentNumber} was made from this document. Purge that first.`);
  await tx(async () => {
    await query("update hosting_subscriptions set linked_invoice_id = null where linked_invoice_id = $1", [documentId]);
    await query("delete from documents where id = $1", [documentId]);
  });
  await logAudit({
    entityType: "document",
    entityId: documentId,
    action: "delete",
    summary: doc.status === "void" ? `Purged void ${doc.documentNumber}${doc.voidReason ? ` (${doc.voidReason})` : ""}` : `Deleted draft ${doc.documentNumber}`,
    changedBy: deletedBy,
  });
}

export async function getStatusHistory(documentId: string): Promise<(DocumentStatusHistoryEntry & { changedByName: string | null })[]> {
  return many(
    `select h.*, u.full_name as changed_by_name from document_status_history h
     left join users u on u.id = h.changed_by
     where h.document_id = $1 order by h.changed_at, h.from_status is not null, h.id`,
    [documentId],
  );
}

// --- Quotation → Invoice conversion (PRD 5.4, item 34) ---

/** How much of a quote is already invoiced (non-void invoices made from it). */
export async function quoteInvoicedCents(quoteId: string): Promise<number> {
  const row = await one<{ cents: number }>(
    "select coalesce(sum(total_cents), 0)::int8 as cents from documents where converted_from_quotation_id = $1 and type = 'invoice' and status <> 'void'",
    [quoteId],
  );
  return row?.cents ?? 0;
}

/**
 * Invoices an accepted quote in full, as a deposit (a percentage of the
 * quote), or for whatever is left after earlier invoices.
 */
export async function convertQuotationToInvoice(
  quotationId: string,
  convertedBy: string,
  opts: { mode?: "full" | "deposit" | "balance"; depositPercent?: number } = {},
): Promise<DocumentRecord> {
  const quote = await getDocumentById(quotationId);
  if (!quote) throw new NotFoundError("Quotation");
  // Quotes and contracts (PRD addendum 1.2, section 8.2) become invoices.
  if (quote.type !== "quote" && quote.type !== "contract") throw new ValidationError("Only quotations and contracts can be converted to invoices.");
  if (["void", "declined", "draft"].includes(quote.status)) throw new ValidationError(`This ${DOC_TYPE[quote.type].toLowerCase()} is ${DOC_STATUS[quote.status].label.toLowerCase()}.`);
  const invoiced = await quoteInvoicedCents(quotationId);
  const left = quote.totalCents - invoiced;
  const mode = opts.mode ?? (invoiced > 0 ? "balance" : "full");
  if (left <= 0) {
    const existing = await one<{ documentNumber: string }>(
      "select document_number from documents where converted_from_quotation_id = $1 and status <> 'void' order by created_at desc limit 1",
      [quotationId],
    );
    throw new ValidationError(`Already invoiced in full${existing ? ` (${existing.documentNumber})` : ""}.`);
  }
  if (mode === "full" && invoiced > 0) throw new ValidationError("Part of this quote is already invoiced. Invoice the remaining balance instead.");

  return tx(async () => {
    const lineItems = await getLineItems(quotationId);
    const ref = quote.externalRef ? `${quote.documentNumber} (${quote.externalRef})` : quote.documentNumber;
    let items: LineItemInput[];
    let taxRateBps = quote.taxRateBps;
    if (mode === "full") {
      items = lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPriceCents: li.unitPriceCents }));
    } else {
      // Deposit/balance lines are tax-inclusive slices of the quote total.
      const pct = Math.min(Math.max(opts.depositPercent ?? 50, 1), 100);
      const amount = mode === "deposit" ? Math.min(Math.round((quote.totalCents * pct) / 100), left) : left;
      items = [{ description: mode === "deposit" ? `${pct}% deposit for ${ref}` : `Balance for ${ref}`, quantity: 1, unitPriceCents: amount }];
      taxRateBps = 0;
    }
    const invoice = await createDocument({
      type: "invoice",
      clientId: quote.clientId,
      productId: quote.productId,
      projectId: quote.projectId,
      dealId: quote.dealId,
      currency: quote.currency,
      taxRateBps,
      paymentTerms: quote.paymentTerms,
      notes: quote.notes,
      lineItems: items,
      title: quote.title,
      createdBy: convertedBy,
    });
    await query("update documents set converted_from_quotation_id = $2 where id = $1", [invoice.id, quote.id]);
    // The server fee isn't on the invoice: it becomes its own hosting subscription (section 7.2).
    const { ensureServerFeeSubscription } = await import("./officialDocs");
    await ensureServerFeeSubscription(quote, invoice.id, convertedBy);
    await logAudit({
      entityType: "document",
      entityId: invoice.id,
      action: "create",
      summary: `Created an invoice (${mode === "full" ? "in full" : mode === "deposit" ? "deposit" : "balance"}) from ${DOC_TYPE[quote.type].toLowerCase()} ${quote.documentNumber}`,
      changedBy: convertedBy,
    });
    return { ...invoice, convertedFromQuotationId: quote.id };
  });
}

// --- Pipeline ⇄ quotes (item 37) ---

async function ensureDealForQuote(doc: DocumentRecord, firstLine: string | undefined, by: string): Promise<string> {
  if (doc.dealId) {
    await syncDealValue(doc);
    return doc.dealId;
  }
  const { createDeal } = await import("./crm");
  const project = doc.projectId ? await one<{ name: string }>("select name from projects where id = $1", [doc.projectId]) : undefined;
  const deal = await createDeal(
    {
      title: project?.name ?? firstLine ?? `Quote ${doc.documentNumber}`,
      clientId: doc.clientId,
      stage: "qualified",
      valueCents: doc.totalCents,
      currency: doc.currency,
      notes: `From quote ${doc.documentNumber}.`,
    },
    by,
  );
  await query("update documents set deal_id = $2 where id = $1", [doc.id, deal.id]);
  if (doc.projectId) await query("update deals set project_id = $2 where id = $1", [deal.id, doc.projectId]);
  return deal.id;
}

/** An open deal carries its quote's value. */
async function syncDealValue(doc: DocumentRecord) {
  await query(
    "update deals set value_cents = $2, currency = $3, updated_at = now() where id = $1 and stage not in ('won', 'lost')",
    [doc.dealId, doc.totalCents, doc.currency],
  );
}

/** Sent → Proposal, Accepted → Won (at the quote's value), Declined → Lost. */
async function syncDealStage(doc: DocumentRecord, by: string | null) {
  const deal = await one<Deal>("select * from deals where id = $1", [doc.dealId]);
  if (!deal) return;
  const { moveDealStage } = await import("./crm");
  const who = by ?? deal.ownerId ?? deal.createdBy ?? "";
  if (doc.status === "sent" && ["lead", "qualified"].includes(deal.stage)) {
    await syncDealValue(doc);
    await moveDealStage(deal.id, "proposal", who);
  } else if (doc.status === "accepted" && deal.stage !== "won") {
    await query("update deals set value_cents = $2, currency = $3 where id = $1", [deal.id, doc.totalCents, doc.currency]);
    await moveDealStage(deal.id, "won", who);
  } else if (doc.status === "declined" && !["won", "lost"].includes(deal.stage)) {
    await moveDealStage(deal.id, "lost", who, { lostReason: `Quote ${doc.documentNumber} declined` });
  }
}
