import { query, tx } from "@/lib/db";
import { many, one, must, NotFoundError, ValidationError } from "./sql";
import { logAudit } from "./audit";
import { loadBreakdowns, partyEntitlementsBhd, expenseBhdCents } from "./profit";
import type { BankAccount, BankReconciliation, Currency, Party, Payout, PayoutType } from "./types";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { todayYmd } from "@/lib/time";

/**
 * The company's money (Improvements PRD items 1, 2, 6, 16):
 *
 *   account balance = opening balance
 *                   + payments received on invoices
 *                   − expenses paid from the account
 *                   − payouts to partners (shares, advances, reimbursements)
 *                   − refunds on credit notes
 *                   ± reconciliation adjustments
 *
 * counting only movements dated on or after the account's opening date.
 * Rows without an account belong to the default account.
 */

// --- Bank accounts ---

export async function listBankAccounts(opts: { activeOnly?: boolean } = {}): Promise<BankAccount[]> {
  return many<BankAccount>(
    `select * from bank_accounts ${opts.activeOnly ? "where is_active" : ""} order by is_default desc, created_at`,
  );
}

export type BankAccountInput = {
  name: string;
  currency: Currency;
  openingBalanceCents: number;
  openingBalanceDate: string;
  isDefault?: boolean;
};

export async function createBankAccount(input: BankAccountInput, createdBy: string): Promise<BankAccount> {
  return tx(async () => {
    const first = !(await one("select 1 from bank_accounts limit 1"));
    const isDefault = first || !!input.isDefault;
    if (isDefault) await query("update bank_accounts set is_default = false where is_default");
    const account = await must<BankAccount>(
      "Account",
      `insert into bank_accounts (name, currency, opening_balance_cents, opening_balance_date, is_default)
       values ($1,$2,$3,$4,$5) returning *`,
      [input.name, input.currency, input.openingBalanceCents, input.openingBalanceDate, isDefault],
    );
    await logAudit({
      entityType: "bank_account",
      entityId: account.id,
      action: "create",
      summary: `Added account "${account.name}" with an opening balance of ${centsToDisplay(account.openingBalanceCents, account.currency)} on ${account.openingBalanceDate}`,
      changedBy: createdBy,
    });
    return account;
  });
}

export async function updateBankAccount(id: string, input: BankAccountInput & { isActive?: boolean }, changedBy: string): Promise<BankAccount> {
  return tx(async () => {
    const before = await must<BankAccount>("Account", "select * from bank_accounts where id = $1 for update", [id]);
    if (input.isDefault) await query("update bank_accounts set is_default = false where is_default and id <> $1", [id]);
    const account = await must<BankAccount>(
      "Account",
      `update bank_accounts set name = $2, currency = $3, opening_balance_cents = $4, opening_balance_date = $5,
         is_default = case when $6::boolean then true else is_default end, is_active = coalesce($7, is_active), updated_at = now()
       where id = $1 returning *`,
      [id, input.name, input.currency, input.openingBalanceCents, input.openingBalanceDate, !!input.isDefault, input.isActive ?? null],
    );
    const changes: string[] = [];
    if (before.openingBalanceCents !== account.openingBalanceCents || before.openingBalanceDate !== account.openingBalanceDate)
      changes.push(`opening balance ${centsToDisplay(account.openingBalanceCents, account.currency)} on ${account.openingBalanceDate}`);
    await logAudit({
      entityType: "bank_account",
      entityId: id,
      action: "update",
      summary: `Edited account "${account.name}"${changes.length ? `: ${changes.join(", ")}` : ""}`,
      changedBy,
    });
    return account;
  });
}

