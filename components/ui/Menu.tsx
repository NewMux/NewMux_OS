"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuItem =
  | {
      label: string;
      icon?: React.ComponentType<{ className?: string }>;
      onSelect: () => void;
      destructive?: boolean;
      disabled?: boolean;
    }
  | "separator";

/** iOS 26 context menu: a glass popover that grows out of its trigger. */
export function Menu({ items, trigger, label = "More actions", align = "end" }: { items: MenuItem[]; trigger?: React.ReactNode; label?: string; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button type="button" aria-label={label} className="press glass flex h-10 w-10 items-center justify-center rounded-full text-label">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="glass-thick z-[80] min-w-[240px] origin-[--radix-dropdown-menu-content-transform-origin] overflow-hidden rounded-[22px] p-1.5 animate-pop-in"
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <DropdownMenu.Separator key={i} className="mx-3 my-1 h-px bg-separator/70" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "flex h-11 cursor-pointer select-none items-center justify-between gap-6 rounded-[14px] px-3.5 text-body outline-none transition-colors data-[disabled]:opacity-40 data-[highlighted]:bg-fill/[0.16]",
                  item.destructive ? "text-ios-red" : "text-label",
                )}
              >
                {item.label}
                {item.icon && <item.icon className="h-[18px] w-[18px]" />}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
