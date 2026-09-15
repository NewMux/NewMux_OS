"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "./Dialog";
import { Button } from "./Button";

/**
 * Confirmation for destructive actions. `blockedReasons` lets a caller show why
 * an action cannot proceed (e.g. a 409 listing the records that reference this
 * one) instead of offering a button that will fail.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  blockedReasons,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  blockedReasons?: string[];
  /** Return false to keep the dialog open — e.g. the server refused and the
   * dialog is now showing why. */
  onConfirm: () => Promise<boolean | void> | boolean | void;
}) {
  const [pending, setPending] = useState(false);
  const blocked = Boolean(blockedReasons?.length);

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await onConfirm();
      if (result !== false) onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        {blocked && (
          <ul className="mb-3 flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
            {blockedReasons!.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!blocked && (
            <Button
              variant="destructive"
              loading={pending}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
