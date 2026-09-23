import { many } from "./sql";
import { computeBreakdown, listDeductionTypes, listParties, listProfitSplitRules, CYCLE_MONTHS, type ProfitBreakdown } from "./finance";
import type { Currency, DocumentRecord, RecurringExpense } from "./types";
import { convertMinorUnits } from "@/lib/money";
import { addMonthsYmd, daysUntil, formatDate, monthStartYmd, todayYmd } from "@/lib/time";

const toBhd = (amount: number, currency: string) => convertMinorUnits(amount, currency, "BHD");

type InvoiceRow = DocumentRecord & { paidCents: number; projectName: string | null };

async function loadInvoices(): Promise<InvoiceRow[]> {
  return many<InvoiceRow>(
    `select d.*, p.name as project_name,
       coalesce((select sum(pay.amount_cents) from payments pay where pay.document_id = d.id), 0)::int8 as paid_cents
     from documents d left join projects p on p.id = d.project_id
     where d.type = 'invoice' and d.status <> 'archived'`,
  );
}

/** Profit breakdowns for many invoices with one round of lookups. */
async function breakdownsFor(invoices: DocumentRecord[]): Promise<Map<string, ProfitBreakdown>> {
  const [rules, types, parties, expenses] = await Promise.all([
    listProfitSplitRules(),
    listDeductionTypes(),
    listParties(),
    many<RecurringExpense>("select * from recurring_expenses where status = 'active' and linked_project_id is not null"),
  ]);
  const out = new Map<string, ProfitBreakdown>();
  for (const doc of invoices) {
    const rule = doc.profitSplitRuleId ? rules.find((r) => r.id === doc.profitSplitRuleId) : undefined;
    if (!rule) continue;
    const linked = expenses.filter((e) => doc.projectId && e.linkedProjectId === doc.projectId);
    out.set(doc.id, computeBreakdown(doc, rule, linked, types, parties));
  }
  return out;
}

export type ProjectProfitRow = {
  projectId: string;
  projectName: string;
  revenueBhdCents: number;
  deductionsBhdCents: number;
  netProfitBhdCents: number;
};

export async function getProfitByProjectReport(): Promise<ProjectProfitRow[]> {
  const invoices = (await loadInvoices()).filter((d) => d.projectId);
  const breakdowns = await breakdownsFor(invoices);
  const rows = new Map<string, ProjectProfitRow>();
  for (const doc of invoices) {
    const b = breakdowns.get(doc.id);
    const revenue = toBhd(doc.totalCents, doc.currency);
    const deductions = b ? toBhd(b.totalDeductionsCents, doc.currency) : 0;
    const net = b ? toBhd(b.netProfitCents, doc.currency) : revenue;
    const row = rows.get(doc.projectId!) ?? {
      projectId: doc.projectId!,
      projectName: doc.projectName ?? "Project",
      revenueBhdCents: 0,
      deductionsBhdCents: 0,
      netProfitBhdCents: 0,
    };
    row.revenueBhdCents += revenue;
    row.deductionsBhdCents += deductions;
    row.netProfitBhdCents += net;
    rows.set(doc.projectId!, row);
  }
  return [...rows.values()].sort((a, b) => b.revenueBhdCents - a.revenueBhdCents);
}

export type PartnerProfitRow = { partyId: string; partyName: string; totalBhdCents: number };

export async function getProfitByPartnerReport(): Promise<PartnerProfitRow[]> {
  const invoices = await loadInvoices();
  const breakdowns = await breakdownsFor(invoices);
  const rows = new Map<string, PartnerProfitRow>();
  for (const doc of invoices) {
    for (const split of breakdowns.get(doc.id)?.splits ?? []) {
      const row = rows.get(split.partyId) ?? { partyId: split.partyId, partyName: split.partyName, totalBhdCents: 0 };
      row.totalBhdCents += toBhd(split.amountCents, doc.currency);
      rows.set(split.partyId, row);
    }
  }
  return [...rows.values()];
}

