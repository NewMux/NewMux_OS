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
  Payment,
  PaymentMethod,
  ProfitSplitRule,
  ProfitSplitScope,
  RecurringExpense,
  RecurringExpenseCycle,
  Venture,
  VentureLaunchStatus,
} from "./types";
import { allocateByBps, centsToDisplay, convertMinorUnits, taxCents as calcPercentage } from "@/lib/money";
import { addMonthsYmd, monthStartYmd, todayYmd } from "@/lib/time";

export { convertQuotationToInvoice } from "./documents";

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

export async function listParties(): Promise<Party[]> {
  return many<Party>("select id, name from parties order by created_at");
}

export async function createParty(name: string): Promise<Party> {
  return must<Party>("Party", "insert into parties (name) values ($1) returning id, name", [name]);
}

export async function deleteParty(id: string): Promise<void> {
  const used = await query("select 1 from profit_split_rules where splits @> $1::jsonb limit 1", [JSON.stringify([{ partyId: id }])]);
  if (used.length) throw new ValidationError("This party is part of a profit-split rule. Remove it from the rule first.");
  await query("delete from parties where id = $1", [id]);
}

// --- Deduction types ---

export async function listDeductionTypes(): Promise<DeductionType[]> {
  return many<DeductionType>("select id, name, kind from deduction_types order by created_at");
}

export async function createDeductionType(name: string, kind: DeductionKind): Promise<DeductionType> {
  const type = await must<DeductionType>("Deduction type", "insert into deduction_types (name, kind) values ($1, $2) returning id, name, kind", [name, kind]);
  await logAudit({ entityType: "deduction_type", entityId: type.id, action: "create", summary: `Added deduction type "${name}"`, changedBy: null });
  return type;
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
  const table = scopeType === "project" ? "projects" : "ventures";
  const row = await one<{ name: string }>(`select name from ${table} where id = $1`, [scopeId]);
  return row?.name ?? scopeId;
}

export async function upsertProfitSplitRule(input: {
  scopeType: ProfitSplitScope;
  scopeId: string;
  splits: { partyId: string; percentageBps: number }[];
  deductions: { deductionTypeId: string; value: number }[];
  isDefault?: boolean;
  updatedBy: string;
}): Promise<ProfitSplitRule> {
  const totalBps = input.splits.reduce((sum, s) => sum + s.percentageBps, 0);
  if (totalBps !== 10000) {
    throw new ValidationError(`Split percentages must total 100% (got ${(totalBps / 100).toFixed(2)}%)`);
  }
  return tx(async () => {
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
    const table = input.scopeType === "project" ? "projects" : "ventures";
    await query(`update ${table} set profit_split_rule_id = $2 where id = $1`, [input.scopeId, rule.id]);
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
    const e = await must<RecurringExpense>("Recurring expense", "select * from recurring_expenses where id = $1 for update", [id]);
    const today = todayYmd();
    await query(
      `insert into expenses (description, category, amount_cents, currency, spent_on, linked_client_id, linked_project_id, recurring_expense_id, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [e.name, e.category, e.amountCents, e.currency, today, e.linkedClientId, e.linkedProjectId, e.id, paidBy],
    );
    return must<RecurringExpense>(
      "Recurring expense",
      "update recurring_expenses set last_payment_date = $2, next_due_date = $3 where id = $1 returning *",
      [id, today, addMonthsYmd(e.nextDueDate ?? today, CYCLE_MONTHS[e.cycle])],
    );
  });
}

/** Prorates a recurring expense's amount into a specific invoice's billing cycle. */
export function prorateExpenseCents(expense: RecurringExpense, targetCycle: RecurringExpenseCycle): number {
  return Math.round((expense.amountCents / CYCLE_MONTHS[expense.cycle]) * CYCLE_MONTHS[targetCycle]);
}

// --- Payments (PRD 5.5) ---

export async function listPaymentsForDocument(documentId: string): Promise<Payment[]> {
  return many<Payment>("select * from payments where document_id = $1 order by paid_on, created_at", [documentId]);
}

export async function addPayment(input: {
  documentId: string;
  amountCents: number;
  method: PaymentMethod;
  paidOn?: string;
  reference?: string | null;
  recordedBy: string;
}): Promise<Payment> {
  return tx(async () => {
    const doc = await must<DocumentRecord>("Invoice", "select * from documents where id = $1 for update", [input.documentId]);
    if (doc.type !== "invoice") throw new ValidationError("Payments can only be recorded against invoices.");
    if (doc.status === "draft") throw new ValidationError("Send the invoice before recording a payment.");
    if (doc.status === "archived" || doc.status === "paid") throw new ValidationError(`This invoice is already ${doc.status}.`);

    const paidSoFar = (await listPaymentsForDocument(doc.id)).reduce((sum, p) => sum + p.amountCents, 0);
    const remaining = doc.totalCents - paidSoFar;
    if (input.amountCents > remaining) {
      throw new ValidationError(`That's more than the ${centsToDisplay(remaining, doc.currency)} still owed.`);
    }

    const payment = await must<Payment>(
      "Payment",
      "insert into payments (document_id, amount_cents, method, paid_on, reference, recorded_by) values ($1,$2,$3,$4,$5,$6) returning *",
      [doc.id, input.amountCents, input.method, input.paidOn ?? todayYmd(), input.reference ?? null, input.recordedBy],
    );

    // Paid/Unpaid auto-flips once payments cover the total (PRD 5.5), through
    // the normal lifecycle so the status history records it.
    if (paidSoFar + input.amountCents >= doc.totalCents) {
      if (doc.status === "sent") await transitionDocumentStatus(doc.id, "accepted", input.recordedBy);
      await transitionDocumentStatus(doc.id, "paid", input.recordedBy);
    }

    await logAudit({
      entityType: "payment",
      entityId: payment.id,
      action: "create",
      summary: `Recorded payment of ${centsToDisplay(input.amountCents, doc.currency)} on ${doc.documentNumber}`,
      changedBy: input.recordedBy,
    });
    return payment;
  });
}

