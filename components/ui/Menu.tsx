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

/** iOS context-menu style "…" menu. */
export function Menu({ items, trigger, label = "More actions", align = "end" }: { items: MenuItem[]; trigger?: React.ReactNode; label?: string; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button type="button" aria-label={label} className="press glass flex h-9 w-9 items-center justify-center rounded-full text-accent shadow-glass">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          className="z-[80] min-w-[230px] overflow-hidden rounded-[14px] bg-bg-elevated/85 shadow-float backdrop-blur-2xl animate-scale-in dark:bg-[#252527]/90"
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <DropdownMenu.Separator key={i} className="h-[6px] bg-fill/[0.12]" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "flex h-11 cursor-pointer select-none items-center justify-between gap-6 px-4 text-body outline-none hairline-b last:shadow-none data-[disabled]:opacity-40 data-[highlighted]:bg-fill/[0.16]",
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
