import { randomUUID } from "crypto";
import { store } from "./store";
import type {
  Party,
  DeductionType,
  DeductionKind,
  ProfitSplitRule,
  ProfitSplitScope,
  RecurringExpense,
  RecurringExpenseCycle,
  Payment,
  PaymentMethod,
  DocumentRecord,
} from "./types";
import { taxCents as calcPercentage, convertMinorUnits } from "@/lib/money";
import { assignInvoiceNumber } from "./documents";

// --- Ventures (PRD 14) ---

export async function listVentures() {
  return store.ventures;
}

// --- Parties ---

export async function listParties(): Promise<Party[]> {
  return store.parties;
}

export async function createParty(name: string): Promise<Party> {
  const party: Party = { id: randomUUID(), name };
  store.parties.push(party);
  return party;
}

// --- Deduction types ---

export async function listDeductionTypes(): Promise<DeductionType[]> {
  return store.deductionTypes;
}

export async function createDeductionType(name: string, kind: DeductionKind): Promise<DeductionType> {
  const type: DeductionType = { id: randomUUID(), name, kind };
  store.deductionTypes.push(type);
  return type;
}

function logAudit(entry: {
  entityType: "document" | "payment" | "profit_split_rule" | "deduction_type" | "recurring_expense";
  entityId: string;
  action: "create" | "update" | "delete";
  summary: string;
  changedBy: string;
}) {
  store.auditLog.push({ id: randomUUID(), changedAt: new Date().toISOString(), ...entry });
}

// --- Profit-split rules (PRD 5.3, 5.3.1) ---

export async function getProfitSplitRule(id: string): Promise<ProfitSplitRule | undefined> {
  return store.profitSplitRules.find((r) => r.id === id);
}

export async function getRuleForScope(scopeType: ProfitSplitScope, scopeId: string): Promise<ProfitSplitRule | undefined> {
  return store.profitSplitRules.find((r) => r.scopeType === scopeType && r.scopeId === scopeId);
}

export async function listProfitSplitRules(): Promise<ProfitSplitRule[]> {
  return store.profitSplitRules;
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
    throw new Error(`Split percentages must total 100% (got ${(totalBps / 100).toFixed(2)}%)`);
  }

  const existing = store.profitSplitRules.find((r) => r.scopeType === input.scopeType && r.scopeId === input.scopeId);
  const now = new Date().toISOString();

  if (existing) {
    existing.splits = input.splits;
    existing.deductions = input.deductions;
    existing.isDefault = input.isDefault ?? existing.isDefault;
    existing.updatedBy = input.updatedBy;
    existing.updatedAt = now;
    logAudit({
      entityType: "profit_split_rule",
      entityId: existing.id,
      action: "update",
      summary: `Updated profit-split rule for ${input.scopeType} ${input.scopeId}`,
      changedBy: input.updatedBy,
    });
    return existing;
  }

  const rule: ProfitSplitRule = {
    id: randomUUID(),
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    splits: input.splits,
    deductions: input.deductions,
    isDefault: input.isDefault ?? false,
    updatedBy: input.updatedBy,
    updatedAt: now,
  };
  store.profitSplitRules.push(rule);

  if (input.scopeType === "project") {
    const project = store.projects.find((p) => p.id === input.scopeId);
    if (project) project.profitSplitRuleId = rule.id;
  } else {
    const venture = store.ventures.find((v) => v.id === input.scopeId);
    if (venture) venture.profitSplitRuleId = rule.id;
  }

  logAudit({
    entityType: "profit_split_rule",
    entityId: rule.id,
    action: "create",
    summary: `Created profit-split rule for ${input.scopeType} ${input.scopeId}`,
    changedBy: input.updatedBy,
  });
  return rule;
}

// --- Recurring expenses (PRD 5.1) ---

export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  return store.recurringExpenses;
}

const CYCLE_MONTHS: Record<RecurringExpenseCycle, number> = { monthly: 1, quarterly: 3, annual: 12 };

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export async function createRecurringExpense(input: {
  name: string;
  category: string;
  amountCents: number;
  currency: string;
  cycle: RecurringExpenseCycle;
  linkedClientId?: string | null;
  linkedProjectId?: string | null;
}): Promise<RecurringExpense> {
  const now = new Date().toISOString();
  const expense: RecurringExpense = {
    id: randomUUID(),
    name: input.name,
    category: input.category,
    amountCents: input.amountCents,
    currency: input.currency,
    cycle: input.cycle,
    lastPaymentDate: null,
    nextDueDate: addMonths(now, CYCLE_MONTHS[input.cycle]),
    linkedClientId: input.linkedClientId ?? null,
    linkedProjectId: input.linkedProjectId ?? null,
    status: "active",
  };
  store.recurringExpenses.push(expense);
  return expense;
}