export async function deleteBankAccount(id: string, deletedBy: string): Promise<void> {
  const account = await one<BankAccount>("select * from bank_accounts where id = $1", [id]);
  if (!account) throw new NotFoundError("Account");
  const used = await one(
    `select 1 where exists (select 1 from payments where account_id = $1) or exists (select 1 from expenses where account_id = $1)
       or exists (select 1 from payouts where account_id = $1)`,
    [id],
  );
  if (used || account.isDefault) {
    throw new ValidationError(
      account.isDefault ? "This is the default account. Make another account the default first." : "Money has moved through this account. Mark it inactive instead.",
    );
  }
  await query("delete from bank_accounts where id = $1", [id]);
  await logAudit({ entityType: "bank_account", entityId: id, action: "delete", summary: `Deleted account "${account.name}"`, changedBy: deletedBy });
}

// --- Movements & balances ---

export type MovementKind = "payment" | "refund" | "expense" | "payout" | "adjustment";

export type Movement = {
  accountId: string;
  date: string;
  kind: MovementKind;
  refId: string;
  description: string;
  /** Signed, in the account's currency: + in, − out. */
  amountCents: number;
  href: string | null;
};

type RawMovement = {
  accountId: string;
  date: string;
  kind: MovementKind;
  refId: string;
  description: string;
  currency: Currency;
  amountCents: number;
  bhdCents: number | null;
  href: string | null;
};

/**
 * Every movement for the given accounts between each account's opening date
 * and `to` (inclusive). Payments on void documents don't count.
 */
async function rawMovements(to: string): Promise<RawMovement[]> {
  const def = "(select id from bank_accounts where is_default limit 1)";
  return many<RawMovement>(
    `select * from (
       select coalesce(p.account_id, ${def}) as account_id, p.paid_on as date,
         case when d.type = 'credit_note' then 'refund' else 'payment' end as kind,
         p.id as ref_id,
         case when d.type = 'credit_note' then 'Refund on ' else 'Payment on ' end || d.document_number || ' · ' || c.name as description,
         d.currency, case when d.type = 'credit_note' then -p.amount_cents else p.amount_cents end as amount_cents,
         null::int8 as bhd_cents, '/documents/' || d.id as href
       from payments p join documents d on d.id = p.document_id join clients c on c.id = d.client_id
       where d.status <> 'void'
       union all
       select coalesce(e.account_id, ${def}), e.spent_on, 'expense', e.id, e.description, e.currency, -e.amount_cents,
         -e.amount_bhd_cents, '/finance/expenses?id=' || e.id
       from expenses e where e.paid_by_party_id is null
       union all
       select coalesce(po.account_id, ${def}), po.paid_on, 'payout', po.id,
         initcap(po.type) || ' to ' || pa.name, po.currency, -po.amount_cents, null, '/finance/partners/' || pa.id
       from payouts po join parties pa on pa.id = po.party_id
       union all
       select r.account_id, r.statement_date, 'adjustment', r.id, 'Reconciliation adjustment', a.currency, r.adjustment_cents, null, null
       from bank_reconciliations r join bank_accounts a on a.id = r.account_id where r.adjustment_cents <> 0
     ) m
     join bank_accounts a on a.id = m.account_id
     where m.date >= a.opening_balance_date and m.date <= $1::date
     order by m.date, m.kind`,
    [to],
  );
}

function inAccountCurrency(m: RawMovement, currency: Currency): number {
  if (m.currency === currency) return m.amountCents;
  if (currency === "BHD" && m.bhdCents !== null) return m.bhdCents;
  return convertMinorUnits(m.amountCents, m.currency, currency);
}

export type AccountBalance = {
  account: BankAccount;
  balanceCents: number;
  inCents: number;
  outCents: number;
  lastReconciliation: BankReconciliation | null;
};

export async function getAccountBalances(asOf: string = todayYmd()): Promise<AccountBalance[]> {
  const [accounts, movements, recs] = await Promise.all([
    listBankAccounts(),
    rawMovements(asOf),
    many<BankReconciliation>("select distinct on (account_id) * from bank_reconciliations order by account_id, statement_date desc, created_at desc"),
  ]);
  return accounts.map((account) => {
    let inCents = 0;
    let outCents = 0;
    for (const m of movements) {
      if (m.accountId !== account.id) continue;
      const v = inAccountCurrency(m, account.currency);
      if (v >= 0) inCents += v;
      else outCents -= v;
    }
    return {
      account,
      balanceCents: account.openingBalanceCents + inCents - outCents,
      inCents,
      outCents,
      lastReconciliation: recs.find((r) => r.accountId === account.id) ?? null,
    };
  });
}

