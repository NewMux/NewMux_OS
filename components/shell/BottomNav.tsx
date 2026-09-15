"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "@/lib/nav";

const MAX_VISIBLE = 4;

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const visible =
    items.length > MAX_VISIBLE ? items.slice(0, MAX_VISIBLE) : items;
  const overflow = items.length > MAX_VISIBLE ? items.slice(MAX_VISIBLE) : [];
  const overflowActive = overflow.some((item) =>
    pathname.startsWith(item.href),
  );

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex md:hidden">
      <div className="glass-surface flex w-full">
        {visible.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-brand" : "text-muted-foreground",
              )}
            >
              <NavIcon icon={item.icon} className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        {overflow.length > 0 && (
          <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogTrigger asChild>
              <button
                className={cn(
                  "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                  overflowActive ? "text-brand" : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                More
              </button>
            </DialogTrigger>
            <DialogContent title="More" position="sheet">
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
                        active
                          ? "bg-primary/15 text-brand"
                          : "text-muted-foreground hover:bg-card",
                      )}
                    >
                      <NavIcon icon={item.icon} className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </nav>
  );
}
