import { query, tx } from "@/lib/db";
import { many, one, must, NotFoundError, ValidationError } from "./sql";
import { logAudit } from "./audit";
import { transitionDocumentStatus } from "./documents";
import type {
  Currency,
  DeductionKind,
  DeductionType,
  DocumentRecord,
  Party,
  PartyKind,
  Payment,
  PaymentMethod,
  ProfitSplitDeduction,
  ProfitSplitRule,
  ProfitSplitScope,
  RecurringExpense,
  RecurringExpenseCycle,
  Venture,
  VentureLaunchStatus,
} from "./types";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { addMonthsYmd, monthStartYmd, todayYmd } from "@/lib/time";
import { COUNTED_INVOICE_SQL, getInvoiceProfitBreakdown, loadBreakdowns, netTotalCents } from "./profit";

export { convertQuotationToInvoice } from "./documents";
export { computeBreakdown, getInvoiceProfitBreakdown, type ProfitBreakdown } from "./profit";

// --- Ventures (PRD 14) ---

export async function listVentures(): Promise<Venture[]> {
  return many<Venture>("select * from ventures order by name");
}

export async function getVentureById(id: string): Promise<Venture | undefined> {
  return one<Venture>("select * from ventures where id = $1", [id]);
}

export type VentureInput = {
  name: string;
  brandDescription?: string | null;
  websiteUrl?: string | null;
  launchStatus: VentureLaunchStatus;
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "venture";
}

export async function createVenture(input: VentureInput): Promise<Venture> {
  const slug = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
  return must<Venture>(
    "Venture",
    "insert into ventures (name, slug, brand_description, website_url, launch_status) values ($1,$2,$3,$4,$5) returning *",
    [input.name, slug, input.brandDescription ?? null, input.websiteUrl ?? null, input.launchStatus],
  );
}

export async function updateVenture(id: string, input: VentureInput): Promise<Venture> {
  return must<Venture>(
    "Venture",
    `update ventures set name = $2, brand_description = $3, website_url = $4, launch_status = $5, updated_at = now()
     where id = $1 returning *`,
    [id, input.name, input.brandDescription ?? null, input.websiteUrl ?? null, input.launchStatus],
  );
}

export async function deleteVenture(id: string): Promise<void> {
  const rows = await query("delete from ventures where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Venture");
}

// --- Parties ---

/** Partners first, then funds. */
export async function listParties(): Promise<Party[]> {
  return many<Party>("select id, name, kind from parties order by kind desc, created_at");
}

export async function createParty(name: string, kind: PartyKind = "partner"): Promise<Party> {
  return must<Party>("Party", "insert into parties (name, kind) values ($1, $2) returning id, name, kind", [name, kind]);
}

export async function deleteParty(id: string): Promise<void> {
  const used = await query("select 1 from profit_split_rules where splits @> $1::jsonb limit 1", [JSON.stringify([{ partyId: id }])]);
  if (used.length) throw new ValidationError("This party is part of a profit-split rule. Remove it from the rule first.");
  const money = await query(
    `select 1 where exists (select 1 from payouts where party_id = $1) or exists (select 1 from expenses where paid_by_party_id = $1 or fund_party_id = $1)
       or exists (select 1 from deduction_types where fund_party_id = $1)`,
    [id],
  );
  if (money.length) throw new ValidationError("Payouts, expenses or deductions refer to this party, so it's kept for the books.");
  await query("delete from parties where id = $1", [id]);
}

// --- Deduction types ---

export async function listDeductionTypes(): Promise<DeductionType[]> {
  return many<DeductionType>("select id, name, kind, fund_party_id from deduction_types order by created_at");
}

export async function createDeductionType(name: string, kind: DeductionKind, fundPartyId: string | null = null): Promise<DeductionType> {
  const type = await must<DeductionType>(
    "Deduction type",
    "insert into deduction_types (name, kind, fund_party_id) values ($1, $2, $3) returning id, name, kind, fund_party_id",
    [name, kind, fundPartyId],
  );
  await logAudit({ entityType: "deduction_type", entityId: type.id, action: "create", summary: `Added deduction type "${name}"`, changedBy: null });
  return type;
}

