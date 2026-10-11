"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsDesktop } from "@/lib/hooks/useMediaQuery";
import { TABS, MORE_TAB } from "@/lib/nav";

/** True when the app runs from the Home Screen, where iOS gives no back swipe or pull-to-refresh of its own. */
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

const EDGE = 24; // px from the left edge where a back swipe can start
const BACK_DISTANCE = 90; // px of travel that commits it
const PULL_DISTANCE = 72; // px of pull that refreshes

/**
 * The two gestures an iPhone app has and a Home Screen web app doesn't:
 * swipe from the left edge to go back (the page follows your finger), and
 * pull down at the top to refresh. Phones only, Home Screen only (Safari
 * has its own), and never while a sheet is open.
 */
export function NativeGestures() {
  const router = useRouter();
  const pathname = usePathname();
  const desktop = useIsDesktop();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (desktop || !isStandalone()) return;
    const main = document.querySelector("main");
    if (!main) return;
    const roots = new Set([...TABS.map((t) => t.href), MORE_TAB.href, "/search"]);
    let start: { x: number; y: number } | null = null;
    let mode: "back" | "pull" | null = null;
    let dx = 0;
    let dy = 0;

    const sheetOpen = () => !!document.querySelector('[role="dialog"]');
    const reset = (animate: boolean) => {
      main.style.transition = animate ? "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)" : "";
      main.style.transform = "";
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || sheetOpen()) return;
      const t = e.touches[0]!;
      start = { x: t.clientX, y: t.clientY };
      dx = dy = 0;
      // Back from anywhere but a tab's first screen; pull only from the very top.
      mode = t.clientX <= EDGE && !roots.has(pathRef.current) && window.history.length > 1 ? "back" : window.scrollY <= 0 ? "pull" : null;
    };

    const onMove = (e: TouchEvent) => {
      if (!start || !mode) return;
      const t = e.touches[0]!;
      dx = t.clientX - start.x;
      dy = t.clientY - start.y;
      if (mode === "back") {
        if (Math.abs(dy) > Math.abs(dx) && dx < 30) {
          mode = null;
          reset(true);
          return;
        }
        main.style.transition = "";
        main.style.transform = `translateX(${Math.max(dx, 0)}px)`;
      } else if (mode === "pull") {
        if (dy <= 0 || Math.abs(dx) > dy) {
          setPull(0);
          return;
        }
        // Resistance, like a native scroll view.
        setPull(Math.min(dy * 0.5, PULL_DISTANCE * 1.4));
      }
    };

    const onEnd = () => {
      if (mode === "back") {
        if (dx > BACK_DISTANCE) {
          main.style.transition = "transform 200ms ease-out";
          main.style.transform = `translateX(${window.innerWidth}px)`;
          setTimeout(() => {
            router.back();
            // The new screen slides in on its own (lib/navMotion.ts); clear ours.
            setTimeout(() => reset(false), 60);
          }, 180);
        } else reset(true);
      } else if (mode === "pull") {
        if (dy * 0.5 >= PULL_DISTANCE) {
          setRefreshing(true);
          setPull(PULL_DISTANCE);
          router.refresh();
          setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 900);
        } else setPull(0);
      }
      start = null;
      mode = null;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      reset(false);
    };
  }, [desktop, router]);

  if (pull <= 0) return null;
  const progress = Math.min(pull / PULL_DISTANCE, 1);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 z-[45] flex justify-center" style={{ top: `calc(env(safe-area-inset-top) + ${pull * 0.6}px)` }}>
      <span
        className="glass flex h-9 w-9 items-center justify-center rounded-full"
        style={{ opacity: progress, transform: `rotate(${refreshing ? 0 : progress * 270}deg)` }}
      >
        <span className={`h-4 w-4 rounded-full border-2 border-label-2 border-t-transparent ${refreshing ? "animate-spin" : ""}`} />
      </span>
    </div>
  );
}
