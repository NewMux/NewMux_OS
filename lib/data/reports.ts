import { many } from "./sql";
import { CYCLE_MONTHS } from "./finance";
import { getPartyBalances } from "./ledger";
import { loadBreakdowns, loadCountedInvoices, netTotalCents } from "./profit";
import type { Currency, PartyKind } from "./types";
import { convertMinorUnits } from "@/lib/money";
import { addMonthsYmd, daysUntil, formatDate, monthStartYmd, todayYmd } from "@/lib/time";

const toBhd = (amount: number, currency: string) => convertMinorUnits(amount, currency, "BHD");

export type ProjectProfitRow = {
  projectId: string;
  projectName: string;
  invoiceCount: number;
  revenueBhdCents: number;
  /** Expenses linked to the project or its invoices, plus split-rule deductions that are costs. */
  costsBhdCents: number;
  /** Part of profit set aside for a fund (the Newmux reserve). Not a cost. */
  reserveBhdCents: number;
  netProfitBhdCents: number;
  /** Each party's share across the project's invoices. */
  shares: { partyId: string; partyName: string; bhdCents: number }[];
};

/**
 * Item 3: revenue less every cost counted once — expenses charged to an
 * invoice, the rest of the project's expenses (spread over its invoices,
 * or all against the project when nothing is invoiced yet), and rule
 * deductions that are costs.
 */
export async function getProfitByProjectReport(filter: { projectId?: string } = {}): Promise<ProjectProfitRow[]> {
  const { invoices, ctx, breakdowns } = await loadBreakdowns(filter);
  const names = new Map(
    (await many<{ id: string; name: string }>("select id, name from projects")).map((p) => [p.id, p.name]),
  );
  const rows = new Map<string, ProjectProfitRow>();
  const row = (projectId: string) => {
    let r = rows.get(projectId);
    if (!r) {
      r = { projectId, projectName: names.get(projectId) ?? "Project", invoiceCount: 0, revenueBhdCents: 0, costsBhdCents: 0, reserveBhdCents: 0, netProfitBhdCents: 0, shares: [] };
      rows.set(projectId, r);
    }
    return r;
  };
  for (const inv of invoices) {
    if (!inv.projectId) continue;
    const b = breakdowns.get(inv.id)!;
    const r = row(inv.projectId);
    r.invoiceCount += 1;
    r.revenueBhdCents += toBhd(netTotalCents(inv), inv.currency);
    r.costsBhdCents += toBhd(b.costCents, inv.currency);
    r.reserveBhdCents += toBhd(b.totalDeductionsCents - b.costCents, inv.currency);
    for (const s of b.splits) {
      const share = r.shares.find((x) => x.partyId === s.partyId);
      if (share) share.bhdCents += toBhd(s.amountCents, inv.currency);
      else r.shares.push({ partyId: s.partyId, partyName: s.partyName, bhdCents: toBhd(s.amountCents, inv.currency) });
    }
  }
  for (const [projectId, bhd] of ctx.unallocatedByProject) {
    if (filter.projectId && projectId !== filter.projectId) continue;
    row(projectId).costsBhdCents += bhd;
  }
  for (const r of rows.values()) r.netProfitBhdCents = r.revenueBhdCents - r.costsBhdCents;
  return [...rows.values()].sort((a, b) => b.revenueBhdCents - a.revenueBhdCents || a.projectName.localeCompare(b.projectName));
}

export type PartnerProfitRow = {
  partyId: string;
  partyName: string;
  kind: PartyKind;
  /** Entitled (partners) or accrued (funds). */
  totalBhdCents: number;
  paidBhdCents: number;
  remainingBhdCents: number;
};

