"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "@/lib/nav";

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex safe-bottom md:hidden">
      <div className="glass-surface flex w-full">
        {items.map((item) => {
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
      </div>
    </nav>
  );
}
