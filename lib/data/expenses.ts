import { query, tx } from "@/lib/db";
import { many, must, one, NotFoundError, ValidationError } from "./sql";
import { logAudit } from "./audit";
import { createPayout } from "./ledger";
import type { Currency, Expense } from "./types";
import { centsToDisplay, convertMinorUnits, minorUnitDigits } from "@/lib/money";
import { todayYmd } from "@/lib/time";

export type ReimbursementStatus = "not_required" | "pending" | "reimbursed";

export type ExpenseRecord = Expense & {
  linkedVentureId: string | null;
  /** BHD value at the payment date's rate (item 17). */
  amountBhdCents: number | null;
  /** BHD per one unit of the expense currency. */
  fxRate: number | null;
  /** Null = paid from a company account; otherwise the partner who paid personally (item 16). */
  paidByPartyId: string | null;
  reimbursementStatus: ReimbursementStatus;
  reimbursementPayoutId: string | null;
  receiptFileId: string | null;
};

export type ExpenseListItem = ExpenseRecord & {
  clientName: string | null;
  projectName: string | null;
  ventureName: string | null;
  paidByName: string | null;
  fundName: string | null;
  documentNumber: string | null;
  accountName: string | null;
};

export async function listExpenses(
  filter: { from?: string; to?: string; projectId?: string; clientId?: string; ventureId?: string; fundId?: string } = {},
): Promise<ExpenseListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.from) where.push(`e.spent_on >= $${params.push(filter.from)}::date`);
  if (filter.to) where.push(`e.spent_on < $${params.push(filter.to)}::date`);
  if (filter.projectId) where.push(`e.linked_project_id = $${params.push(filter.projectId)}`);
  if (filter.clientId) where.push(`e.linked_client_id = $${params.push(filter.clientId)}`);
  if (filter.ventureId) where.push(`e.linked_venture_id = $${params.push(filter.ventureId)}`);
  if (filter.fundId) where.push(`e.fund_party_id = $${params.push(filter.fundId)}`);
  return many<ExpenseListItem>(
    `select e.*, c.name as client_name, p.name as project_name, v.name as venture_name, pb.name as paid_by_name,
       f.name as fund_name, d.document_number, a.name as account_name
     from expenses e
     left join clients c on c.id = e.linked_client_id
     left join projects p on p.id = e.linked_project_id
     left join ventures v on v.id = e.linked_venture_id
     left join parties pb on pb.id = e.paid_by_party_id
     left join parties f on f.id = e.fund_party_id
     left join documents d on d.id = e.document_id
     left join bank_accounts a on a.id = e.account_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by e.spent_on desc, e.created_at desc`,
    params,
  );
}

export type ExpenseInput = {
  description: string;
  category: string;
  vendor?: string | null;
  amountCents: number;
  currency: Currency;
  /** For non-BHD expenses: what it actually cost in BHD (e.g. from the card statement). Defaults to the peg. */
  amountBhdCents?: number | null;
  spentOn: string;
  linkedClientId?: string | null;
  linkedProjectId?: string | null;
  linkedVentureId?: string | null;
  /** Pass-through cost of this invoice. */
  documentId?: string | null;
  accountId?: string | null;
  paidByPartyId?: string | null;
  reimbursementStatus?: ReimbursementStatus;
  /** Fund the expense is charged to (spends the reserve). */
  fundPartyId?: string | null;
  receiptFileId?: string | null;
  notes?: string | null;
};

/** The BHD value and the rate behind it (item 17). */
function bhdValue(input: Pick<ExpenseInput, "amountCents" | "currency" | "amountBhdCents">) {
  if (input.currency === "BHD") return { amountBhdCents: input.amountCents, fxRate: 1 };
  const amountBhdCents = input.amountBhdCents ?? convertMinorUnits(input.amountCents, input.currency, "BHD");
  const major = input.amountCents / 10 ** minorUnitDigits(input.currency);
  return { amountBhdCents, fxRate: major ? Number((amountBhdCents / 1000 / major).toFixed(6)) : null };
}

async function validate(input: ExpenseInput) {
  if (input.documentId) {
    const doc = await one<{ type: string; projectId: string | null }>("select type, project_id from documents where id = $1", [input.documentId]);
    if (doc?.type !== "invoice") throw new ValidationError("Pass-through costs can only be charged to an invoice.");
    if (input.linkedProjectId && doc.projectId && doc.projectId !== input.linkedProjectId) {
      throw new ValidationError("That invoice belongs to a different project.");
    }
  }
  if (input.paidByPartyId && input.fundPartyId === input.paidByPartyId) throw new ValidationError("A fund can't pay for itself.");
}

const COLUMNS = `description, category, vendor, amount_cents, currency, amount_bhd_cents, fx_rate, spent_on, linked_client_id,
  linked_project_id, linked_venture_id, document_id, account_id, paid_by_party_id, reimbursement_status, fund_party_id, receipt_file_id, notes`;

