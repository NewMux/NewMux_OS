"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, forwardRef, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { markBack, takeDirection } from "@/lib/navMotion";

/** True inside the detail pane of an iPad/Mac split view (the list is beside it, so no back control). */
export const SplitPaneContext = createContext(false);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Screen scaffold (iOS 26): a large title under a bar that floats over the
 * content. The bar has no background until you scroll, then content softly
 * blurs under it and the title moves into it. Screens slide in like a
 * navigation stack: push when going deeper, pop when going back.
 */
export function Page({
  title,
  eyebrow,
  subtitle,
  back,
  actions,
  titleTrailing,
  accessory,
  children,
  className,
  wide,
  hideLargeTitle,
}: {
  title: string;
  /** Small caps line above the large title (a date, a section). */
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Sits on the large-title row, right-aligned (e.g. the account avatar). */
  titleTrailing?: React.ReactNode;
  /** Rendered under the large title (search field, segmented control…). */
  accessory?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Allow wider content (boards). */
  wide?: boolean;
  /** The screen renders its own editable title (wiki pages); the bar title still appears on scroll. */
  hideLargeTitle?: boolean;
}) {
  const pathname = usePathname();
  const inSplit = useContext(SplitPaneContext);
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useIsoLayoutEffect(() => {
    const dir = takeDirection(pathname);
    if (dir && root.current) root.current.classList.add(`animate-page-${dir}`);
    // Only on mount: a new screen arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry!.isIntersecting), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className={cn("mx-auto w-full", wide ? "max-w-[1400px]" : "max-w-5xl")}>
      <header className={cn("sticky top-0 z-30 safe-top", collapsed && "scroll-edge-top")}>
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 md:px-6">
          <div className={cn("flex min-w-0 justify-start", inSplit && "md:invisible")}>
            {back && (
              <Link
                href={back.href}
                onClick={markBack}
                aria-label={`Back to ${back.label}`}
                className="press glass flex h-10 min-w-10 items-center justify-center rounded-full text-label md:gap-0.5 md:pl-1.5 md:pr-3.5"
              >
                <ChevronLeft className="h-[22px] w-[22px] shrink-0" strokeWidth={2.4} />
                <span className="hidden truncate text-subhead font-medium md:inline">{back.label}</span>
              </Link>
            )}
          </div>
          <div
            className={cn(
              "truncate text-center text-headline transition-[opacity,transform] duration-300 ease-ios",
              // Takes no width until it shows, so the back control isn't squeezed.
              collapsed ? "max-w-[46vw] translate-y-0 opacity-100 md:max-w-md" : "max-w-0 translate-y-1 opacity-0",
            )}
            aria-hidden={!collapsed}
          >
            {title}
          </div>
          <div className="flex items-center justify-end gap-2">{actions}</div>
        </div>
      </header>

      <div className={cn("px-4 pb-tabbar md:px-8 md:pb-12", className)}>
        <div className="mb-5 mt-1">
          {eyebrow && <div className="mb-0.5 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">{eyebrow}</div>}
          {!hideLargeTitle && (
            <div className="flex items-end justify-between gap-3">
              {/* Detail screens (with a back link) get a smaller title that wraps to two lines at most. */}
              <h1 className={cn("min-w-0", back ? "line-clamp-2 text-title1 md:text-large-title" : "text-large-title")}>{title}</h1>
              {titleTrailing && <div className="mb-1 shrink-0">{titleTrailing}</div>}
            </div>
          )}
          <div ref={sentinel} aria-hidden />
          {subtitle && <div className="mt-1 text-subhead text-label-2">{subtitle}</div>}
          {accessory && <div className="mt-4">{accessory}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Round glass button for the navigation bar (forwards ref/props so it can be a menu trigger). */
export const NavButton = forwardRef<
  HTMLButtonElement,
  { children: React.ReactNode; label: string; href?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, label, href, className, ...rest }, ref) => {
  const cls = cn("press glass flex h-10 min-w-10 items-center justify-center rounded-full px-2.5 text-label", className);
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" aria-label={label} className={cls} {...rest}>
      {children}
    </button>
  );
});
NavButton.displayName = "NavButton";
