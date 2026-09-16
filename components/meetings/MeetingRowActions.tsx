"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";
import type { Meeting } from "@/lib/data/types";

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time, not a UTC ISO string. */
function toDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export function MeetingRowActions({ meeting }: { meeting: Meeting }) {
  return (
    <EntityRowActions
      label="meeting"
      name={meeting.title}
      endpoint={`/api/meetings/${meeting.id}`}
      deleteDescription="This cannot be undone."
      fields={[
        {
          name: "title",
          label: "Title",
          value: meeting.title,
          required: true,
          wide: true,
        },
        {
          name: "startsAt",
          label: "Starts at",
          type: "datetime-local",
          value: toDateTimeInput(meeting.startsAt),
          required: true,
        },
        {
          name: "recurring",
          label: "Repeats",
          type: "select",
          value: meeting.recurring,
          options: [
            { value: "none", label: "Does not repeat" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ],
        },
        {
          name: "notes",
          label: "Notes",
          type: "textarea",
          value: meeting.notes ?? "",
          wide: true,
        },
      ]}
    />
  );
}
