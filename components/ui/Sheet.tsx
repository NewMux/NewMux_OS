"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/lib/hooks/useMediaQuery";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Left of the title (e.g. Cancel). Defaults to nothing. */
  left?: React.ReactNode;
  /** Right of the title (e.g. Save / Done). */
  right?: React.ReactNode;
  children: React.ReactNode;
  /** "large" = nearly full height (forms); "auto" = fits content. */
  size?: "auto" | "large";
  className?: string;
};

/**
 * iOS sheet: a bottom drawer with a grabber and drag-to-dismiss on phones,
 * a centred dialog on iPad/desktop. Header follows the iOS pattern of
 * Cancel · Title · Action.
 */
export function Sheet({ open, onOpenChange, title, left, right, children, size = "large", className }: SheetProps) {
  const desktop = useIsDesktop();

  const header = (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2 pt-3">
      <div className="flex justify-start">{left}</div>
      <div className="max-w-[60vw] truncate text-center text-headline">{title}</div>
      <div className="flex justify-end">{right}</div>
    </div>
  );

  if (desktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30 animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              "fixed left-1/2 top-1/2 z-[61] flex max-h-[85vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg shadow-float animate-scale-in focus:outline-none",
              className,
            )}
          >
            <Dialog.Title asChild>
              <div>{header}</div>
            </Dialog.Title>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-[14px] bg-bg focus:outline-none",
            size === "large" ? "h-[94dvh]" : "max-h-[94dvh]",
            className,
          )}
        >
          <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-label-3" aria-hidden />
          <Drawer.Title asChild>
            <div>{header}</div>
          </Drawer.Title>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-2">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Text button for sheet headers ("Cancel", bold "Add"). */
export function SheetButton({ children, bold, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { bold?: boolean }) {
  return (
    <button
      type="button"
      className={cn("press min-h-[36px] px-1 text-body text-accent disabled:text-label-3", bold && "font-semibold", className)}
      {...props}
    >
      {children}
    </button>
  );
}