export async function updateDeductionType(id: string, input: { name: string; fundPartyId: string | null }): Promise<DeductionType> {
  return must<DeductionType>(
    "Deduction type",
    "update deduction_types set name = $2, fund_party_id = $3 where id = $1 returning id, name, kind, fund_party_id",
    [id, input.name, input.fundPartyId],
  );
}

export async function deleteDeductionType(id: string): Promise<void> {
  const used = await query("select 1 from profit_split_rules where deductions @> $1::jsonb limit 1", [JSON.stringify([{ deductionTypeId: id }])]);
  if (used.length) throw new ValidationError("This deduction is used by a profit-split rule. Remove it from the rule first.");
  await query("delete from deduction_types where id = $1", [id]);
}

// --- Profit-split rules (PRD 5.3, 5.3.1) ---

export async function getProfitSplitRule(id: string): Promise<ProfitSplitRule | undefined> {
  return one<ProfitSplitRule>("select * from profit_split_rules where id = $1", [id]);
}

export async function getRuleForScope(scopeType: ProfitSplitScope, scopeId: string): Promise<ProfitSplitRule | undefined> {
  return one<ProfitSplitRule>("select * from profit_split_rules where scope_type = $1 and scope_id = $2", [scopeType, scopeId]);
}

export async function listProfitSplitRules(): Promise<ProfitSplitRule[]> {
  return many<ProfitSplitRule>("select * from profit_split_rules order by updated_at desc");
}

async function scopeName(scopeType: ProfitSplitScope, scopeId: string): Promise<string> {
  if (scopeType === "document") {
    const row = await one<{ documentNumber: string }>("select document_number from documents where id = $1", [scopeId]);
    return row?.documentNumber ?? scopeId;
  }
  const table = scopeType === "project" ? "projects" : "ventures";
  const row = await one<{ name: string }>(`select name from ${table} where id = $1`, [scopeId]);
  return row?.name ?? scopeId;
}

const SCOPE_TABLE: Record<ProfitSplitScope, string> = { project: "projects", venture: "ventures", document: "documents" };

export async function upsertProfitSplitRule(input: {
  scopeType: ProfitSplitScope;
  scopeId: string;
  splits: { partyId: string; percentageBps: number }[];
  deductions: ProfitSplitDeduction[];
  isDefault?: boolean;
  updatedBy: string;
}): Promise<ProfitSplitRule> {
  const totalBps = input.splits.reduce((sum, s) => sum + s.percentageBps, 0);
  if (totalBps !== 10000) {
    throw new ValidationError(`Split percentages must total 100% (got ${(totalBps / 100).toFixed(2)}%)`);
  }
  return tx(async () => {
    if (input.scopeType === "document") {
      const doc = await one<{ type: string }>("select type from documents where id = $1", [input.scopeId]);
      if (doc?.type !== "invoice") throw new ValidationError("Only invoices carry a profit split.");
    }
    const existing = await getRuleForScope(input.scopeType, input.scopeId);
    const rule = await must<ProfitSplitRule>(
      "Rule",
      `insert into profit_split_rules (scope_type, scope_id, splits, deductions, is_default, updated_by)
       values ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
       on conflict (scope_type, scope_id) do update set splits = excluded.splits, deductions = excluded.deductions,
         is_default = excluded.is_default, updated_by = excluded.updated_by, updated_at = now()
       returning *`,
      [input.scopeType, input.scopeId, JSON.stringify(input.splits), JSON.stringify(input.deductions), input.isDefault ?? false, input.updatedBy],
    );
    await query(`update ${SCOPE_TABLE[input.scopeType]} set profit_split_rule_id = $2 where id = $1`, [input.scopeId, rule.id]);
    const name = await scopeName(input.scopeType, input.scopeId);
    await logAudit({
      entityType: "profit_split_rule",
      entityId: rule.id,
      action: existing ? "update" : "create",
      summary: `${existing ? "Updated" : "Created"} profit-split rule for ${input.scopeType} "${name}"`,
      changedBy: input.updatedBy,
    });
    return rule;
  });
}

