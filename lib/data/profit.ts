import { many } from "./sql";
import type { Currency, DeductionType, DocumentRecord, Party, ProfitSplitRule } from "./types";
import { allocateByBps, convertMinorUnits, taxCents as pct } from "@/lib/money";

/**
 * Profit per invoice (Improvements PRD items 3–6).
 *
 * Starting from the invoice total (less any credit notes):
 *   1. pass-through costs — expenses charged to this invoice, then this
 *      invoice's share of the project's other expenses (spread across the
 *      project's invoices by value, so every expense is counted exactly once);
 *   2. the split rule's deductions, in order. A percentage is taken from the
 *      invoice total or from what remains after everything above it. A
 *      deduction whose type feeds a fund (the Newmux reserve) is an
 *      allocation of profit, not a cost;
 *   3. what is left is split between the rule's parties.
 */

/** Invoices that count: issued and not voided. Archived invoices were paid and filed, so they still count. */
export const COUNTED_INVOICE_SQL = "d.type = 'invoice' and d.status not in ('draft', 'void')";

export type InvoiceForProfit = DocumentRecord & {
  paidCents: number;
  /** Issued credit notes against this invoice. */
  creditedCents: number;
  projectName: string | null;
  clientName: string;
};

const INVOICE_SELECT = `
  select d.*, p.name as project_name, c.name as client_name,
    coalesce((select sum(pay.amount_cents) from payments pay where pay.document_id = d.id), 0)::int8 as paid_cents,
    coalesce((select sum(cn.total_cents) from documents cn
              where cn.credit_for_id = d.id and cn.type = 'credit_note' and cn.status not in ('draft', 'void')), 0)::int8 as credited_cents
  from documents d
  left join projects p on p.id = d.project_id
  join clients c on c.id = d.client_id`;

export async function loadCountedInvoices(filter: { projectId?: string } = {}): Promise<InvoiceForProfit[]> {
  const params: unknown[] = [];
  const where = [COUNTED_INVOICE_SQL];
  if (filter.projectId) where.push(`d.project_id = $${params.push(filter.projectId)}`);
  return many<InvoiceForProfit>(`${INVOICE_SELECT} where ${where.join(" and ")} order by d.issued_at nulls last, d.created_at`, params);
}

export async function loadInvoiceForProfit(id: string): Promise<InvoiceForProfit | undefined> {
  return (await many<InvoiceForProfit>(`${INVOICE_SELECT} where d.id = $1 and d.type = 'invoice'`, [id]))[0];
}

/** Invoice value after credit notes. */
export const netTotalCents = (inv: Pick<InvoiceForProfit, "totalCents" | "creditedCents">) => inv.totalCents - inv.creditedCents;

export type CostExpense = {
  id: string;
  description: string;
  currency: Currency;
  amountCents: number;
  /** Stored at the payment date's rate (item 17); falls back to the peg. */
  amountBhdCents: number | null;
  linkedProjectId: string | null;
  documentId: string | null;
};

export const expenseBhdCents = (e: Pick<CostExpense, "amountCents" | "currency" | "amountBhdCents">) =>
  e.amountBhdCents ?? convertMinorUnits(e.amountCents, e.currency, "BHD");

export type BreakdownLine = {
  deductionTypeId: string | null;
  name: string;
  amountCents: number;
  /** cost: reduces profit. allocation: part of profit set aside for a fund. */
  kind: "cost" | "allocation";
  source: "invoice_expense" | "project_expense" | "rule";
  fundPartyId: string | null;
  /** e.g. "20% of remaining" */
  basis?: string;
};

export type ProfitBreakdown = {
  /** Invoice total less credit notes. */
  invoiceTotalCents: number;
  ruleId: string | null;
  ruleScope: ProfitSplitRule["scopeType"] | null;
  deductions: BreakdownLine[];
  totalDeductionsCents: number;
  costCents: number;
  netProfitCents: number;
  splits: { partyId: string; partyName: string; partyKind: Party["kind"]; percentageBps: number; amountCents: number }[];
};

type CostLine = Omit<BreakdownLine, "deductionTypeId" | "kind" | "fundPartyId"> & { bhdCents: number };

export type ProfitContext = {
  rules: ProfitSplitRule[];
  types: DeductionType[];
  parties: Party[];
  /** Pass-through cost lines per invoice id, in BHD. */
  costs: Map<string, CostLine[]>;
  /** Project expenses with no invoice to carry them (BHD), per project id. */
  unallocatedByProject: Map<string, number>;
  /** All expense BHD per project (for P&L). */
  expenseBhdByProject: Map<string, number>;
};

