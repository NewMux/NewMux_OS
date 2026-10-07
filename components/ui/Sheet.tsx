"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { Check, X } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/lib/hooks/useMediaQuery";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Leading header control (usually a SheetIconButton ✕). */
  left?: React.ReactNode;
  /** Trailing header control (usually a prominent SheetIconButton ✓). */
  right?: React.ReactNode;
  children: React.ReactNode;
  /** "large" = nearly full height, edge to edge (forms); "auto" = fits content and floats inset. */
  size?: "auto" | "large";
  className?: string;
};

/**
 * iOS 26 sheet. On phones: a drawer with a grabber and drag-to-dismiss; short
 * sheets float inset from the screen edges, tall ones run edge to edge. On
 * iPad/desktop: a centred dialog. Header: ✕ · Title · ✓ in glass circles.
 */
export function Sheet({ open, onOpenChange, title, left, right, children, size = "large", className }: SheetProps) {
  const desktop = useIsDesktop();

  const header = (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-2 pt-2.5">
      <div className="flex justify-start">{left}</div>
      <div className="max-w-[56vw] truncate text-center text-headline">{title}</div>
      <div className="flex justify-end">{right}</div>
    </div>
  );

  if (desktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[2px] animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              "fixed left-1/2 top-1/2 z-[61] flex max-h-[85vh] w-[min(580px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-bg shadow-float ring-[0.5px] ring-black/10 animate-scale-in focus:outline-none dark:ring-white/10",
              className,
            )}
          >
            <Dialog.Title asChild>
              <div className="pt-1">{header}</div>
            </Dialog.Title>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2">{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  const floating = size === "auto";
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/35" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-[61] flex flex-col bg-bg shadow-float focus:outline-none",
            floating
              ? "inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] max-h-[88dvh] rounded-sheet ring-[0.5px] ring-black/5 dark:ring-white/10"
              : "inset-x-0 bottom-0 h-[94dvh] rounded-t-sheet",
            className,
          )}
        >
          <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-label-3/80" aria-hidden />
          <Drawer.Title asChild>
            <div>{header}</div>
          </Drawer.Title>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2", floating ? "pb-5" : "pb-[calc(env(safe-area-inset-bottom)+24px)]")}>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Round glass header button: ✕ to dismiss, or a tinted ✓ (prominent) to confirm. */
export const SheetIconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; kind?: "close" | "confirm"; busy?: boolean }
>(({ label, kind = "close", busy, className, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled || busy}
    className={cn(
      "press flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-40",
      kind === "confirm" ? "glass-prominent" : "glass text-label",
      className,
    )}
    {...props}
  >
    {busy ? (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
    ) : kind === "confirm" ? (
      <Check className="h-5 w-5" strokeWidth={2.6} />
    ) : (
      <X className="h-5 w-5" strokeWidth={2.4} />
    )}
  </button>
));
SheetIconButton.displayName = "SheetIconButton";

/** Capsule text button for sheet headers when a word reads better than an icon ("Done"). */
export function SheetButton({ children, bold, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { bold?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "press h-10 rounded-full px-4 text-body disabled:opacity-40",
        bold ? "glass-prominent font-semibold" : "glass font-medium text-label",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