export async function deletePayment(paymentId: string, deletedBy: string): Promise<void> {
  await tx(async () => {
    const payment = await must<Payment>("Payment", "select * from payments where id = $1", [paymentId]);
    const doc = await must<DocumentRecord>("Invoice", "select * from documents where id = $1 for update", [payment.documentId]);
    if (doc.status === "archived") throw new ValidationError("Payments on archived invoices can't be removed.");
    await query("delete from payments where id = $1", [paymentId]);
    if (doc.status === "paid") {
      // Reopen: the invoice is no longer fully covered.
      await query("update documents set status = 'accepted', paid_at = null, updated_at = now() where id = $1", [doc.id]);
      await query(
        "insert into document_status_history (document_id, from_status, to_status, changed_by) values ($1, 'paid', 'accepted', $2)",
        [doc.id, deletedBy],
      );
    }
    await logAudit({
      entityType: "payment",
      entityId: paymentId,
      action: "delete",
      summary: `Removed payment of ${centsToDisplay(payment.amountCents, doc.currency)} from ${doc.documentNumber}`,
      changedBy: deletedBy,
    });
  });
}

export function remainingBalanceCents(doc: Pick<DocumentRecord, "totalCents">, payments: Payment[]): number {
  const paid = payments.reduce((sum, p) => sum + p.amountCents, 0);
  return Math.max(doc.totalCents - paid, 0);
}

// --- Automatic profit/loss calculation (PRD 5.6, worked example section 17) ---

export type ProfitBreakdown = {
  invoiceTotalCents: number;
  deductions: { deductionTypeId: string | null; name: string; amountCents: number }[];
  totalDeductionsCents: number;
  netProfitCents: number;
  splits: { partyId: string; partyName: string; percentageBps: number; amountCents: number }[];
};

/**
 * PRD 5.6 step 2: deducts (a) active recurring expenses linked to the same
 * project, prorated into a quarter (Newmux's hosting-invoice cadence, see
 * the Ox Roastery example in PRD 17) and FX-converted into the invoice's
 * currency, plus (b) deductions configured on the split rule. Fixed
 * deductions are stored in the invoice's currency's minor units.
 */
export async function getInvoiceProfitBreakdown(documentId: string): Promise<ProfitBreakdown | null> {
  const doc = await getInvoice(documentId);
  if (!doc || doc.type !== "invoice" || !doc.profitSplitRuleId) return null;
  const rule = await getProfitSplitRule(doc.profitSplitRuleId);
  if (!rule) return null;
  const [expenses, types, parties] = await Promise.all([
    doc.projectId
      ? many<RecurringExpense>("select * from recurring_expenses where status = 'active' and linked_project_id = $1", [doc.projectId])
      : Promise.resolve([] as RecurringExpense[]),
    listDeductionTypes(),
    listParties(),
  ]);
  return computeBreakdown(doc, rule, expenses, types, parties);
}