/** The rule that governs an invoice: its own override, else its project's rule. */
export function ruleForInvoice(doc: Pick<DocumentRecord, "profitSplitRuleId" | "projectId">, rules: ProfitSplitRule[]): ProfitSplitRule | undefined {
  return (
    (doc.profitSplitRuleId ? rules.find((r) => r.id === doc.profitSplitRuleId) : undefined) ??
    (doc.projectId ? rules.find((r) => r.scopeType === "project" && r.scopeId === doc.projectId) : undefined)
  );
}

/**
 * Loads rules, types, parties and expenses, and spreads each project's
 * expenses over `invoices` (which must hold every counted invoice of those
 * projects, or the shares would be wrong).
 */
export async function buildProfitContext(invoices: InvoiceForProfit[], opts: { projectIds?: string[] } = {}): Promise<ProfitContext> {
  const [rules, types, parties, expenses] = await Promise.all([
    many<ProfitSplitRule>("select * from profit_split_rules"),
    many<DeductionType>("select id, name, kind, fund_party_id from deduction_types"),
    many<Party>("select id, name, kind from parties"),
    many<CostExpense>(
      `select id, description, currency, amount_cents, amount_bhd_cents, linked_project_id, document_id
       from expenses where linked_project_id is not null or document_id is not null`,
    ),
  ]);
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const costs = new Map<string, CostLine[]>();
  const push = (id: string, line: CostLine) => costs.set(id, [...(costs.get(id) ?? []), line]);
  const projectPool = new Map<string, CostExpense[]>();
  const expenseBhdByProject = new Map<string, number>();

  for (const e of expenses) {
    if (e.linkedProjectId) expenseBhdByProject.set(e.linkedProjectId, (expenseBhdByProject.get(e.linkedProjectId) ?? 0) + expenseBhdCents(e));
    if (e.documentId && invoiceIds.has(e.documentId)) {
      push(e.documentId, { name: e.description, amountCents: 0, bhdCents: expenseBhdCents(e), source: "invoice_expense" });
    } else if (e.linkedProjectId && !e.documentId) {
      projectPool.set(e.linkedProjectId, [...(projectPool.get(e.linkedProjectId) ?? []), e]);
    } else if (e.linkedProjectId && e.documentId) {
      // Charged to an invoice that doesn't count (draft or void): fall back to the project.
      projectPool.set(e.linkedProjectId, [...(projectPool.get(e.linkedProjectId) ?? []), e]);
    }
  }

  const unallocatedByProject = new Map<string, number>();
  const projectIds = new Set([...(opts.projectIds ?? []), ...projectPool.keys()]);
  for (const projectId of projectIds) {
    const pool = projectPool.get(projectId) ?? [];
    const totalBhd = pool.reduce((s, e) => s + expenseBhdCents(e), 0);
    if (totalBhd === 0) continue;
    const carriers = invoices.filter((i) => i.projectId === projectId);
    const weights = carriers.map((i) => Math.max(convertMinorUnits(netTotalCents(i), i.currency, "BHD"), 0));
    if (weights.reduce((a, b) => a + b, 0) === 0) {
      unallocatedByProject.set(projectId, totalBhd);
      continue;
    }
    const shares = allocateByBps(totalBhd, weights);
    carriers.forEach((inv, k) => {
      if (shares[k]! === 0) return;
      push(inv.id, {
        name: pool.length === 1 ? pool[0]!.description : `Project costs (${pool.length} expenses)`,
        amountCents: 0,
        bhdCents: shares[k]!,
        source: "project_expense",
        basis: carriers.length > 1 ? `${Math.round((weights[k]! / weights.reduce((a, b) => a + b, 0)) * 100)}% share` : undefined,
      });
    });
  }
  return { rules, types, parties, costs, unallocatedByProject, expenseBhdByProject };
}

/** Converts a BHD amount into the invoice's currency (identity for BHD invoices). */
const fromBhd = (bhdCents: number, currency: Currency) => convertMinorUnits(bhdCents, "BHD", currency);

