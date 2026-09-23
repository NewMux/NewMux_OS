import { query, tx } from "@/lib/db";
import { many, must, NotFoundError } from "./sql";
import { logAudit } from "./audit";
import type { Currency, HostingSubscription, HostingSubscriptionStatus, RecurringExpenseCycle } from "./types";
import { createDocument, transitionDocumentStatus } from "./documents";
import { addPayment, CYCLE_MONTHS } from "./finance";
import { addMonthsYmd, todayYmd } from "@/lib/time";

export type HostingListItem = HostingSubscription & { clientName: string };

export async function listHostingSubscriptions(): Promise<HostingListItem[]> {
  return many<HostingListItem>(
    `select h.*, c.name as client_name from hosting_subscriptions h join clients c on c.id = h.client_id
     order by h.status = 'paused', h.next_due_date nulls last`,
  );
}

export async function listHostingSubscriptionsForClient(clientId: string): Promise<HostingSubscription[]> {
  return many<HostingSubscription>("select * from hosting_subscriptions where client_id = $1 order by next_due_date", [clientId]);
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
  amountCents: number;
  currency: Currency;
  cycle: RecurringExpenseCycle;
  nextDueDate?: string | null;
};

export async function createHostingSubscription(input: HostingInput): Promise<HostingSubscription> {
  return must<HostingSubscription>(
    "Hosting subscription",
    `insert into hosting_subscriptions (client_id, project_id, item, label, amount_cents, currency, cycle, next_due_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [
      input.clientId,
      input.projectId ?? null,
      input.item,
      input.label ?? null,
      input.amountCents,
      input.currency,
      input.cycle,
      input.nextDueDate ?? addMonthsYmd(todayYmd(), CYCLE_MONTHS[input.cycle]),
    ],
  );
}

export async function updateHostingSubscription(
  id: string,
  input: HostingInput & { status?: HostingSubscriptionStatus },
): Promise<HostingSubscription> {
  return must<HostingSubscription>(
    "Hosting subscription",
    `update hosting_subscriptions set client_id = $2, project_id = $3, item = $4, label = $5, amount_cents = $6,
       currency = $7, cycle = $8, next_due_date = coalesce($9, next_due_date), status = coalesce($10, status)
     where id = $1 returning *`,
    [
      id,
      input.clientId,
      input.projectId ?? null,
      input.item,
      input.label ?? null,
      input.amountCents,
      input.currency,
      input.cycle,
      input.nextDueDate ?? null,
      input.status ?? null,
    ],
  );
}

export async function deleteHostingSubscription(id: string, deletedBy: string): Promise<void> {
  const rows = await query("delete from hosting_subscriptions where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Hosting subscription");
  await logAudit({ entityType: "hosting_subscription", entityId: id, action: "delete", summary: "Deleted hosting subscription", changedBy: deletedBy });
}

/**
 * PRD section 6: "Collected" issues an invoice for the amount (sent, so it
 * counts in this month's revenue), records the full payment against it (which
 * marks it paid through the normal lifecycle), and advances the due date.
 */
export async function collectHostingFee(subscriptionId: string, collectedBy: string) {
  return tx(async () => {
    const sub = await must<HostingSubscription>("Hosting subscription", "select * from hosting_subscriptions where id = $1 for update", [subscriptionId]);
    const projectId =
      sub.projectId ??
      (await many<{ id: string }>("select id from projects where client_id = $1 order by status = 'active_sprint' desc, created_at limit 1", [sub.clientId]))[0]?.id ??
      null;
    const itemLabel = sub.label ?? (sub.item === "server" ? "Server/hosting" : sub.item === "domain" ? "Domain" : "Hosting");

    const invoice = await createDocument({
      type: "invoice",
      clientId: sub.clientId,
      projectId,
      currency: sub.currency,
      taxRateBps: 0,
      paymentTerms: "Due on receipt",
      notes: `${itemLabel} — ${sub.cycle} hosting fee.`,
      dueAt: todayYmd(),
      lineItems: [{ description: `${itemLabel} (${sub.cycle})`, quantity: 1, unitPriceCents: sub.amountCents }],
      createdBy: collectedBy,
    });
    await transitionDocumentStatus(invoice.id, "sent", collectedBy);
    await addPayment({ documentId: invoice.id, amountCents: sub.amountCents, method: "transfer", recordedBy: collectedBy });

    const subscription = await must<HostingSubscription>(
      "Hosting subscription",
      `update hosting_subscriptions set last_collected_date = $2, next_due_date = $3, linked_invoice_id = $4, status = 'active'
       where id = $1 returning *`,
      [sub.id, todayYmd(), addMonthsYmd(sub.nextDueDate ?? todayYmd(), CYCLE_MONTHS[sub.cycle]), invoice.id],
    );
    return { subscription, invoice };
  });
}
