"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import type { DeductionType } from "@/lib/data/types";

export function DeductionTypeRowActions({
  deductionType,
}: {
  deductionType: DeductionType;
}) {
  return (
    <EntityRowActions
      label="deduction type"
      name={deductionType.name}
      endpoint={`/api/finance/deduction-types/${deductionType.id}`}
      deleteDescription="This cannot be undone."
      fields={[
        {
          name: "name",
          label: "Deduction name",
          value: deductionType.name,
          required: true,
        },
        {
          name: "kind",
          label: "Kind",
          type: "select",
          value: deductionType.kind,
          options: [
            { value: "fixed", label: "Fixed amount" },
            { value: "percentage", label: "Percentage" },
          ],
        },
      ]}
    />
  );
}
