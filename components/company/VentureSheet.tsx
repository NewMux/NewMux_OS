"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import type { Venture, VentureLaunchStatus } from "@/lib/data/types";

export const VENTURE_STATUS: Record<VentureLaunchStatus, { label: string; color: "gray" | "blue" | "green" | "yellow" }> = {
  planning: { label: "Planning", color: "gray" },
  in_development: { label: "In Development", color: "blue" },
  launched: { label: "Launched", color: "green" },
  paused: { label: "Paused", color: "yellow" },
};

export function VentureSheet({ venture, open, onOpenChange }: { venture?: Venture; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const router = useRouter();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [launchStatus, setLaunchStatus] = useState<VentureLaunchStatus>("planning");
  useEffect(() => {
    if (!open) return;
    setName(venture?.name ?? "");
    setBrandDescription(venture?.brandDescription ?? "");
    setWebsiteUrl(venture?.websiteUrl ?? "");
    setLaunchStatus(venture?.launchStatus ?? "planning");
  }, [open, venture]);
  const body = { name, brandDescription, websiteUrl, launchStatus };
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={venture ? "Edit Venture" : "New Venture"}
      submitLabel={venture ? "Done" : "Add"}
      canSubmit={!!name.trim()}
      onSubmit={async () => {
        if (venture) return !!(await run(`/api/ventures/${venture.id}`, { method: "PATCH", body, success: "Saved" }));
        const res = await run<{ venture: Venture }>("/api/ventures", { body, success: "Venture added", refresh: false });
        if (res) router.push(`/ventures/${res.venture.id}`);
        return !!res;
      }}
    >
      <ListSection>
        <PlainRowInput placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!venture} />
        <PlainRowInput placeholder="Website" inputMode="url" autoCapitalize="none" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
        <FieldRow label="Status">
          <Select value={launchStatus} onChange={(e) => setLaunchStatus(e.target.value as VentureLaunchStatus)}>
            {Object.entries(VENTURE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection>
        <div className="px-4 py-2.5">
          <Textarea placeholder="What is it?" rows={3} value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} />
        </div>
      </ListSection>
      {venture && (
        <DeleteRow
          label="Delete Venture"
          onClick={async () => {
            if (await confirm({ title: `Delete ${venture.name}?`, message: "Ventures with expenses or invoices on record can’t be deleted.", destructive: true, confirmLabel: "Delete Venture" })) {
              if (await run(`/api/ventures/${venture.id}`, { method: "DELETE", success: "Deleted", refresh: false })) {
                onOpenChange(false);
                router.push("/ventures");
                router.refresh();
              }
            }
          }}
        />
      )}
    </FormSheet>
  );
}
