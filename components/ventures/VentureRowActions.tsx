"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import type { Venture } from "@/lib/data/types";

export function VentureRowActions({ venture }: { venture: Venture }) {
  return (
    <EntityRowActions
      label="venture"
      name={venture.name}
      endpoint={`/api/ventures/${venture.id}`}
      deleteDescription="This cannot be undone."
      fields={[
        {
          name: "name",
          label: "Venture name",
          value: venture.name,
          required: true,
        },
        {
          name: "launchStatus",
          label: "Launch status",
          type: "select",
          value: venture.launchStatus,
          options: [
            { value: "planning", label: "Planning" },
            { value: "in_development", label: "In development" },
            { value: "launched", label: "Launched" },
            { value: "paused", label: "Paused" },
          ],
        },
        {
          name: "websiteUrl",
          label: "Website",
          type: "url",
          placeholder: "https://",
          value: venture.websiteUrl ?? "",
        },
        {
          name: "brandDescription",
          label: "Brand description",
          type: "textarea",
          value: venture.brandDescription ?? "",
          wide: true,
        },
      ]}
    />
  );
}