export async function deleteProfitSplitRule(id: string, deletedBy: string): Promise<void> {
  const rule = await getProfitSplitRule(id);
  if (!rule) throw new NotFoundError("Rule");
  const name = await scopeName(rule.scopeType, rule.scopeId);
  // documents.profit_split_rule_id is ON DELETE SET NULL, so an invoice whose
  // override is removed falls back to its project's rule.
  await query("delete from profit_split_rules where id = $1", [id]);
  await logAudit({ entityType: "profit_split_rule", entityId: id, action: "delete", summary: `Deleted profit-split rule for ${rule.scopeType} "${name}"`, changedBy: deletedBy });
}

// --- Recurring expenses (PRD 5.1) ---

export const CYCLE_MONTHS: Record<RecurringExpenseCycle, number> = { monthly: 1, quarterly: 3, annual: 12 };

export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  return many<RecurringExpense>("select * from recurring_expenses order by status, next_due_date nulls last");
}

export type RecurringExpenseInput = {
  name: string;
  category: string;
  amountCents: number;
  currency: Currency;
  cycle: RecurringExpenseCycle;
  nextDueDate?: string | null;
  linkedClientId?: string | null;
  linkedProjectId?: string | null;
};

export async function createRecurringExpense(input: RecurringExpenseInput): Promise<RecurringExpense> {
  const expense = await must<RecurringExpense>(
    "Recurring expense",
    `insert into recurring_expenses (name, category, amount_cents, currency, cycle, next_due_date, linked_client_id, linked_project_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [
      input.name,
      input.category,
      input.amountCents,
      input.currency,
      input.cycle,
      input.nextDueDate ?? addMonthsYmd(todayYmd(), CYCLE_MONTHS[input.cycle]),
      input.linkedClientId ?? null,
      input.linkedProjectId ?? null,
    ],
  );
  await logAudit({ entityType: "recurring_expense", entityId: expense.id, action: "create", summary: `Added recurring expense "${expense.name}"`, changedBy: null });
  return expense;
}

export async function updateRecurringExpense(id: string, input: RecurringExpenseInput): Promise<RecurringExpense> {
  return must<RecurringExpense>(
    "Recurring expense",
    `update recurring_expenses set name = $2, category = $3, amount_cents = $4, currency = $5, cycle = $6,
       next_due_date = coalesce($7, next_due_date), linked_client_id = $8, linked_project_id = $9
     where id = $1 returning *`,
    [id, input.name, input.category, input.amountCents, input.currency, input.cycle, input.nextDueDate ?? null, input.linkedClientId ?? null, input.linkedProjectId ?? null],
  );
}

export async function deleteRecurringExpense(id: string, deletedBy: string): Promise<void> {
  const rows = await query<{ name: string }>("delete from recurring_expenses where id = $1 returning name", [id]);
  if (!rows.length) throw new NotFoundError("Recurring expense");
  await logAudit({ entityType: "recurring_expense", entityId: id, action: "delete", summary: `Deleted recurring expense "${rows[0]!.name}"`, changedBy: deletedBy });
}

export async function toggleRecurringExpenseStatus(id: string): Promise<RecurringExpense> {
  return must<RecurringExpense>(
    "Recurring expense",
    "update recurring_expenses set status = case when status = 'active' then 'paused' else 'active' end where id = $1 returning *",
    [id],
  );
}

/**
 * Logs this cycle's payment as a real expense (so it shows in cash out) and
 * advances the next due date by one cycle.
 */
export async function markRecurringExpensePaid(id: string, paidBy: string): Promise<RecurringExpense> {
  return tx(async () => {
    const e = await must<RecurringExpense & { linkedVentureId: string | null; paidByPartyId: string | null }>(
      "Recurring expense",
      "select * from recurring_expenses where id = $1 for update",
      [id],
    );
    const today = todayYmd();
    await query(
      `insert into expenses (description, category, amount_cents, currency, fx_rate, amount_bhd_cents, spent_on, linked_client_id, linked_project_id,
         linked_venture_id, recurring_expense_id, paid_by_party_id, reimbursement_status, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        e.name,
        e.category,
        e.amountCents,
        e.currency,
        pegRate(e.currency),
        convertMinorUnits(e.amountCents, e.currency, "BHD"),
        today,
        e.linkedClientId,
        e.linkedProjectId,
        e.linkedVentureId,
        e.id,
        e.paidByPartyId,
        e.paidByPartyId ? "pending" : "not_required",
        paidBy,
      ],
    );
    return must<RecurringExpense>(
      "Recurring expense",
      "update recurring_expenses set last_payment_date = $2, next_due_date = $3 where id = $1 returning *",
      [id, today, addMonthsYmd(e.nextDueDate ?? today, CYCLE_MONTHS[e.cycle])],
    );
  });
}

