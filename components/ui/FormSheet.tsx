"use client";

import { useState } from "react";
import { Sheet, SheetButton } from "./Sheet";

/**
 * A sheet containing a form, with the iOS Cancel · Title · Save header.
 * `onSubmit` returns true when saved (the sheet then closes).
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  submitLabel = "Save",
  canSubmit = true,
  onSubmit,
  children,
  size,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel?: string;
  canSubmit?: boolean;
  onSubmit: () => Promise<boolean>;
  children: React.ReactNode;
  size?: "auto" | "large";
}) {
  const [saving, setSaving] = useState(false);
  const formId = `form-${title.replace(/\W+/g, "-").toLowerCase()}`;

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      if (await onSubmit()) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size={size}
      left={<SheetButton onClick={() => onOpenChange(false)}>Cancel</SheetButton>}
      right={
        <SheetButton bold type="submit" form={formId} disabled={!canSubmit || saving}>
          {saving ? "Saving…" : submitLabel}
        </SheetButton>
      }
    >
      <form id={formId} onSubmit={handle} className="pt-2">
        {children}
        {/* Lets the keyboard's Go/Return submit on iOS. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