/** Sum of every active account's balance, in BHD. Null until an account is set up. */
export async function getCompanyBalanceBhd(asOf?: string): Promise<{ balanceBhdCents: number; accounts: AccountBalance[] } | null> {
  const accounts = (await getAccountBalances(asOf)).filter((a) => a.account.isActive);
  if (accounts.length === 0) return null;
  return {
    balanceBhdCents: accounts.reduce((s, a) => s + convertMinorUnits(a.balanceCents, a.account.currency, "BHD"), 0),
    accounts,
  };
}

/** One account's statement: opening line, then movements with a running balance. */
export async function getAccountStatement(accountId: string, to: string = todayYmd()) {
  const account = await must<BankAccount>("Account", "select * from bank_accounts where id = $1", [accountId]);
  let running = account.openingBalanceCents;
  const rows = (await rawMovements(to))
    .filter((m) => m.accountId === accountId)
    .map((m) => {
      const amountCents = inAccountCurrency(m, account.currency);
      running += amountCents;
      return { ...m, amountCents, balanceCents: running } satisfies Movement & { balanceCents: number };
    });
  const reconciliations = await many<BankReconciliation & { createdByName: string | null }>(
    `select r.*, u.full_name as created_by_name from bank_reconciliations r left join users u on u.id = r.created_by
     where r.account_id = $1 order by r.statement_date desc, r.created_at desc`,
    [accountId],
  );
  return { account, rows, balanceCents: running, reconciliations };
}

/**
 * Compares the computed balance on the statement date with the bank's
 * figure. With `adjust`, the difference is posted so the two agree.
 */
