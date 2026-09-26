import { one, ValidationError } from "./sql";
import { plural } from "@/lib/utils";

/**
 * Item 20: a client, project or venture that money has been recorded
 * against can't be deleted — the invoices, payments and expenses would lose
 * their context (or, for hosting fees, be deleted with it). Archive instead.
 */
export async function assertNoFinancialRecords(kind: "client" | "project" | "venture", id: string): Promise<void> {
  const column = { client: "client_id", project: "project_id", venture: null }[kind];
  const expenseColumn = { client: "linked_client_id", project: "linked_project_id", venture: "linked_venture_id" }[kind];
  const counts = await one<{ documents: number; payments: number; expenses: number; recurring: number; hosting: number }>(
    `select
       ${column ? `(select count(*)::int from documents where ${column} = $1)` : "0"} as documents,
       ${column ? `(select count(*)::int from payments p join documents d on d.id = p.document_id where d.${column} = $1)` : "0"} as payments,
       (select count(*)::int from expenses where ${expenseColumn} = $1) as expenses,
       (select count(*)::int from recurring_expenses where ${expenseColumn} = $1) as recurring,
       ${column ? `(select count(*)::int from hosting_subscriptions where ${column} = $1)` : "0"} as hosting`,
    [id],
  );
  if (kind === "venture") {
    const invoices = await one<{ n: number }>(
      `select count(*)::int as n from documents d join profit_split_rules r on r.id = d.profit_split_rule_id
       where r.scope_type = 'venture' and r.scope_id = $1`,
      [id],
    );
    if (invoices?.n && counts) counts.documents = invoices.n;
  }
  if (!counts) return;
  const parts = [
    counts.documents && (kind === "venture" ? plural(counts.documents, "invoice using its split", "invoices using its split") : plural(counts.documents, "document")),
    counts.payments && plural(counts.payments, "payment"),
    counts.expenses && plural(counts.expenses, "expense"),
    counts.recurring && plural(counts.recurring, "recurring expense"),
    counts.hosting && plural(counts.hosting, "hosting fee"),
  ].filter(Boolean);
  if (parts.length) {
    const advice = kind === "project" ? "Archive the project instead." : kind === "venture" ? "Mark the venture paused instead." : "Keep the client for the books.";
    throw new ValidationError(`This ${kind} has ${parts.join(", ")} on record, so deleting it would break the books. ${advice}`);
  }
}
