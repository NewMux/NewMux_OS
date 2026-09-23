"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, type NavLink } from "@/lib/nav";
import { NavIcon } from "./NavIcon";

/**
 * Floating liquid-glass tab bar (iOS 26 style) with a separate search
 * button. Phone only; iPad/desktop use the sidebar.
 */
export function TabBar({ tabs }: { tabs: NavLink[] }) {
  const pathname = usePathname();
  const searchActive = pathname.startsWith("/search");

  return (
    <nav
      aria-label="Tabs"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end gap-2 px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden"
    >
      <div className="glass pointer-events-auto flex h-[62px] flex-1 items-stretch rounded-full p-1 shadow-glass">
        {tabs.map((tab) => {
          const active = !searchActive && isActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors",
                active ? "bg-fill/[0.14] text-accent" : "text-label",
              )}
            >
              <NavIcon icon={tab.icon} filled={active} className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
      <Link
        href="/search"
        aria-label="Search"
        className={cn(
          "glass press pointer-events-auto flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full shadow-glass",
          searchActive ? "text-accent" : "text-label",
        )}
      >
        <Search className="h-[22px] w-[22px]" strokeWidth={searchActive ? 2.4 : 2} />
      </Link>
    </nav>
  );
}