export async function getProfitByPartnerReport(): Promise<PartnerProfitRow[]> {
  const { partners, funds } = await getPartyBalances();
  return [
    ...partners.map((p) => ({
      partyId: p.party.id,
      partyName: p.party.name,
      kind: p.party.kind,
      totalBhdCents: p.entitledBhdCents,
      paidBhdCents: p.paidBhdCents,
      remainingBhdCents: p.remainingBhdCents,
    })),
    ...funds.map((f) => ({
      partyId: f.party.id,
      partyName: f.party.name,
      kind: f.party.kind,
      totalBhdCents: f.accruedBhdCents,
      paidBhdCents: f.spentBhdCents,
      remainingBhdCents: f.balanceBhdCents,
    })),
  ];
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
  for (const doc of await loadCountedInvoices()) {
    const net = netTotalCents(doc);
    const outstanding = Math.max(net - doc.paidCents, 0);
    const outstandingBhd = toBhd(outstanding, doc.currency);
    if (doc.status !== "sent" || outstanding <= 0) {
      report.paidCount += 1;
      report.paidBhdCents += toBhd(net, doc.currency);
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
  for (const doc of await loadCountedInvoices()) {
    if (doc.status !== "sent") continue;
    const outstanding = Math.max(netTotalCents(doc) - doc.paidCents, 0);
    if (outstanding <= 0) continue;
    const overdueDays = doc.dueAt ? -daysUntil(doc.dueAt) : 0;
    const i = overdueDays <= 0 ? 0 : overdueDays <= 30 ? 1 : overdueDays <= 60 ? 2 : 3;
    buckets[i]!.count += 1;
    buckets[i]!.bhdCents += toBhd(outstanding, doc.currency);
  }
  return buckets;
}

export type HostingFeeReport = {
  collectedBhdCents: number;
  dueBhdCents: number;
  annualizedBhdCents: number;
  /** Yearly vendor cost of the fees that have one (item 14). */
  annualCostBhdCents: number;
  /** Fees whose client price isn't known yet. */
  tbdCount: number;
};

/**
 * Collected = payments this calendar year on every invoice billed for a
 * hosting fee (item 12). Due = active fees still to collect this cycle.
 */
export async function getHostingFeeReport(): Promise<HostingFeeReport> {
  const yearStart = `${todayYmd().slice(0, 4)}-01-01`;
  const [subs, collected] = await Promise.all([
    many<{
      amountCents: number | null;
      currency: Currency;
      cycle: keyof typeof CYCLE_MONTHS;
      status: string;
      annualCostBhdCents: number | null;
    }>(
      `select h.amount_cents, h.currency, h.cycle, h.status,
         ${ANNUAL_COST_SQL} as annual_cost_bhd_cents
       from hosting_subscriptions h left join recurring_expenses r on r.id = h.recurring_expense_id`,
    ),
    many<{ currency: Currency; amount: number }>(
      `select d.currency, sum(p.amount_cents)::int8 as amount from payments p
       join documents d on d.id = p.document_id
       where d.hosting_subscription_id is not null and d.status <> 'void' and p.paid_on >= $1::date
       group by d.currency`,
      [yearStart],
    ),
  ]);
  let due = 0;
  let annualized = 0;
  let annualCost = 0;
  let tbdCount = 0;
  for (const s of subs) {
    if (s.status === "paused" || s.status === "not_started") continue;
    if (s.amountCents === null) {
      tbdCount += 1;
    } else {
      due += toBhd(s.amountCents, s.currency);
      annualized += toBhd(Math.round((s.amountCents * 12) / CYCLE_MONTHS[s.cycle]), s.currency);
    }
    annualCost += s.annualCostBhdCents ?? 0;
  }
  return {
    collectedBhdCents: collected.reduce((sum, r) => sum + toBhd(r.amount, r.currency), 0),
    dueBhdCents: due,
    annualizedBhdCents: annualized,
    annualCostBhdCents: annualCost,
    tbdCount,
  };
}

/**
 * A hosting fee's yearly vendor cost in BHD: its linked recurring expense
 * (annualized), else the yearly cost typed on the fee. Needs
 * `hosting_subscriptions h left join recurring_expenses r`.
 */
export const ANNUAL_COST_SQL = `
  case
    when r.id is not null then round(r.amount_cents * (12.0 / case r.cycle when 'monthly' then 1 when 'quarterly' then 3 else 12 end)
      * case r.currency when 'USD' then 10 / 2.6596 else 1 end)::int8
    when h.cost_per_year_cents is not null then round(h.cost_per_year_cents
      * case h.cost_currency when 'USD' then 10 / 2.6596 else 1 end)::int8
  end`;

// --- Cash flow ---

export type CashFlowMonth = { month: string; label: string; inBhdCents: number; outBhdCents: number };

/**
 * Cash in (payments received) vs out (expenses paid by the company, payouts
 * to partners, refunds), last `months` months, oldest first. Void documents
 * don't count.
 */
export async function getMonthlyCashFlow(months = 12): Promise<CashFlowMonth[]> {
  const start = addMonthsYmd(monthStartYmd(), -(months - 1));
  const rows = await many<{ month: string; direction: "in" | "out"; currency: Currency; amount: number }>(
    `select to_char(p.paid_on, 'YYYY-MM') as month, case when d.type = 'credit_note' then 'out' else 'in' end as direction,
       d.currency, sum(p.amount_cents)::int8 as amount
     from payments p join documents d on d.id = p.document_id
     where p.paid_on >= $1::date and d.status <> 'void' group by 1, 2, 3
     union all
     select to_char(spent_on, 'YYYY-MM'), 'out', 'BHD', sum(amount_bhd_cents)::int8
     from expenses where spent_on >= $1::date and paid_by_party_id is null group by 1
     union all
     select to_char(paid_on, 'YYYY-MM'), 'out', currency, sum(amount_cents)::int8
     from payouts where paid_on >= $1::date group by 1, 3`,
    [start],
  );
  const result: CashFlowMonth[] = [];
  for (let i = 0; i < months; i++) {
    const ymd = addMonthsYmd(start, i);
    const month = ymd.slice(0, 7);
    const sum = (direction: "in" | "out") =>
      rows.filter((r) => r.month === month && r.direction === direction).reduce((s, r) => s + toBhd(r.amount, r.currency), 0);
    result.push({ month, label: formatDate(ymd, { month: "short" }), inBhdCents: sum("in"), outBhdCents: sum("out") });
  }
  return result;
}

export type ForecastItem = {
  direction: "in" | "out";
  kind: "invoice" | "hosting" | "recurring";
  label: string;
  detail: string;
  date: string;
  bhdCents: number;
  href: string;
};

export type CashFlowForecastMonth = {
  /** YYYY-MM */
  month: string;
  label: string;
  expectedBhdCents: number;
  expectedOutBhdCents: number;
  items: ForecastItem[];
};

/**
 * The next `months` months, starting next month (item 29): expected inflow
 * (open invoice balances due in-month + scheduled hosting collections) and
 * outflow (active recurring expenses due), with what makes up each figure.
 */
export async function getCashFlowForecast(months = 3): Promise<CashFlowForecastMonth[]> {
  const [invoices, hosting, recurring] = await Promise.all([
    loadCountedInvoices(),
    many<{ id: string; clientName: string; label: string | null; item: string; amountCents: number | null; currency: Currency; nextDueDate: string | null; cycle: keyof typeof CYCLE_MONTHS }>(
      `select h.id, c.name as client_name, h.label, h.item, h.amount_cents, h.currency, h.next_due_date, h.cycle
       from hosting_subscriptions h join clients c on c.id = h.client_id where h.status in ('active', 'overdue')`,
    ),
    many<{ id: string; name: string; amountCents: number; currency: Currency; nextDueDate: string | null; cycle: keyof typeof CYCLE_MONTHS }>(
      "select id, name, amount_cents, currency, next_due_date, cycle from recurring_expenses where status = 'active'",
    ),
  ]);
  const nextMonth = addMonthsYmd(monthStartYmd(), 1);
  const out: CashFlowForecastMonth[] = [];
  for (let i = 0; i < months; i++) {
    const start = addMonthsYmd(nextMonth, i);
    const end = addMonthsYmd(nextMonth, i + 1);
    const items: ForecastItem[] = [];
    for (const doc of invoices) {
      if (doc.status !== "sent" || !doc.dueAt) continue;
      const open = Math.max(netTotalCents(doc) - doc.paidCents, 0);
      if (open > 0 && doc.dueAt >= start && doc.dueAt < end) {
        items.push({ direction: "in", kind: "invoice", label: doc.clientName, detail: doc.documentNumber, date: doc.dueAt, bhdCents: toBhd(open, doc.currency), href: `/documents/${doc.id}` });
      }
    }
    // Recurring schedules repeat — project each forward through the window.
    const dates = (next: string | null, cycle: keyof typeof CYCLE_MONTHS) => {
      const found: string[] = [];
      if (!next) return found;
      for (let d = next.slice(0, 10); d < end; d = addMonthsYmd(d, CYCLE_MONTHS[cycle])) if (d >= start) found.push(d);
      return found;
    };
    for (const h of hosting) {
      if (h.amountCents === null) continue;
      for (const date of dates(h.nextDueDate, h.cycle)) {
        items.push({ direction: "in", kind: "hosting", label: h.clientName, detail: `${h.label ?? h.item} hosting fee`, date, bhdCents: toBhd(h.amountCents, h.currency), href: "/hosting" });
      }
    }
    for (const r of recurring) {
      for (const date of dates(r.nextDueDate, r.cycle)) {
        items.push({ direction: "out", kind: "recurring", label: r.name, detail: "Recurring expense", date, bhdCents: toBhd(r.amountCents, r.currency), href: "/finance/expenses?tab=recurring" });
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    out.push({
      month: start.slice(0, 7),
      label: formatDate(start, { month: "long", year: "numeric" }),
      expectedBhdCents: items.filter((x) => x.direction === "in").reduce((s, x) => s + x.bhdCents, 0),
      expectedOutBhdCents: items.filter((x) => x.direction === "out").reduce((s, x) => s + x.bhdCents, 0),
      items,
    });
  }
  return out;
}
