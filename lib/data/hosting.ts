import { query, tx } from "@/lib/db";
import { many, must, one, NotFoundError, ValidationError } from "./sql";
import { logAudit } from "./audit";
import type { Currency, DocumentRecord, HostingSubscription, HostingSubscriptionStatus, PaymentMethod, RecurringExpenseCycle } from "./types";
import { createDocument, transitionDocumentStatus } from "./documents";
import { addPayment, CYCLE_MONTHS } from "./finance";
import { ANNUAL_COST_SQL } from "./reports";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { addMonthsYmd, todayYmd } from "@/lib/time";

export type HostingListItem = HostingSubscription & {
  clientName: string;
  /** Yearly vendor cost in BHD — linked recurring expense or typed cost (item 14). */
  annualCostBhdCents: number | null;
  recurringExpenseName: string | null;
  /** Yearly fee in BHD (null while the amount is TBD). */
  annualFeeBhdCents: number | null;
  invoiceCount: number;
};

const LIST_SELECT = `
  select h.*, coalesce(c.short_name, c.name) as client_name, r.name as recurring_expense_name,
    ${ANNUAL_COST_SQL} as annual_cost_bhd_cents,
    (select count(*)::int from documents d where d.hosting_subscription_id = h.id and d.status <> 'void') as invoice_count
  from hosting_subscriptions h
  join clients c on c.id = h.client_id
  left join recurring_expenses r on r.id = h.recurring_expense_id`;

function withFee(row: HostingListItem): HostingListItem {
  return {
    ...row,
    annualFeeBhdCents: row.amountCents === null ? null : convertMinorUnits(Math.round((row.amountCents * 12) / CYCLE_MONTHS[row.cycle]), row.currency, "BHD"),
  };
}

export async function listHostingSubscriptions(): Promise<HostingListItem[]> {
  const rows = await many<HostingListItem>(`${LIST_SELECT} order by h.status in ('paused', 'not_started'), h.next_due_date nulls last`);
  return rows.map(withFee);
}

export async function listHostingSubscriptionsForClient(clientId: string): Promise<HostingListItem[]> {
  const rows = await many<HostingListItem>(`${LIST_SELECT} where h.client_id = $1 order by h.next_due_date nulls last`, [clientId]);
  return rows.map(withFee);
}

export { hostingAlertLevel, type HostingAlertLevel } from "@/lib/hosting-alerts";
import { hostingAlertLevel, type HostingAlertLevel } from "@/lib/hosting-alerts";

export async function listHostingAlerts(): Promise<{ subscription: HostingListItem; level: HostingAlertLevel }[]> {
  return (await listHostingSubscriptions())
    .map((subscription) => ({ subscription, level: hostingAlertLevel(subscription) }))
    .filter((x) => x.level !== "ok");
}

export type HostingInput = {
  clientId: string;
  projectId?: string | null;
  item: HostingSubscription["item"];
  label?: string | null;
  /** Null = the client price isn't agreed yet (item 13). */
  amountCents: number | null;
  currency: Currency;
  cycle: RecurringExpenseCycle;
  /** Null = no due date (paused or not started). */
  nextDueDate?: string | null;
  status?: HostingSubscriptionStatus;
  recurringExpenseId?: string | null;
  costPerYearCents?: number | null;
  costCurrency?: Currency | null;
};

const values = (input: HostingInput) => [
  input.clientId,
  input.projectId ?? null,
  input.item,
  input.label ?? null,
  input.amountCents,
  input.currency,
  input.cycle,
  input.nextDueDate ?? null,
  input.status ?? "active",
  input.recurringExpenseId ?? null,
  input.recurringExpenseId ? null : (input.costPerYearCents ?? null),
  input.recurringExpenseId || input.costPerYearCents == null ? null : (input.costCurrency ?? "BHD"),
];

