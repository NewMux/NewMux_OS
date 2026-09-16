"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import { minorUnitsToMajor, minorUnitDigits } from "@/lib/money";
import type { HostingSubscription } from "@/lib/data/types";

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export function HostingRowActions({
  subscription,
  clientName,
}: {
  subscription: HostingSubscription;
  clientName: string;
}) {
  const digits = minorUnitDigits(subscription.currency);
  return (
    <EntityRowActions
      label="hosting subscription"
      name={`${clientName} · ${subscription.item}`}
      endpoint={`/api/hosting/${subscription.id}`}
      deleteDescription="Invoices already collected against it are kept. This cannot be undone."
      fields={[
        {
          name: "item",
          label: "Item",
          type: "select",
          value: subscription.item,
          options: [
            { value: "server", label: "Server / hosting" },
            { value: "domain", label: "Domain" },
            { value: "other", label: "Other" },
          ],
        },
        {
          name: "amount",
          label: `Amount (${subscription.currency})`,
          type: "number",
          step: (1 / 10 ** digits).toFixed(digits),
          value: String(
            minorUnitsToMajor(subscription.amountCents, subscription.currency),
          ),
          required: true,
        },
        {
          name: "cycle",
          label: "Billing cycle",
          type: "select",
          value: subscription.cycle,
          options: [
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "annual", label: "Annual" },
          ],
        },
        {
          name: "nextDueDate",
          label: "Next due date",
          type: "date",
          value: toDateInput(subscription.nextDueDate),
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          value: subscription.status,
          options: [
            { value: "active", label: "Active" },
            { value: "overdue", label: "Overdue" },
            { value: "paused", label: "Paused" },
          ],
        },
      ]}
    />
  );
}