async function getInvoice(id: string) {
  return one<DocumentRecord>("select * from documents where id = $1", [id]);
}

export function computeBreakdown(
  doc: DocumentRecord,
  rule: ProfitSplitRule,
  linkedExpenses: RecurringExpense[],
  types: DeductionType[],
  parties: Party[],
): ProfitBreakdown {
  const linkedExpenseDeductions = linkedExpenses.map((e) => ({
    deductionTypeId: null,
    name: e.name,
    amountCents: convertMinorUnits(prorateExpenseCents(e, "quarterly"), e.currency, doc.currency),
  }));
  const configuredDeductions = rule.deductions.map((d) => {
    const type = types.find((t) => t.id === d.deductionTypeId);
    const amountCents = type?.kind === "percentage" ? calcPercentage(doc.totalCents, d.value) : d.value;
    return { deductionTypeId: d.deductionTypeId, name: type?.name ?? "Deduction", amountCents };
  });
  const deductions = [...linkedExpenseDeductions, ...configuredDeductions];
  const totalDeductionsCents = deductions.reduce((sum, d) => sum + d.amountCents, 0);
  const netProfitCents = doc.totalCents - totalDeductionsCents;
  const amounts = allocateByBps(Math.max(netProfitCents, 0), rule.splits.map((s) => s.percentageBps));
  const splits = rule.splits.map((s, i) => ({
    partyId: s.partyId,
    partyName: parties.find((p) => p.id === s.partyId)?.name ?? "Unknown",
    percentageBps: s.percentageBps,
    amountCents: netProfitCents < 0 ? calcPercentage(netProfitCents, s.percentageBps) : amounts[i]!,
  }));
  return { invoiceTotalCents: doc.totalCents, deductions, totalDeductionsCents, netProfitCents, splits };
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
  const open = await many<{ currency: Currency; totalCents: number; paidCents: number }>(
    `select d.currency, d.total_cents,
       coalesce((select sum(p.amount_cents) from payments p where p.document_id = d.id), 0)::int8 as paid_cents
     from documents d where d.type = 'invoice' and d.status in ('sent', 'accepted', 'signed')`,
  );
  let unpaidInvoiceCount = 0;
  let partiallyPaidInvoiceCount = 0;
  let totalOutstandingBhdCents = 0;
  for (const d of open) {
    const outstanding = Math.max(d.totalCents - d.paidCents, 0);
    if (outstanding <= 0) continue;
    if (d.paidCents > 0) partiallyPaidInvoiceCount += 1;
    else unpaidInvoiceCount += 1;
    totalOutstandingBhdCents += convertMinorUnits(outstanding, d.currency, "BHD");
  }

  const monthStart = monthStartYmd();
  const monthInvoices = await many<{ id: string; currency: Currency }>(
    `select id, currency from documents where type = 'invoice' and status <> 'archived'
       and issued_at is not null and (issued_at at time zone 'Asia/Bahrain')::date >= $1::date`,
    [monthStart],
  );
  let netProfitThisMonthBhdCents = 0;
  for (const inv of monthInvoices) {
    const breakdown = await getInvoiceProfitBreakdown(inv.id);
    if (breakdown) netProfitThisMonthBhdCents += convertMinorUnits(breakdown.netProfitCents, inv.currency, "BHD");
  }

  const collected = await many<{ currency: Currency; amount: number }>(
    `select d.currency, sum(p.amount_cents)::int8 as amount from payments p join documents d on d.id = p.document_id
     where p.paid_on >= $1::date group by d.currency`,
    [monthStart],
  );
  const spent = await many<{ currency: Currency; amount: number }>(
    "select currency, sum(amount_cents)::int8 as amount from expenses where spent_on >= $1::date group by currency",
    [monthStart],
  );
  const toBhd = (rows: { currency: Currency; amount: number }[]) =>
    rows.reduce((sum, r) => sum + convertMinorUnits(r.amount, r.currency, "BHD"), 0);

  return {
    unpaidInvoiceCount,
    partiallyPaidInvoiceCount,
    totalOutstandingBhdCents,
    netProfitThisMonthBhdCents,
    collectedThisMonthBhdCents: toBhd(collected),
    spentThisMonthBhdCents: toBhd(spent),
  };
}
