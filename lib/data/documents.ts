import { query, tx } from "@/lib/db";
import { many, one, must, NotFoundError, ValidationError } from "./sql";
import { logAudit } from "./audit";
import type { Currency, DocumentLineItem, DocumentRecord, DocumentStatus, DocumentStatusHistoryEntry, DocumentType } from "./types";
import { subtotalCents as calcSubtotal, taxCents as calcTax, totalCents as calcTotal } from "@/lib/money";
import { canTransition } from "@/lib/validators/document";
import { todayYmd } from "@/lib/time";

export { listClients, getClientById, createClient, listProducts } from "./clients";

const PREFIX: Record<DocumentType, string> = { quote: "QUO", contract: "CON", invoice: "INV" };

/** Atomic, per-type, per-year numbering — safe across processes and restarts. */
async function nextDocumentNumber(type: DocumentType): Promise<string> {
  const year = Number(todayYmd().slice(0, 4));
  const [row] = await query<{ last_value: number }>(
    `insert into doc_sequences (doc_type, year, last_value) values ($1, $2, 1)
     on conflict (doc_type, year) do update set last_value = doc_sequences.last_value + 1
     returning last_value`,
    [type, year],
  );
  return `${PREFIX[type]}-${year}-${String(row!.last_value).padStart(4, "0")}`;
}

export type DocumentListItem = DocumentRecord & { clientName: string; paidCents: number };