/** BHD per one unit of `currency` at the official peg. */
export function pegRate(currency: Currency): number {
  return currency === "BHD" ? 1 : Number((convertMinorUnits(1_000_000, currency, "BHD") / 10 ** 3 / (1_000_000 / 10 ** 2)).toFixed(6));
}

/** Prorates a recurring expense's amount into a specific invoice's billing cycle. */
export function prorateExpenseCents(expense: RecurringExpense, targetCycle: RecurringExpenseCycle): number {
  return Math.round((expense.amountCents / CYCLE_MONTHS[expense.cycle]) * CYCLE_MONTHS[targetCycle]);
}

// --- Payments (PRD 5.5) ---

export async function listPaymentsForDocument(documentId: string): Promise<Payment[]> {
  return many<Payment>("select * from payments where document_id = $1 order by paid_on, created_at", [documentId]);
}

/** What is still owed on an invoice (after credit notes), or still to refund on a credit note. */
async function openAmountCents(doc: DocumentRecord): Promise<number> {
  const paid = (await listPaymentsForDocument(doc.id)).reduce((sum, p) => sum + p.amountCents, 0);
  if (doc.type === "credit_note") return doc.totalCents - paid;
  const credited = await one<{ cents: number }>(
    `select coalesce(sum(total_cents), 0)::int8 as cents from documents
     where credit_for_id = $1 and type = 'credit_note' and status not in ('draft', 'void')`,
    [doc.id],
  );
  return doc.totalCents - (credited?.cents ?? 0) - paid;
}

/**
 * Records money received on an invoice, or a refund paid out on a credit
 * note. An invoice becomes Paid only once payments cover its total (less
 * credit notes); "Partly paid" is derived from the payments (item 10).
 */
export async function addPayment(input: {
  documentId: string;
  amountCents: number;
  method: PaymentMethod;
  paidOn?: string;
  reference?: string | null;
  accountId?: string | null;
  recordedBy: string;
}): Promise<Payment> {
  return tx(async () => {
    const doc = await must<DocumentRecord>("Invoice", "select * from documents where id = $1 for update", [input.documentId]);
    if (doc.type !== "invoice" && doc.type !== "credit_note") throw new ValidationError("Payments can only be recorded against invoices.");
    const noun = doc.type === "credit_note" ? "credit note" : "invoice";
    if (doc.status === "draft") throw new ValidationError(`Send the ${noun} before recording a payment.`);
    if (["void", "archived", "paid"].includes(doc.status)) throw new ValidationError(`This ${noun} is already ${doc.status === "void" ? "void" : doc.status}.`);

    const remaining = await openAmountCents(doc);
    if (input.amountCents > remaining) {
      throw new ValidationError(
        doc.type === "credit_note"
          ? `That's more than the ${centsToDisplay(remaining, doc.currency)} left to refund.`
          : `That's more than the ${centsToDisplay(remaining, doc.currency)} still owed.`,
      );
    }

    const payment = await must<Payment>(
      "Payment",
      "insert into payments (document_id, amount_cents, method, paid_on, reference, account_id, recorded_by) values ($1,$2,$3,$4,$5,$6,$7) returning *",
      [doc.id, input.amountCents, input.method, input.paidOn ?? todayYmd(), input.reference ?? null, input.accountId ?? null, input.recordedBy],
    );

    if (doc.type === "invoice" && input.amountCents >= remaining) await markInvoicePaid(doc, input.recordedBy);

    await logAudit({
      entityType: "payment",
      entityId: payment.id,
      action: "create",
      summary:
        doc.type === "credit_note"
          ? `Recorded a refund of ${centsToDisplay(input.amountCents, doc.currency)} on ${doc.documentNumber}`
          : `Recorded payment of ${centsToDisplay(input.amountCents, doc.currency)} on ${doc.documentNumber}`,
      changedBy: input.recordedBy,
    });
    return payment;
  });
}

