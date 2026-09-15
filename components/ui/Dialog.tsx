"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Wraps the overlay + centred panel + close button that every dialog in the app
 * used to re-implement by hand. Radix supplies the focus trap, focus restore,
 * Escape handling and scroll lock.
 */
export function DialogContent({
  className,
  children,
  title,
  description,
  size = "sm",
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** Rendered as the accessible dialog title. Required — Radix warns without one. */
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
}) {
  const maxWidth = size === "lg" ? "max-w-2xl" : size === "md" ? "max-w-lg" : "max-w-sm";

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/60 animate-overlay-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
          "rounded-xl border border-border bg-popover p-4 shadow-lg animate-content-in",
          maxWidth,
          className,
        )}
        {...props}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : (
              // Radix logs a warning when a dialog has no description; opt out explicitly.
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
