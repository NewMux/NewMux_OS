"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "@/lib/nav";

const MAX_VISIBLE = 4;

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = items.length > MAX_VISIBLE ? items.slice(0, MAX_VISIBLE) : items;
  const overflow = items.length > MAX_VISIBLE ? items.slice(MAX_VISIBLE) : [];
  const overflowActive = overflow.some((item) => pathname.startsWith(item.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex safe-bottom md:hidden">
      <div className="glass-surface flex w-full">
        {visible.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-emerald-400" : "text-slate-500",
              )}
            >
              <NavIcon icon={item.icon} className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        {overflow.length > 0 && (
          <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Dialog.Trigger asChild>
              <button
                className={cn(
                  "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                  overflowActive ? "text-emerald-400" : "text-slate-500",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                More
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
              <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-white/10 bg-slate-950 p-4 safe-bottom">
                <div className="mb-3 flex items-center justify-between">
                  <Dialog.Title className="text-sm font-semibold text-white">More</Dialog.Title>
                  <Dialog.Close className="text-slate-500 hover:text-slate-200">
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {overflow.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium",
                          active ? "bg-emerald-600/15 text-emerald-400" : "text-slate-400 hover:bg-slate-900",
                        )}
                      >
                        <NavIcon icon={item.icon} className="h-5 w-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </nav>
  );
}
