import { query } from "@/lib/db";
import { many, must, NotFoundError } from "./sql";
import { logAudit } from "./audit";
import type { Currency, Expense } from "./types";
import { centsToDisplay } from "@/lib/money";

export type ExpenseListItem = Expense & { clientName: string | null; projectName: string | null };

export async function listExpenses(filter: { from?: string; to?: string; projectId?: string; clientId?: string } = {}): Promise<ExpenseListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.from) where.push(`e.spent_on >= $${params.push(filter.from)}::date`);
  if (filter.to) where.push(`e.spent_on < $${params.push(filter.to)}::date`);
  if (filter.projectId) where.push(`e.linked_project_id = $${params.push(filter.projectId)}`);
  if (filter.clientId) where.push(`e.linked_client_id = $${params.push(filter.clientId)}`);
  return many<ExpenseListItem>(
    `select e.*, c.name as client_name, p.name as project_name from expenses e
     left join clients c on c.id = e.linked_client_id
     left join projects p on p.id = e.linked_project_id
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
  spentOn: string;
  linkedClientId?: string | null;
  linkedProjectId?: string | null;
  notes?: string | null;
};

export async function createExpense(input: ExpenseInput, createdBy: string): Promise<Expense> {
  const e = await must<Expense>(
    "Expense",
    `insert into expenses (description, category, vendor, amount_cents, currency, spent_on, linked_client_id, linked_project_id, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      input.description,
      input.category,
      input.vendor ?? null,
      input.amountCents,
      input.currency,
      input.spentOn,
      input.linkedClientId ?? null,
      input.linkedProjectId ?? null,
      input.notes ?? null,
      createdBy,
    ],
  );
  await logAudit({ entityType: "expense", entityId: e.id, action: "create", summary: `Logged expense "${e.description}" (${centsToDisplay(e.amountCents, e.currency)})`, changedBy: createdBy });
  return e;
}

export async function updateExpense(id: string, input: ExpenseInput, changedBy: string): Promise<Expense> {
  const e = await must<Expense>(
    "Expense",
    `update expenses set description = $2, category = $3, vendor = $4, amount_cents = $5, currency = $6, spent_on = $7,
       linked_client_id = $8, linked_project_id = $9, notes = $10 where id = $1 returning *`,
    [
      id,
      input.description,
      input.category,
      input.vendor ?? null,
      input.amountCents,
      input.currency,
      input.spentOn,
      input.linkedClientId ?? null,
      input.linkedProjectId ?? null,
      input.notes ?? null,
    ],
  );
  await logAudit({ entityType: "expense", entityId: id, action: "update", summary: `Edited expense "${e.description}"`, changedBy });
  return e;
}

export async function deleteExpense(id: string, deletedBy: string): Promise<void> {
  const rows = await query<{ description: string }>("delete from expenses where id = $1 returning description", [id]);
  if (!rows.length) throw new NotFoundError("Expense");
  await logAudit({ entityType: "expense", entityId: id, action: "delete", summary: `Deleted expense "${rows[0]!.description}"`, changedBy: deletedBy });
}