export type InvoiceStatusReport = {
  paidCount: number;
  paidBhdCents: number;
  partialCount: number;
  partialOutstandingBhdCents: number;
  unpaidCount: number;
  unpaidBhdCents: number;
  overdueCount: number;
  overdueBhdCents: number;
};

export async function getInvoiceStatusReport(): Promise<InvoiceStatusReport> {
  const report: InvoiceStatusReport = {
    paidCount: 0,
    paidBhdCents: 0,
    partialCount: 0,
    partialOutstandingBhdCents: 0,
    unpaidCount: 0,
    unpaidBhdCents: 0,
    overdueCount: 0,
    overdueBhdCents: 0,
  };
  for (const doc of await loadInvoices()) {
    if (doc.status === "draft") continue;
    const outstanding = Math.max(doc.totalCents - doc.paidCents, 0);
    const outstandingBhd = toBhd(outstanding, doc.currency);
    if (doc.status === "paid" || outstanding <= 0) {
      report.paidCount += 1;
      report.paidBhdCents += toBhd(doc.totalCents, doc.currency);
      continue;
    }
    if (doc.paidCents > 0) {
      report.partialCount += 1;
      report.partialOutstandingBhdCents += outstandingBhd;
    } else {
      report.unpaidCount += 1;
      report.unpaidBhdCents += outstandingBhd;
    }
    if (doc.dueAt && daysUntil(doc.dueAt) < 0) {
      report.overdueCount += 1;
      report.overdueBhdCents += outstandingBhd;
    }
  }
  return report;
}

export type ArAgingBucket = { label: string; count: number; bhdCents: number };

/** Outstanding receivables by days past due (not yet due, 1–30, 31–60, 60+). */
export async function getArAging(): Promise<ArAgingBucket[]> {
  const buckets: ArAgingBucket[] = [
    { label: "Not yet due", count: 0, bhdCents: 0 },
    { label: "1–30 days", count: 0, bhdCents: 0 },
    { label: "31–60 days", count: 0, bhdCents: 0 },
    { label: "60+ days", count: 0, bhdCents: 0 },
  ];
  for (const doc of await loadInvoices()) {
    if (doc.status === "draft" || doc.status === "paid") continue;
    const outstanding = Math.max(doc.totalCents - doc.paidCents, 0);
    if (outstanding <= 0) continue;
    const overdueDays = doc.dueAt ? -daysUntil(doc.dueAt) : 0;
    const i = overdueDays <= 0 ? 0 : overdueDays <= 30 ? 1 : overdueDays <= 60 ? 2 : 3;
    buckets[i]!.count += 1;
    buckets[i]!.bhdCents += toBhd(outstanding, doc.currency);
  }
  return buckets;
}

export type HostingFeeReport = { collectedBhdCents: number; dueBhdCents: number; annualizedBhdCents: number };

/** Collected = hosting fees collected this calendar year; due = active fees still to collect this cycle. */
export async function getHostingFeeReport(): Promise<HostingFeeReport> {
  const yearStart = `${todayYmd().slice(0, 4)}-01-01`;
  const subs = await many<{ amountCents: number; currency: Currency; cycle: keyof typeof CYCLE_MONTHS; status: string; lastCollectedDate: string | null }>(
    "select amount_cents, currency, cycle, status, last_collected_date from hosting_subscriptions",
  );
  const collected = await many<{ currency: Currency; amount: number }>(
    `select d.currency, sum(p.amount_cents)::int8 as amount from payments p
     join documents d on d.id = p.document_id
     where d.id in (select linked_invoice_id from hosting_subscriptions where linked_invoice_id is not null)
        and p.paid_on >= $1::date
     group by d.currency`,
    [yearStart],
  );
  let due = 0;
  let annualized = 0;
  for (const s of subs) {
    if (s.status === "paused") continue;
    due += toBhd(s.amountCents, s.currency);
    annualized += toBhd(Math.round((s.amountCents * 12) / CYCLE_MONTHS[s.cycle]), s.currency);
  }
  return {
    collectedBhdCents: collected.reduce((sum, r) => sum + toBhd(r.amount, r.currency), 0),
    dueBhdCents: due,
    annualizedBhdCents: annualized,
  };
}