export async function toggleRecurringExpenseStatus(id: string): Promise<RecurringExpense> {
  const expense = store.recurringExpenses.find((e) => e.id === id);
  if (!expense) throw new Error("Recurring expense not found");
  expense.status = expense.status === "active" ? "paused" : "active";
  return expense;
}

/** Prorates a recurring expense's amount into a specific invoice's billing cycle. */
export function prorateExpenseCents(expense: RecurringExpense, targetCycle: RecurringExpenseCycle): number {
  const expenseMonths = CYCLE_MONTHS[expense.cycle];
  const targetMonths = CYCLE_MONTHS[targetCycle];
  return Math.round((expense.amountCents / expenseMonths) * targetMonths);
}

// --- Payments (PRD 5.5) ---

export async function listPaymentsForDocument(documentId: string): Promise<Payment[]> {
  return store.payments.filter((p) => p.documentId === documentId).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function addPayment(input: {
  documentId: string;
  amountCents: number;
  method: PaymentMethod;
  recordedBy: string;
}): Promise<Payment> {
  const payment: Payment = {
    id: randomUUID(),
    documentId: input.documentId,
    amountCents: input.amountCents,
    date: new Date().toISOString(),
    method: input.method,
    recordedBy: input.recordedBy,
  };
  store.payments.push(payment);

  const doc = store.documents.find((d) => d.id === input.documentId);
  if (doc) {
    const totalPaid = store.payments
      .filter((p) => p.documentId === doc.id)
      .reduce((sum, p) => sum + p.amountCents, 0);
    // "Paid/Unpaid" auto-flips once payments cover the invoice total (PRD
    // 5.5) — the invoice's own totalCents is never touched, only the log.
    if (totalPaid >= doc.totalCents && doc.status !== "paid") {
      doc.status = "paid";
      doc.paidAt = payment.date;
    }
  }

  logAudit({
    entityType: "payment",
    entityId: payment.id,
    action: "create",
    summary: `Recorded payment of ${input.amountCents} minor units on document ${input.documentId}`,
    changedBy: input.recordedBy,
  });

  return payment;
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
 * PRD 5.6 step 2: deducts (a) recurring expenses linked to the same project,
 * prorated into the invoice's period and FX-converted into the invoice's
 * currency, plus (b) any deductions configured on the split rule in
 * Settings. The linked-expense side is computed dynamically from the actual
 * RecurringExpense record — never a static pre-converted number — so it
 * stays correct if the expense amount or currency changes later.
 *
 * Simplification: linked expenses are prorated to a quarterly period, since
 * that is Newmux's actual hosting-invoice cadence today (see the Ox Roastery
 * worked example, PRD section 17). A per-invoice billing period would
 * replace this once the Hosting Fee module (Phase 2) is built.
 */
export async function getInvoiceProfitBreakdown(documentId: string): Promise<ProfitBreakdown | null> {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc || doc.type !== "invoice" || !doc.profitSplitRuleId) return null;

  const rule = store.profitSplitRules.find((r) => r.id === doc.profitSplitRuleId);
  if (!rule) return null;

  const linkedExpenseDeductions = store.recurringExpenses
    .filter((e) => e.status === "active" && doc.projectId && e.linkedProjectId === doc.projectId)
    .map((e) => {
      const proratedInExpenseCurrency = prorateExpenseCents(e, "quarterly");
      const amountCents = convertMinorUnits(proratedInExpenseCurrency, e.currency, doc.currency);
      return { deductionTypeId: null, name: e.name, amountCents };
    });

  const configuredDeductions = rule.deductions.map((d) => {
    const type = store.deductionTypes.find((t) => t.id === d.deductionTypeId);
    const amountCents = type?.kind === "percentage" ? calcPercentage(doc.totalCents, d.value) : d.value;
    return { deductionTypeId: d.deductionTypeId, name: type?.name ?? "Deduction", amountCents };
  });

  const deductions = [...linkedExpenseDeductions, ...configuredDeductions];
  const totalDeductionsCents = deductions.reduce((sum, d) => sum + d.amountCents, 0);
  const netProfitCents = doc.totalCents - totalDeductionsCents;

  const splits = rule.splits.map((s) => {
    const party = store.parties.find((p) => p.id === s.partyId);
    return {
      partyId: s.partyId,
      partyName: party?.name ?? "Unknown",
      percentageBps: s.percentageBps,
      amountCents: calcPercentage(netProfitCents, s.percentageBps),
    };
  });

  return {
    invoiceTotalCents: doc.totalCents,
    deductions,
    totalDeductionsCents,
    netProfitCents,
    splits,
  };
}