function values(input: ExpenseInput) {
  const { amountBhdCents, fxRate } = bhdValue(input);
  const status: ReimbursementStatus = input.paidByPartyId ? (input.reimbursementStatus ?? "pending") : "not_required";
  return [
    input.description,
    input.category,
    input.vendor ?? null,
    input.amountCents,
    input.currency,
    amountBhdCents,
    fxRate,
    input.spentOn,
    input.linkedClientId ?? null,
    input.linkedProjectId ?? null,
    input.linkedVentureId ?? null,
    input.documentId ?? null,
    input.paidByPartyId ? null : (input.accountId ?? null),
    input.paidByPartyId ?? null,
    status,
    input.fundPartyId ?? null,
    input.receiptFileId ?? null,
    input.notes ?? null,
  ];
}

export async function createExpense(input: ExpenseInput, createdBy: string): Promise<ExpenseRecord> {
  await validate(input);
  const e = await must<ExpenseRecord>(
    "Expense",
    `insert into expenses (${COLUMNS}, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning *`,
    [...values(input), createdBy],
  );
  await logAudit({ entityType: "expense", entityId: e.id, action: "create", summary: `Logged expense "${e.description}" (${centsToDisplay(e.amountCents, e.currency)})`, changedBy: createdBy });
  return e;
}

export async function updateExpense(id: string, input: ExpenseInput, changedBy: string): Promise<ExpenseRecord> {
  await validate(input);
  const before = await must<ExpenseRecord>("Expense", "select * from expenses where id = $1", [id]);
  if (before.reimbursementStatus === "reimbursed" && (input.paidByPartyId !== before.paidByPartyId || input.amountCents !== before.amountCents)) {
    throw new ValidationError("This expense has been reimbursed. Delete the reimbursement payout before changing who paid or the amount.");
  }
  const vals = values(input);
  // Keep "reimbursed" (and its payout) when nothing about who paid changed.
  if (before.reimbursementStatus === "reimbursed" && input.paidByPartyId === before.paidByPartyId) vals[14] = "reimbursed";
  const e = await must<ExpenseRecord>(
    "Expense",
    `update expenses set (${COLUMNS}) = ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) where id = $1 returning *`,
    [id, ...vals],
  );
  await logAudit({ entityType: "expense", entityId: id, action: "update", summary: `Edited expense "${e.description}"`, changedBy });
  return e;
}

export async function deleteExpense(id: string, deletedBy: string): Promise<void> {
  const e = await one<ExpenseRecord>("select * from expenses where id = $1", [id]);
  if (!e) throw new NotFoundError("Expense");
  if (e.reimbursementPayoutId) throw new ValidationError("This expense has been reimbursed. Delete the reimbursement payout first.");
  await query("delete from expenses where id = $1", [id]);
  await logAudit({ entityType: "expense", entityId: id, action: "delete", summary: `Deleted expense "${e.description}"`, changedBy: deletedBy });
}

/** Item 16: pays a partner back for a cost they covered personally (a payout from the company account). */
export async function reimburseExpense(id: string, input: { paidOn?: string; accountId?: string | null }, by: string) {
  return tx(async () => {
    const e = await must<ExpenseRecord>("Expense", "select * from expenses where id = $1 for update", [id]);
    if (!e.paidByPartyId) throw new ValidationError("This expense was paid from a company account.");
    if (e.reimbursementStatus === "reimbursed") throw new ValidationError("Already reimbursed.");
    const payout = await createPayout(
      {
        partyId: e.paidByPartyId,
        type: "reimbursement",
        amountCents: e.amountBhdCents ?? convertMinorUnits(e.amountCents, e.currency, "BHD"),
        currency: "BHD",
        paidOn: input.paidOn ?? todayYmd(),
        accountId: input.accountId ?? null,
        notes: `Reimbursement for "${e.description}"`,
      },
      by,
    );
    await query("update expenses set reimbursement_status = 'reimbursed', reimbursement_payout_id = $2 where id = $1", [id, payout.id]);
    return payout;
  });
}

/** Venture spending totals (item 15). */
export async function getVentureSpend(ventureId: string) {
  const yearStart = `${todayYmd().slice(0, 4)}-01-01`;
  const [totals, recurring] = await Promise.all([
    one<{ allTime: number; thisYear: number; count: number }>(
      `select coalesce(sum(amount_bhd_cents), 0)::int8 as all_time,
         coalesce(sum(amount_bhd_cents) filter (where spent_on >= $2::date), 0)::int8 as this_year,
         count(*)::int as count
       from expenses where linked_venture_id = $1`,
      [ventureId, yearStart],
    ),
    many<{ id: string; name: string; amountCents: number; currency: Currency; cycle: "monthly" | "quarterly" | "annual"; status: string }>(
      "select id, name, amount_cents, currency, cycle, status from recurring_expenses where linked_venture_id = $1 order by name",
      [ventureId],
    ),
  ]);
  const months = { monthly: 1, quarterly: 3, annual: 12 } as const;
  const monthlyRunRateBhdCents = recurring
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + Math.round(convertMinorUnits(r.amountCents, r.currency, "BHD") / months[r.cycle]), 0);
  return { allTimeBhdCents: totals?.allTime ?? 0, thisYearBhdCents: totals?.thisYear ?? 0, count: totals?.count ?? 0, recurring, monthlyRunRateBhdCents };
}
