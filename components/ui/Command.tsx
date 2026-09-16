"use client";

import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Styled wrapper over cmdk, which supplies the filtering, virtual focus and
 * `aria-activedescendant` wiring a listbox needs — about 300 lines of keyboard
 * and screen-reader behaviour that is easy to get subtly wrong by hand.
 *
 * Built on the same Radix Dialog primitive as components/ui/Dialog.tsx, so the
 * focus trap, focus restore and scroll lock behave identically.
 */
export const Command = CommandPrimitive;
export const CommandList = CommandPrimitive.List;
export const CommandEmpty = CommandPrimitive.Empty;
export const CommandLoading = CommandPrimitive.Loading;

export function CommandDialog({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the dialog, e.g. "Command palette". */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-overlay-in bg-overlay/60" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[15vh] z-50 w-[92vw] max-w-lg -translate-x-1/2 animate-content-in overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
        >
          <DialogPrimitive.Title className="sr-only">
            {label}
          </DialogPrimitive.Title>
          {/* shouldFilter=false: results come pre-scored from the server, so
              cmdk must not re-filter and drop them. */}
          <CommandPrimitive shouldFilter={false} loop>
            {children}
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function CommandInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          "min-h-[48px] w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden p-1 text-foreground",
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground outline-none",
        "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}