/** Payments (and credit notes) now cover the invoice: mark it paid and note the hosting collection. */
export async function markInvoicePaid(doc: DocumentRecord, by: string | null) {
  if (doc.status === "paid") return;
  const last = await one<{ paidOn: string }>("select max(paid_on) as paid_on from payments where document_id = $1", [doc.id]);
  await query("update documents set status = 'paid', paid_at = now(), updated_at = now() where id = $1", [doc.id]);
  await query("insert into document_status_history (document_id, from_status, to_status, changed_by) values ($1, $2, 'paid', $3)", [doc.id, doc.status, by]);
  if (doc.hostingSubscriptionId && last?.paidOn) {
    await query(
      `update hosting_subscriptions set last_collected_date = greatest(coalesce(last_collected_date, $2::date), $2::date),
         linked_invoice_id = $3, status = case when status = 'overdue' then 'active' else status end
       where id = $1`,
      [doc.hostingSubscriptionId, last.paidOn, doc.id],
    );
  }
}

/** Re-derives Paid ⇄ Sent after payments or credit notes change. */
export async function syncInvoicePaidStatus(documentId: string, by: string | null) {
  const doc = await one<DocumentRecord>("select * from documents where id = $1", [documentId]);
  if (!doc || doc.type !== "invoice" || !["sent", "paid"].includes(doc.status)) return;
  const open = await openAmountCents(doc);
  if (open <= 0 && doc.status === "sent") await markInvoicePaid(doc, by);
  if (open > 0 && doc.status === "paid") {
    await query("update documents set status = 'sent', paid_at = null, updated_at = now() where id = $1", [doc.id]);
    await query("insert into document_status_history (document_id, from_status, to_status, changed_by) values ($1, 'paid', 'sent', $2)", [doc.id, by]);
  }
}

export async function deletePayment(paymentId: string, deletedBy: string): Promise<void> {
  await tx(async () => {
    const payment = await must<Payment>("Payment", "select * from payments where id = $1", [paymentId]);
    const doc = await must<DocumentRecord>("Invoice", "select * from documents where id = $1 for update", [payment.documentId]);
    if (doc.status === "archived" || doc.status === "void") throw new ValidationError(`Payments on ${doc.status} documents can't be removed.`);
    await query("delete from payments where id = $1", [paymentId]);
    await syncInvoicePaidStatus(doc.id, deletedBy);
    await logAudit({
      entityType: "payment",
      entityId: paymentId,
      action: "delete",
      summary: `Removed payment of ${centsToDisplay(payment.amountCents, doc.currency)} from ${doc.documentNumber}`,
      changedBy: deletedBy,
    });
  });
}

export function remainingBalanceCents(doc: Pick<DocumentRecord, "totalCents">, payments: Payment[], creditedCents = 0): number {
  const paid = payments.reduce((sum, p) => sum + p.amountCents, 0);
  return Math.max(doc.totalCents - creditedCents - paid, 0);
}

// --- Split rule per invoice (item 5) ---

