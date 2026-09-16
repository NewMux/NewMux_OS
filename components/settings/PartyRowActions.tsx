"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import type { Party } from "@/lib/data/types";

export function PartyRowActions({ party }: { party: Party }) {
  return (
    <EntityRowActions
      label="payout party"
      name={party.name}
      endpoint={`/api/finance/parties/${party.id}`}
      deleteDescription="This cannot be undone."
      fields={[
        {
          name: "name",
          label: "Party name",
          value: party.name,
          required: true,
        },
      ]}
    />
  );
}
