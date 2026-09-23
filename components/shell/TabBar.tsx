"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, type NavLink } from "@/lib/nav";
import { NavIcon } from "./NavIcon";

/**
 * iOS 26 tab bar (phone only; iPad/desktop use the sidebar): a floating
 * Liquid Glass capsule with a lens that slides to the selected tab, and a
 * separate search button. Scrolling down minimizes it to the selected tab;
 * scrolling up (or tapping it) brings it back. Content fades out under it.
 */
export function TabBar({ tabs }: { tabs: NavLink[] }) {
  const pathname = usePathname();
  const searchActive = pathname.startsWith("/search");
  const activeIndex = searchActive ? -1 : tabs.findIndex((t) => isActive(pathname, t));
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      if (y < 80 || delta < -8) setMinimized(false);
      else if (delta > 8) setMinimized(true);
      if (Math.abs(delta) > 8) last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A new screen starts with the full bar.
  useEffect(() => setMinimized(false), [pathname]);

  const active = activeIndex >= 0 ? tabs[activeIndex] : undefined;

  return (
    <>
      <div aria-hidden className="scroll-edge-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[calc(env(safe-area-inset-bottom)+64px)] md:hidden" />
      <nav
        aria-label="Tabs"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-between gap-2 px-4 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden"
      >
        {minimized && active ? (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label={`${active.label} — show tabs`}
            className="glass press pointer-events-auto flex h-[54px] w-[54px] items-center justify-center rounded-full text-accent animate-pop-in"
          >
            <NavIcon icon={active.icon} filled className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
        ) : (
          <div className="glass pointer-events-auto relative flex h-[62px] flex-1 items-stretch rounded-full p-1 animate-pop-in">
            {activeIndex >= 0 && (
              <span
                aria-hidden
                className="glass-flat absolute bottom-1 top-1 rounded-full bg-fill/[0.1] transition-transform duration-500 ease-spring"
                style={{ left: 4, width: `calc((100% - 8px) / ${tabs.length})`, transform: `translateX(${activeIndex * 100}%)` }}
              />
            )}
            {tabs.map((tab, i) => {
              const on = i === activeIndex;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={on ? "page" : undefined}
                  className={cn("press relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] rounded-full", on ? "text-accent" : "text-label")}
                >
                  <NavIcon icon={tab.icon} filled={on} className="h-[22px] w-[22px]" strokeWidth={on ? 2.2 : 1.8} />
                  <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        )}
        <Link
          href="/search"
          aria-label="Search"
          className={cn(
            "glass press pointer-events-auto flex shrink-0 items-center justify-center rounded-full transition-[width,height] duration-300 ease-spring",
            minimized ? "h-[54px] w-[54px]" : "h-[62px] w-[62px]",
            searchActive ? "text-accent" : "text-label",
          )}
        >
          <Search className="h-[22px] w-[22px]" strokeWidth={searchActive ? 2.4 : 2} />
        </Link>
      </nav>
    </>
  );
}
