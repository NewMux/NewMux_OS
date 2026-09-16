"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import type { Client } from "@/lib/data/types";

export function ClientRowActions({ client }: { client: Client }) {
  return (
    <EntityRowActions
      label="client"
      name={client.name}
      endpoint={`/api/clients/${client.id}`}
      archivedAt={client.archivedAt}
      canArchive
      deleteDescription="This client has no linked records, so deleting is safe. This cannot be undone."
      fields={[
        {
          name: "name",
          label: "Client / company name",
          value: client.name,
          required: true,
        },
        {
          name: "nameArabic",
          label: "Arabic name",
          value: client.nameArabic ?? "",
          dir: "rtl",
        },
        {
          name: "contactPerson",
          label: "Contact person",
          value: client.contactPerson ?? "",
        },
        {
          name: "contactEmail",
          label: "Contact email",
          type: "email",
          value: client.contactEmail ?? "",
        },
        {
          name: "contactPhone",
          label: "Contact phone",
          value: client.contactPhone ?? "",
        },
        {
          name: "billingAddress",
          label: "Billing address",
          value: client.billingAddress ?? "",
          wide: true,
        },
      ]}
    />
  );
}