/**
 * Points an invoice at an existing rule (e.g. a venture's), or back at its
 * project's rule when `ruleId` is null. Any custom rule for the invoice is removed.
 */
export async function setInvoiceSplitRule(documentId: string, ruleId: string | null, changedBy: string): Promise<void> {
  await tx(async () => {
    const doc = await must<DocumentRecord>("Invoice", "select * from documents where id = $1 for update", [documentId]);
    if (doc.type !== "invoice") throw new ValidationError("Only invoices carry a profit split.");
    if (ruleId) await must<ProfitSplitRule>("Rule", "select * from profit_split_rules where id = $1", [ruleId]);
    const custom = await getRuleForScope("document", documentId);
    if (custom && custom.id !== ruleId) await query("delete from profit_split_rules where id = $1", [custom.id]);
    const projectRule = doc.projectId ? await getRuleForScope("project", doc.projectId) : undefined;
    await query("update documents set profit_split_rule_id = $2, updated_at = now() where id = $1", [documentId, ruleId ?? projectRule?.id ?? null]);
    await logAudit({
      entityType: "document",
      entityId: documentId,
      action: "update",
      summary: ruleId ? `Changed the profit-split rule on ${doc.documentNumber}` : `${doc.documentNumber} now uses its project's profit-split rule`,
      changedBy,
    });
  });
}

// --- Dashboard aggregation (PRD section 4) ---

export type ErpDashboardSummary = {
  unpaidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  totalOutstandingBhdCents: number;
  netProfitThisMonthBhdCents: number;
  collectedThisMonthBhdCents: number;
  spentThisMonthBhdCents: number;
};

/** Everything is rolled up into BHD via the fixed USD peg. */
export async function getErpDashboardSummary(): Promise<ErpDashboardSummary> {
  const { invoices, breakdowns } = await loadBreakdowns();
  let unpaidInvoiceCount = 0;
  let partiallyPaidInvoiceCount = 0;
  let totalOutstandingBhdCents = 0;
  let netProfitThisMonthBhdCents = 0;
  const monthStart = monthStartYmd();
  for (const d of invoices) {
    const outstanding = Math.max(netTotalCents(d) - d.paidCents, 0);
    if (d.status === "sent" && outstanding > 0) {
      if (d.paidCents > 0) partiallyPaidInvoiceCount += 1;
      else unpaidInvoiceCount += 1;
      totalOutstandingBhdCents += convertMinorUnits(outstanding, d.currency, "BHD");
    }
    // "This month" = invoices whose issue date falls in this month (Bahrain time).
    if (d.issuedAt && toBahrainYmd(d.issuedAt) >= monthStart) {
      netProfitThisMonthBhdCents += convertMinorUnits(breakdowns.get(d.id)?.netProfitCents ?? netTotalCents(d), d.currency, "BHD");
    }
  }

  const collected = await many<{ currency: Currency; amount: number }>(
    `select d.currency, sum(case when d.type = 'credit_note' then -p.amount_cents else p.amount_cents end)::int8 as amount
     from payments p join documents d on d.id = p.document_id
     where p.paid_on >= $1::date and d.status <> 'void' group by d.currency`,
    [monthStart],
  );
  const spent = await one<{ amount: number }>(
    "select coalesce(sum(amount_bhd_cents), 0)::int8 as amount from expenses where spent_on >= $1::date",
    [monthStart],
  );

  return {
    unpaidInvoiceCount,
    partiallyPaidInvoiceCount,
    totalOutstandingBhdCents,
    netProfitThisMonthBhdCents,
    collectedThisMonthBhdCents: collected.reduce((sum, r) => sum + convertMinorUnits(r.amount, r.currency, "BHD"), 0),
    spentThisMonthBhdCents: spent?.amount ?? 0,
  };
}

const toBahrainYmd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(new Date(iso));

/** Invoices that count in reports, for callers that only need the SQL predicate. */
export { COUNTED_INVOICE_SQL, getInvoiceProfitBreakdown as getProfitBreakdown };