export async function listDocuments(filter: {
  type?: DocumentType;
  clientId?: string;
  projectId?: string;
  dealId?: string;
  status?: DocumentStatus;
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
  return many<DocumentListItem>(
    `select d.*, c.name as client_name,
       coalesce((select sum(p.amount_cents) from payments p where p.document_id = d.id), 0)::int8 as paid_cents
     from documents d join clients c on c.id = d.client_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by d.created_at desc`,
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

export async function createDocument(input: {
  type: DocumentType;
  clientId: string;
  productId?: string | null;
  projectId?: string | null;
  dealId?: string | null;
  currency?: Currency;
  taxRateBps: number;
  paymentTerms?: string | null;
  notes?: string | null;
  dueAt?: string | null;
  lineItems: LineItemInput[];
  createdBy: string;
}): Promise<DocumentRecord> {
  return tx(async () => {
    const subtotal = calcSubtotal(input.lineItems);
    const tax = calcTax(subtotal, input.taxRateBps);
    // Invoices inherit the project's default profit-split rule (PRD 5.3.1).
    // Quotations never carry one — they create no financial entry (PRD 5.4).
    let profitSplitRuleId: string | null = null;
    if (input.type === "invoice" && input.projectId) {
      const project = await one<{ profitSplitRuleId: string | null }>(
        "select profit_split_rule_id from projects where id = $1",
        [input.projectId],
      );
      profitSplitRuleId = project?.profitSplitRuleId ?? null;
    }
    const documentNumber = await nextDocumentNumber(input.type);
    const doc = await must<DocumentRecord>(
      "Document",
      `insert into documents (type, client_id, product_id, project_id, deal_id, profit_split_rule_id, document_number,
         currency, subtotal_cents, tax_rate_bps, tax_cents, total_cents, payment_terms, notes, due_at, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`,
      [
        input.type,
        input.clientId,
        input.productId ?? null,
        input.projectId ?? null,
        input.dealId ?? null,
        profitSplitRuleId,
        documentNumber,
        input.currency ?? "BHD",
        subtotal,
        input.taxRateBps,
        tax,
        calcTotal(subtotal, tax),
        input.paymentTerms ?? null,
        input.notes ?? null,
        input.dueAt ?? null,
        input.createdBy,
      ],
    );
    await replaceLineItems(doc.id, input.lineItems);
    await recordStatus(doc.id, null, "draft", input.createdBy);
    return doc;
  });
}

/**
 * Header fields and line items. Money-shaping fields (line items, tax,
 * currency, client) are locked once a document leaves draft; notes, terms
 * and the due date stay editable until it is archived.
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
  },
  changedBy: string,
): Promise<DocumentRecord> {
  return tx(async () => {
    const doc = await must<DocumentRecord>("Document", "select * from documents where id = $1 for update", [documentId]);
    if (doc.status === "archived") throw new ValidationError("Archived documents can't be edited.");
    const locked = patch.lineItems !== undefined || patch.taxRateBps !== undefined || patch.currency !== undefined || patch.clientId !== undefined;
    if (locked && doc.status !== "draft") {
      throw new ValidationError("Line items, tax, currency and client can only be changed while the document is a draft.");
    }

    if (patch.lineItems) await replaceLineItems(documentId, patch.lineItems);
    const items = patch.lineItems ?? (await getLineItems(documentId));
    const taxRateBps = patch.taxRateBps ?? doc.taxRateBps;
    const subtotal = calcSubtotal(items);
    const tax = calcTax(subtotal, taxRateBps);

    const updated = await must<DocumentRecord>(
      "Document",
      `update documents set
         tax_rate_bps = $2, subtotal_cents = $3, tax_cents = $4, total_cents = $5,
         currency = coalesce($6, currency), client_id = coalesce($7, client_id),
         project_id = case when $8::boolean then $9::uuid else project_id end,
         payment_terms = case when $10::boolean then $11 else payment_terms end,
         notes = case when $12::boolean then $13 else notes end,
         due_at = case when $14::boolean then $15::date else due_at end,
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
      ],
    );
    await logAudit({
      entityType: "document",
      entityId: documentId,
      action: "update",
      summary: `Edited ${doc.documentNumber}`,
      changedBy,
    });
    return updated;
  });
}

export async function transitionDocumentStatus(documentId: string, to: DocumentStatus, changedBy: string | null): Promise<DocumentRecord> {
  return tx(async () => {
    const doc = await must<DocumentRecord>("Document", "select * from documents where id = $1 for update", [documentId]);
    if (doc.status === to) return doc;
    if (!canTransition(doc.status, to)) {
      throw new ValidationError(`Can't move ${doc.documentNumber} from ${doc.status} to ${to}.`);
    }
    const updated = await must<DocumentRecord>(
      "Document",
      `update documents set status = $2::document_status, updated_at = now(),
         issued_at = case when $2::document_status = 'sent' and issued_at is null then now() else issued_at end,
         accepted_at = case when $2::document_status = 'accepted' then now() else accepted_at end,
         paid_at = case when $2::document_status = 'paid' then now() else paid_at end,
         archived_at = case when $2::document_status = 'archived' then now() else archived_at end
       where id = $1 returning *`,
      [documentId, to],
    );
    await recordStatus(documentId, doc.status, to, changedBy);
    return updated;
  });
}

/** Only drafts can be deleted; anything that has been sent is archived instead. */
export async function deleteDocument(documentId: string, deletedBy: string): Promise<void> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new NotFoundError("Document");
  if (doc.status !== "draft") throw new ValidationError("Only drafts can be deleted — archive sent documents instead.");
  await query("delete from documents where id = $1", [documentId]);
  await logAudit({ entityType: "document", entityId: documentId, action: "delete", summary: `Deleted draft ${doc.documentNumber}`, changedBy: deletedBy });
}

export async function getStatusHistory(documentId: string): Promise<(DocumentStatusHistoryEntry & { changedByName: string | null })[]> {
  return many(
    `select h.*, u.full_name as changed_by_name from document_status_history h
     left join users u on u.id = h.changed_by
     where h.document_id = $1 order by h.changed_at, h.id`,
    [documentId],
  );
}

// --- Quotation → Invoice conversion (PRD 5.4) ---

export async function convertQuotationToInvoice(quotationId: string, convertedBy: string): Promise<DocumentRecord> {
  const quote = await getDocumentById(quotationId);
  if (!quote) throw new NotFoundError("Quotation");
  if (quote.type !== "quote") throw new ValidationError("Only quotations can be converted to invoices.");
  const existing = await one<{ documentNumber: string }>(
    "select document_number from documents where converted_from_quotation_id = $1 and status <> 'archived'",
    [quotationId],
  );
  if (existing) throw new ValidationError(`Already converted to ${existing.documentNumber}.`);

  return tx(async () => {
    const lineItems = await getLineItems(quotationId);
    const invoice = await createDocument({
      type: "invoice",
      clientId: quote.clientId,
      productId: quote.productId,
      projectId: quote.projectId,
      dealId: quote.dealId,
      currency: quote.currency,
      taxRateBps: quote.taxRateBps,
      paymentTerms: quote.paymentTerms,
      notes: quote.notes,
      lineItems: lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPriceCents: li.unitPriceCents })),
      createdBy: convertedBy,
    });
    await query("update documents set converted_from_quotation_id = $2 where id = $1", [invoice.id, quote.id]);
    await logAudit({
      entityType: "document",
      entityId: invoice.id,
      action: "create",
      summary: `Converted quotation ${quote.documentNumber} to invoice ${invoice.documentNumber}`,
      changedBy: convertedBy,
    });
    return { ...invoice, convertedFromQuotationId: quote.id };
  });
}