export async function createHostingSubscription(input: HostingInput): Promise<HostingSubscription> {
  return must<HostingSubscription>(
    "Hosting subscription",
    `insert into hosting_subscriptions (client_id, project_id, item, label, amount_cents, currency, cycle, next_due_date, status,
       recurring_expense_id, cost_per_year_cents, cost_currency)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    values(input),
  );
}

export async function updateHostingSubscription(id: string, input: HostingInput): Promise<HostingSubscription> {
  return must<HostingSubscription>(
    "Hosting subscription",
    `update hosting_subscriptions set (client_id, project_id, item, label, amount_cents, currency, cycle, next_due_date, status,
       recurring_expense_id, cost_per_year_cents, cost_currency) = ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     where id = $1 returning *`,
    [id, ...values(input)],
  );
}

export async function deleteHostingSubscription(id: string, deletedBy: string): Promise<void> {
  const rows = await query("delete from hosting_subscriptions where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Hosting subscription");
  await logAudit({ entityType: "hosting_subscription", entityId: id, action: "delete", summary: "Deleted hosting subscription", changedBy: deletedBy });
}

const itemLabel = (sub: HostingSubscription) => sub.label ?? (sub.item === "server" ? "Server/hosting" : sub.item === "domain" ? "Domain" : "Hosting");

/**
 * Item 12: one step issues the invoice (linked to this fee), records the
 * payment unless `invoiceOnly`, and moves the next due date one cycle on.
 * The amount can be given here — required while the fee is "amount TBD".
 */
export async function collectHostingFee(
  subscriptionId: string,
  collectedBy: string,
  opts: { amountCents?: number | null; paidOn?: string | null; method?: PaymentMethod; accountId?: string | null; reference?: string | null; invoiceOnly?: boolean } = {},
) {
  return tx(async () => {
    const sub = await must<HostingSubscription>("Hosting subscription", "select * from hosting_subscriptions where id = $1 for update", [subscriptionId]);
    const amountCents = opts.amountCents ?? sub.amountCents;
    if (!amountCents || amountCents <= 0) throw new ValidationError("Enter the amount to collect — this fee's price is still TBD.");
    const paidOn = opts.paidOn ?? todayYmd();
    const projectId =
      sub.projectId ??
      (await many<{ id: string }>("select id from projects where client_id = $1 order by status = 'active_sprint' desc, created_at limit 1", [sub.clientId]))[0]?.id ??
      null;

    const invoice = await createDocument({
      type: "invoice",
      clientId: sub.clientId,
      projectId,
      currency: sub.currency,
      taxRateBps: 0,
      paymentTerms: "Due on receipt",
      notes: `${itemLabel(sub)} — ${sub.cycle} hosting fee.`,
      dueAt: paidOn,
      issuedAt: paidOn,
      hostingSubscriptionId: sub.id,
      lineItems: [{ description: `${itemLabel(sub)} (${sub.cycle})`, quantity: 1, unitPriceCents: amountCents }],
      createdBy: collectedBy,
    });
    await transitionDocumentStatus(invoice.id, "sent", collectedBy);
    if (!opts.invoiceOnly) {
      await addPayment({
        documentId: invoice.id,
        amountCents,
        method: opts.method ?? "transfer",
        paidOn,
        accountId: opts.accountId ?? null,
        reference: opts.reference ?? null,
        recordedBy: collectedBy,
      });
    }

    // A fee whose price was TBD now has one; a not-started service is now running.
    const subscription = await must<HostingSubscription>(
      "Hosting subscription",
      `update hosting_subscriptions set
         amount_cents = coalesce(amount_cents, $5),
         last_collected_date = case when $6::boolean then last_collected_date else greatest(coalesce(last_collected_date, $2::date), $2::date) end,
         next_due_date = $3, linked_invoice_id = $4,
         status = case when status in ('overdue', 'not_started') then 'active' else status end
       where id = $1 returning *`,
      [sub.id, paidOn, addMonthsYmd(sub.nextDueDate ?? paidOn, CYCLE_MONTHS[sub.cycle]), invoice.id, amountCents, !!opts.invoiceOnly],
    );
    await logAudit({
      entityType: "hosting_subscription",
      entityId: sub.id,
      action: "update",
      summary: `${opts.invoiceOnly ? "Invoiced" : "Collected"} ${centsToDisplay(amountCents, sub.currency)} hosting fee (${invoice.documentNumber})`,
      changedBy: collectedBy,
    });
    return { subscription, invoice };
  });
}

/**
 * Item 12: attach an invoice issued outside "Collect" (e.g. migrated from
 * Notion) to its hosting fee. A paid invoice counts as a collection; with
 * `advance`, the next due date also moves on one cycle.
 */
export async function linkHostingInvoice(subscriptionId: string, documentId: string, opts: { advance: boolean }, by: string) {
  return tx(async () => {
    const sub = await must<HostingSubscription>("Hosting subscription", "select * from hosting_subscriptions where id = $1 for update", [subscriptionId]);
    const doc = await must<DocumentRecord>("Invoice", "select * from documents where id = $1 for update", [documentId]);
    if (doc.type !== "invoice") throw new ValidationError("Only invoices can be linked to a hosting fee.");
    if (doc.clientId !== sub.clientId) throw new ValidationError("That invoice is for a different client.");
    if (doc.hostingSubscriptionId && doc.hostingSubscriptionId !== sub.id) throw new ValidationError(`${doc.documentNumber} is already linked to another hosting fee.`);
    await query("update documents set hosting_subscription_id = $2, updated_at = now() where id = $1", [doc.id, sub.id]);
    if (doc.status === "paid" || doc.status === "archived") {
      const paid = await one<{ paidOn: string | null }>("select max(paid_on) as paid_on from payments where document_id = $1", [doc.id]);
      if (paid?.paidOn) {
        await query(
          "update hosting_subscriptions set last_collected_date = greatest(coalesce(last_collected_date, $2::date), $2::date), linked_invoice_id = $3 where id = $1",
          [sub.id, paid.paidOn, doc.id],
        );
      }
    }
    // A sent invoice updates "last collected" when its payments complete it (markInvoicePaid).
    if (opts.advance) {
      await query("update hosting_subscriptions set next_due_date = $2, status = case when status = 'overdue' then 'active' else status end where id = $1", [
        sub.id,
        addMonthsYmd(sub.nextDueDate ?? todayYmd(), CYCLE_MONTHS[sub.cycle]),
      ]);
    }
    await logAudit({ entityType: "hosting_subscription", entityId: sub.id, action: "update", summary: `Linked ${doc.documentNumber} to a hosting fee`, changedBy: by });
  });
}

export async function unlinkHostingInvoice(subscriptionId: string, documentId: string, by: string) {
  await query("update documents set hosting_subscription_id = null where id = $1 and hosting_subscription_id = $2", [documentId, subscriptionId]);
  await query("update hosting_subscriptions set linked_invoice_id = null where id = $1 and linked_invoice_id = $2", [subscriptionId, documentId]);
  await logAudit({ entityType: "hosting_subscription", entityId: subscriptionId, action: "update", summary: "Unlinked an invoice from a hosting fee", changedBy: by });
}

/** The invoices billed for a fee, newest first. */
export async function listHostingInvoices(subscriptionId: string) {
  return many<{ id: string; documentNumber: string; externalRef: string | null; status: string; totalCents: number; currency: Currency; issuedAt: string | null }>(
    `select id, document_number, external_ref, status, total_cents, currency, issued_at from documents
     where hosting_subscription_id = $1 order by coalesce(issued_at, created_at) desc`,
    [subscriptionId],
  );
}
