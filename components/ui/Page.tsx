"use client";

import Link from "next/link";
import { forwardRef, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Screen scaffold with an iOS large title that collapses into a centred,
 * frosted navigation bar as you scroll. `back` renders the chevron + parent
 * title; `actions` sit at the trailing edge of the bar.
 */
export function Page({
  title,
  subtitle,
  back,
  actions,
  accessory,
  children,
  className,
  wide,
  hideLargeTitle,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Rendered under the large title (search field, segmented control…). */
  accessory?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Allow wider content (boards). */
  wide?: boolean;
  /** The screen renders its own editable title (wiki pages); the bar title still appears on scroll. */
  hideLargeTitle?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry!.isIntersecting), { rootMargin: "-52px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={cn("mx-auto w-full", wide ? "max-w-[1400px]" : "max-w-5xl")}>
      <header
        className={cn(
          "sticky top-0 z-30 safe-top transition-[background-color,box-shadow] duration-200",
          collapsed ? "material hairline-b" : "bg-transparent",
        )}
      >
        <div className="grid h-[52px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 md:px-6">
          <div className="flex min-w-0 justify-start">
            {back && (
              <Link href={back.href} className="press -ml-1 flex min-w-0 items-center text-body text-accent">
                <ChevronLeft className="h-7 w-7 shrink-0" strokeWidth={2.2} />
                <span className="truncate">{back.label}</span>
              </Link>
            )}
          </div>
          <div
            className={cn(
              "truncate text-center text-headline transition-opacity duration-200",
              // Takes no width until it shows, so the back label isn't squeezed.
              collapsed ? "max-w-[44vw] opacity-100 md:max-w-md" : "max-w-0 opacity-0",
            )}
            aria-hidden={!collapsed}
          >
            {title}
          </div>
          <div className="flex items-center justify-end gap-2">{actions}</div>
        </div>
      </header>

      <div className={cn("px-4 pb-tabbar md:px-8 md:pb-12", className)}>
        <div className="mb-4 mt-0.5">
          {/* Detail screens (with a back link) get a smaller title that wraps to two lines at most. */}
          {!hideLargeTitle && <h1 className={back ? "line-clamp-2 text-title1 md:text-large-title" : "text-large-title"}>{title}</h1>}
          <div ref={sentinel} aria-hidden />
          {subtitle && <div className="mt-0.5 text-subhead text-label-2">{subtitle}</div>}
          {accessory && <div className="mt-3">{accessory}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Round glass icon button for the navigation bar (forwards ref/props so it can be a menu trigger). */
export const NavButton = forwardRef<
  HTMLButtonElement,
  { children: React.ReactNode; label: string; href?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, label, href, className, ...rest }, ref) => {
  const cls = cn("press glass flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-accent shadow-glass", className);
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