export function computeBreakdown(doc: InvoiceForProfit, ctx: ProfitContext): ProfitBreakdown {
  const total = netTotalCents(doc);
  const rule = ruleForInvoice(doc, ctx.rules);
  const lines: BreakdownLine[] = (ctx.costs.get(doc.id) ?? []).map((c) => ({
    deductionTypeId: null,
    name: c.name,
    amountCents: fromBhd(c.bhdCents, doc.currency),
    kind: "cost",
    source: c.source,
    fundPartyId: null,
    basis: c.basis,
  }));
  let remaining = total - lines.reduce((s, l) => s + l.amountCents, 0);

  for (const d of rule?.deductions ?? []) {
    const type = ctx.types.find((t) => t.id === d.deductionTypeId);
    const base = d.base ?? "total";
    let amountCents: number;
    let basis: string;
    if (type?.kind === "percentage") {
      amountCents = pct(Math.max(base === "remaining" ? remaining : total, 0), d.value);
      basis = `${d.value / 100}% of ${base === "remaining" ? "remaining" : "total"}`;
    } else {
      amountCents = fromBhd(d.value, doc.currency);
      basis = "Fixed";
    }
    remaining -= amountCents;
    lines.push({
      deductionTypeId: d.deductionTypeId,
      name: type?.name ?? "Deduction",
      amountCents,
      kind: type?.fundPartyId ? "allocation" : "cost",
      source: "rule",
      fundPartyId: type?.fundPartyId ?? null,
      basis,
    });
  }

  const net = remaining;
  const splitsIn = rule?.splits ?? [];
  const amounts = allocateByBps(Math.max(net, 0), splitsIn.map((s) => s.percentageBps));
  const splits = splitsIn.map((s, i) => {
    const party = ctx.parties.find((p) => p.id === s.partyId);
    return {
      partyId: s.partyId,
      partyName: party?.name ?? "Unknown",
      partyKind: party?.kind ?? "partner",
      percentageBps: s.percentageBps,
      amountCents: net < 0 ? pct(net, s.percentageBps) : amounts[i]!,
    };
  });
  const totalDeductionsCents = lines.reduce((s, l) => s + l.amountCents, 0);
  return {
    invoiceTotalCents: total,
    ruleId: rule?.id ?? null,
    ruleScope: rule?.scopeType ?? null,
    deductions: lines,
    totalDeductionsCents,
    costCents: lines.filter((l) => l.kind === "cost").reduce((s, l) => s + l.amountCents, 0),
    netProfitCents: net,
    splits,
  };
}

/** Breakdowns for every counted invoice (optionally one project's), with one round of lookups. */
export async function loadBreakdowns(filter: { projectId?: string } = {}) {
  const invoices = await loadCountedInvoices(filter);
  const ctx = await buildProfitContext(invoices, { projectIds: filter.projectId ? [filter.projectId] : undefined });
  const breakdowns = new Map(invoices.map((inv) => [inv.id, computeBreakdown(inv, ctx)]));
  return { invoices, ctx, breakdowns };
}

/** One invoice's breakdown. A draft is previewed as if it were issued. */
export async function getInvoiceProfitBreakdown(documentId: string): Promise<ProfitBreakdown | null> {
  const doc = await loadInvoiceForProfit(documentId);
  if (!doc || doc.status === "void") return null;
  const siblings = doc.projectId ? await loadCountedInvoices({ projectId: doc.projectId }) : [];
  const invoices = siblings.some((i) => i.id === doc.id) ? siblings : [...siblings, doc];
  const ctx = await buildProfitContext(invoices, { projectIds: doc.projectId ? [doc.projectId] : [] });
  return computeBreakdown(doc, ctx);
}

/** Each party's share across invoices, in BHD (fund allocations included for funds). */
export function partyEntitlementsBhd(invoices: InvoiceForProfit[], breakdowns: Map<string, ProfitBreakdown>) {
  const entitled = new Map<string, number>();
  const uncollected = new Map<string, number>();
  const add = (map: Map<string, number>, id: string, v: number) => map.set(id, (map.get(id) ?? 0) + v);
  for (const inv of invoices) {
    const b = breakdowns.get(inv.id);
    if (!b) continue;
    const net = netTotalCents(inv);
    const outstandingShare = net > 0 ? Math.min(Math.max(net - inv.paidCents, 0) / net, 1) : 0;
    const credit = (partyId: string, amount: number) => {
      const bhd = convertMinorUnits(amount, inv.currency, "BHD");
      add(entitled, partyId, bhd);
      add(uncollected, partyId, Math.round(bhd * outstandingShare));
    };
    for (const s of b.splits) credit(s.partyId, s.amountCents);
    for (const l of b.deductions) if (l.fundPartyId) credit(l.fundPartyId, l.amountCents);
  }
  return { entitled, uncollected };
}