// --- Cash flow ---

export type CashFlowMonth = { month: string; label: string; inBhdCents: number; outBhdCents: number };

/** Actual cash in (payments received) vs out (expenses logged), last `months` months, oldest first. */
export async function getMonthlyCashFlow(months = 12): Promise<CashFlowMonth[]> {
  const start = addMonthsYmd(monthStartYmd(), -(months - 1));
  const [ins, outs] = await Promise.all([
    many<{ month: string; currency: Currency; amount: number }>(
      `select to_char(p.paid_on, 'YYYY-MM') as month, d.currency, sum(p.amount_cents)::int8 as amount
       from payments p join documents d on d.id = p.document_id where p.paid_on >= $1::date group by 1, 2`,
      [start],
    ),
    many<{ month: string; currency: Currency; amount: number }>(
      `select to_char(spent_on, 'YYYY-MM') as month, currency, sum(amount_cents)::int8 as amount
       from expenses where spent_on >= $1::date group by 1, 2`,
      [start],
    ),
  ]);
  const result: CashFlowMonth[] = [];
  for (let i = 0; i < months; i++) {
    const ymd = addMonthsYmd(start, i);
    const month = ymd.slice(0, 7);
    const sum = (rows: typeof ins) => rows.filter((r) => r.month === month).reduce((s, r) => s + toBhd(r.amount, r.currency), 0);
    result.push({ month, label: formatDate(ymd, { month: "short" }), inBhdCents: sum(ins), outBhdCents: sum(outs) });
  }
  return result;
}

export type CashFlowForecastMonth = { label: string; expectedBhdCents: number; expectedOutBhdCents: number };

/**
 * Next 3 months: expected inflow (open invoice balances due in-month +
 * scheduled hosting collections) and outflow (active recurring expenses due).
 */
export async function getCashFlowForecast(): Promise<CashFlowForecastMonth[]> {
  const [invoices, hosting, recurring] = await Promise.all([
    loadInvoices(),
    many<{ amountCents: number; currency: Currency; nextDueDate: string | null; status: string; cycle: keyof typeof CYCLE_MONTHS }>(
      "select amount_cents, currency, next_due_date, status, cycle from hosting_subscriptions where status <> 'paused'",
    ),
    many<{ amountCents: number; currency: Currency; nextDueDate: string | null; cycle: keyof typeof CYCLE_MONTHS }>(
      "select amount_cents, currency, next_due_date, cycle from recurring_expenses where status = 'active'",
    ),
  ]);
  const thisMonth = monthStartYmd();
  const months: CashFlowForecastMonth[] = [];
  for (let i = 0; i < 3; i++) {
    const start = addMonthsYmd(thisMonth, i);
    const end = addMonthsYmd(thisMonth, i + 1);
    const inMonth = (d: string | null) => !!d && d.slice(0, 10) >= start && d.slice(0, 10) < end;
    let expected = 0;
    for (const doc of invoices) {
      if (doc.status === "paid" || doc.status === "draft") continue;
      if (inMonth(doc.dueAt)) expected += toBhd(Math.max(doc.totalCents - doc.paidCents, 0), doc.currency);
    }
    // Recurring schedules repeat — project each forward through the window.
    const occurrences = (next: string | null, cycle: keyof typeof CYCLE_MONTHS) => {
      if (!next) return 0;
      let n = 0;
      for (let d = next.slice(0, 10); d < end; d = addMonthsYmd(d, CYCLE_MONTHS[cycle])) if (d >= start) n++;
      return n;
    };
    for (const h of hosting) expected += occurrences(h.nextDueDate, h.cycle) * toBhd(h.amountCents, h.currency);
    let out = 0;
    for (const r of recurring) out += occurrences(r.nextDueDate, r.cycle) * toBhd(r.amountCents, r.currency);
    months.push({ label: formatDate(start, { month: "long", year: "numeric" }), expectedBhdCents: expected, expectedOutBhdCents: out });
  }
  return months;
}