// --- Main Dashboard aggregation (PRD section 4) ---

export type ErpDashboardSummary = {
  unpaidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  totalOutstandingBhdCents: number;
  netProfitThisMonthBhdCents: number;
};

/** Everything here is rolled up into BHD (the real business's primary
 * currency) via the fixed peg rate, so mixed-currency invoices still sum
 * correctly instead of silently mis-adding minor units across currencies. */
export async function getErpDashboardSummary(): Promise<ErpDashboardSummary> {
  const invoices = store.documents.filter((d) => d.type === "invoice" && d.status !== "archived");

  let unpaidInvoiceCount = 0;
  let partiallyPaidInvoiceCount = 0;
  let totalOutstandingBhdCents = 0;

  for (const doc of invoices) {
    if (doc.status === "paid") continue;
    const paid = store.payments.filter((p) => p.documentId === doc.id).reduce((sum, p) => sum + p.amountCents, 0);
    const outstanding = Math.max(doc.totalCents - paid, 0);
    if (outstanding <= 0) continue;
    if (paid > 0) partiallyPaidInvoiceCount += 1;
    else unpaidInvoiceCount += 1;
    totalOutstandingBhdCents += convertMinorUnits(outstanding, doc.currency, "BHD");
  }

  const now = new Date();
  const thisMonthInvoices = invoices.filter((d) => {
    if (!d.issuedAt) return false;
    const issued = new Date(d.issuedAt);
    return issued.getFullYear() === now.getFullYear() && issued.getMonth() === now.getMonth();
  });

  let netProfitThisMonthBhdCents = 0;
  for (const doc of thisMonthInvoices) {
    const breakdown = await getInvoiceProfitBreakdown(doc.id);
    if (breakdown) {
      netProfitThisMonthBhdCents += convertMinorUnits(breakdown.netProfitCents, doc.currency, "BHD");
    }
  }

  return { unpaidInvoiceCount, partiallyPaidInvoiceCount, totalOutstandingBhdCents, netProfitThisMonthBhdCents };
}

// --- Quotation → Invoice conversion (PRD 5.4) ---

export async function convertQuotationToInvoice(quotationId: string, convertedBy: string): Promise<DocumentRecord> {
  const quote = store.documents.find((d) => d.id === quotationId);
  if (!quote) throw new Error("Quotation not found");
  if (quote.type !== "quote") throw new Error("Only quotations can be converted to invoices");

  const lineItems = store.documentLineItems.filter((li) => li.documentId === quotationId);
  const project = quote.projectId ? store.projects.find((p) => p.id === quote.projectId) : undefined;
  const now = new Date().toISOString();

  const invoice: DocumentRecord = {
    ...quote,
    id: randomUUID(),
    type: "invoice",
    status: "draft",
    convertedFromQuotationId: quote.id,
    profitSplitRuleId: project?.profitSplitRuleId ?? null,
    documentNumber: "", // assigned by the invoice sequence below
    issuedAt: null,
    dueAt: null,
    acceptedAt: null,
    paidAt: null,
    archivedAt: null,
    createdBy: convertedBy,
    createdAt: now,
    updatedAt: now,
  };

  invoice.documentNumber = assignInvoiceNumber();

  store.documents.push(invoice);
  lineItems.forEach((li, i) => {
    store.documentLineItems.push({
      id: randomUUID(),
      documentId: invoice.id,
      description: li.description,
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      sortOrder: i,
    });
  });

  store.documentStatusHistory.push({
    id: randomUUID(),
    documentId: invoice.id,
    fromStatus: null,
    toStatus: "draft",
    changedBy: convertedBy,
    changedAt: now,
  });

  logAudit({
    entityType: "document",
    entityId: invoice.id,
    action: "create",
    summary: `Converted quotation ${quote.documentNumber} to invoice ${invoice.documentNumber}`,
    changedBy: convertedBy,
  });

  return invoice;
}