export async function reconcileAccount(input: {
  accountId: string;
  statementDate: string;
  statementBalanceCents: number;
  adjust: boolean;
  note?: string | null;
  createdBy: string;
}): Promise<BankReconciliation> {
  return tx(async () => {
    const account = await must<BankAccount>("Account", "select * from bank_accounts where id = $1 for update", [input.accountId]);
    if (input.statementDate < account.openingBalanceDate) {
      throw new ValidationError(`The statement date is before this account's opening balance (${account.openingBalanceDate}).`);
    }
    const computed = (await getAccountBalances(input.statementDate)).find((a) => a.account.id === account.id)!.balanceCents;
    const difference = input.statementBalanceCents - computed;
    const rec = await must<BankReconciliation>(
      "Reconciliation",
      `insert into bank_reconciliations (account_id, statement_date, statement_balance_cents, computed_balance_cents, adjustment_cents, note, created_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [account.id, input.statementDate, input.statementBalanceCents, computed, input.adjust ? difference : 0, input.note ?? null, input.createdBy],
    );
    await logAudit({
      entityType: "bank_account",
      entityId: account.id,
      action: "update",
      summary:
        difference === 0
          ? `Reconciled "${account.name}" with the ${input.statementDate} statement: matches`
          : `Reconciled "${account.name}" with the ${input.statementDate} statement: off by ${centsToDisplay(difference, account.currency)}${input.adjust ? " (adjustment posted)" : ""}`,
      changedBy: input.createdBy,
    });
    return rec;
  });
}

// --- Payouts (item 2) ---

export type PayoutListItem = Payout & { partyName: string; documentNumber: string | null; accountName: string | null };

export async function listPayouts(filter: { partyId?: string } = {}): Promise<PayoutListItem[]> {
  const params: unknown[] = [];
  const where = filter.partyId ? `where po.party_id = $${params.push(filter.partyId)}` : "";
  return many<PayoutListItem>(
    `select po.*, pa.name as party_name, d.document_number, a.name as account_name
     from payouts po join parties pa on pa.id = po.party_id
     left join documents d on d.id = po.document_id
     left join bank_accounts a on a.id = po.account_id
     ${where} order by po.paid_on desc, po.created_at desc`,
    params,
  );
}

export type PayoutInput = {
  partyId: string;
  type: PayoutType;
  amountCents: number;
  currency: Currency;
  paidOn: string;
  documentId?: string | null;
  accountId?: string | null;
  reference?: string | null;
  notes?: string | null;
};

const PAYOUT_LABEL: Record<PayoutType, string> = { share: "profit share", advance: "advance", withdrawal: "withdrawal", reimbursement: "reimbursement" };

export async function createPayout(input: PayoutInput, createdBy: string): Promise<Payout> {
  const party = await must<Party>("Party", "select id, name, kind from parties where id = $1", [input.partyId]);
  const payout = await must<Payout>(
    "Payout",
    `insert into payouts (party_id, type, amount_cents, currency, paid_on, document_id, account_id, reference, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      input.partyId,
      input.type,
      input.amountCents,
      input.currency,
      input.paidOn,
      input.documentId ?? null,
      input.accountId ?? null,
      input.reference ?? null,
      input.notes ?? null,
      createdBy,
    ],
  );
  await logAudit({
    entityType: "payout",
    entityId: payout.id,
    action: "create",
    summary: `Paid ${party.name} ${centsToDisplay(payout.amountCents, payout.currency)} (${PAYOUT_LABEL[payout.type]})`,
    changedBy: createdBy,
  });
  return payout;
}

export async function updatePayout(id: string, input: PayoutInput, changedBy: string): Promise<Payout> {
  const payout = await must<Payout>(
    "Payout",
    `update payouts set party_id = $2, type = $3, amount_cents = $4, currency = $5, paid_on = $6, document_id = $7,
       account_id = $8, reference = $9, notes = $10 where id = $1 returning *`,
    [
      id,
      input.partyId,
      input.type,
      input.amountCents,
      input.currency,
      input.paidOn,
      input.documentId ?? null,
      input.accountId ?? null,
      input.reference ?? null,
      input.notes ?? null,
    ],
  );
  await logAudit({ entityType: "payout", entityId: id, action: "update", summary: `Edited a ${PAYOUT_LABEL[payout.type]} of ${centsToDisplay(payout.amountCents, payout.currency)}`, changedBy });
  return payout;
}

export async function deletePayout(id: string, deletedBy: string): Promise<void> {
  const rows = await query<{ amount_cents: number; currency: string; type: PayoutType }>("delete from payouts where id = $1 returning amount_cents, currency, type", [id]);
  if (!rows.length) throw new NotFoundError("Payout");
  // An expense reimbursed by this payout is owed again.
  await query("update expenses set reimbursement_status = 'pending', reimbursement_payout_id = null where reimbursement_payout_id = $1", [id]);
  await logAudit({
    entityType: "payout",
    entityId: id,
    action: "delete",
    summary: `Deleted a ${PAYOUT_LABEL[rows[0]!.type]} of ${centsToDisplay(rows[0]!.amount_cents, rows[0]!.currency)}`,
    changedBy: deletedBy,
  });
}

// --- Party balances (items 2, 6, 16) ---

export type PartnerBalance = {
  party: Party;
  /** Share of profit on every issued invoice. */
  entitledBhdCents: number;
  /** Part of the entitlement on invoices clients haven't paid yet. */
  uncollectedBhdCents: number;
  /** Shares, advances and withdrawals paid out. */
  paidBhdCents: number;
  /** Company costs the partner paid personally and hasn't been paid back for. */
  reimbursementDueBhdCents: number;
  /** entitled − paid + reimbursements due. Negative = overpaid. */
  remainingBhdCents: number;
};

export type FundBalance = {
  party: Party;
  accruedBhdCents: number;
  spentBhdCents: number;
  balanceBhdCents: number;
};

export async function getPartyBalances(): Promise<{ partners: PartnerBalance[]; funds: FundBalance[] }> {
  const [{ invoices, breakdowns }, parties, payouts, owed, spent] = await Promise.all([
    loadBreakdowns(),
    many<Party>("select id, name, kind from parties order by kind desc, created_at"),
    many<{ partyId: string; type: PayoutType; currency: Currency; amount: number }>(
      "select party_id, type, currency, sum(amount_cents)::int8 as amount from payouts group by 1, 2, 3",
    ),
    many<{ partyId: string; currency: Currency; amountCents: number; amountBhdCents: number | null }>(
      `select paid_by_party_id as party_id, currency, amount_cents, amount_bhd_cents from expenses
       where paid_by_party_id is not null and reimbursement_status = 'pending'`,
    ),
    many<{ partyId: string; currency: Currency; amountCents: number; amountBhdCents: number | null }>(
      "select fund_party_id as party_id, currency, amount_cents, amount_bhd_cents from expenses where fund_party_id is not null",
    ),
  ]);
  const { entitled, uncollected } = partyEntitlementsBhd(invoices, breakdowns);
  const paidBy = (partyId: string, types: PayoutType[]) =>
    payouts.filter((p) => p.partyId === partyId && types.includes(p.type)).reduce((s, p) => s + convertMinorUnits(p.amount, p.currency, "BHD"), 0);

  const partners = parties
    .filter((p) => p.kind === "partner")
    .map((party) => {
      const entitledBhdCents = entitled.get(party.id) ?? 0;
      const paidBhdCents = paidBy(party.id, ["share", "advance", "withdrawal"]);
      const reimbursementDueBhdCents = owed.filter((e) => e.partyId === party.id).reduce((s, e) => s + expenseBhdCents(e), 0);
      return {
        party,
        entitledBhdCents,
        uncollectedBhdCents: uncollected.get(party.id) ?? 0,
        paidBhdCents,
        reimbursementDueBhdCents,
        remainingBhdCents: entitledBhdCents - paidBhdCents + reimbursementDueBhdCents,
      };
    });

  const funds = parties
    .filter((p) => p.kind === "fund")
    .map((party) => {
      const accruedBhdCents = entitled.get(party.id) ?? 0;
      const spentBhdCents =
        spent.filter((e) => e.partyId === party.id).reduce((s, e) => s + expenseBhdCents(e), 0) + paidBy(party.id, ["share", "advance", "withdrawal"]);
      return { party, accruedBhdCents, spentBhdCents, balanceBhdCents: accruedBhdCents - spentBhdCents };
    });

  return { partners, funds };
}

/** A fund's history: what each invoice added and what was spent from it. */
export async function getFundActivity(fundId: string) {
  const [{ invoices, breakdowns }, spending] = await Promise.all([
    loadBreakdowns(),
    many<{ id: string; description: string; spentOn: string; currency: Currency; amountCents: number; amountBhdCents: number | null }>(
      "select id, description, spent_on, currency, amount_cents, amount_bhd_cents from expenses where fund_party_id = $1 order by spent_on desc",
      [fundId],
    ),
  ]);
  const accruals = invoices
    .map((inv) => {
      const b = breakdowns.get(inv.id);
      const amount =
        (b?.deductions.filter((l) => l.fundPartyId === fundId).reduce((s, l) => s + l.amountCents, 0) ?? 0) +
        (b?.splits.filter((s) => s.partyId === fundId).reduce((s, x) => s + x.amountCents, 0) ?? 0);
      return { invoice: inv, bhdCents: convertMinorUnits(amount, inv.currency, "BHD") };
    })
    .filter((a) => a.bhdCents !== 0);
  return { accruals, spending: spending.map((s) => ({ ...s, bhdCents: expenseBhdCents(s) })) };
}

/** What each invoice entitles a partner to, newest first. */
export async function getPartnerEntitlements(partyId: string) {
  const { invoices, breakdowns } = await loadBreakdowns();
  return invoices
    .map((inv) => {
      const split = breakdowns.get(inv.id)?.splits.find((s) => s.partyId === partyId);
      return split ? { invoice: inv, percentageBps: split.percentageBps, amountCents: split.amountCents, bhdCents: convertMinorUnits(split.amountCents, inv.currency, "BHD") } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .reverse();
}
