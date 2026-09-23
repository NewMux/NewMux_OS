import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { solidBg, type SysColor } from "@/lib/colors";
import { RowLink } from "./RowLink";

/**
 * Inset grouped list (iOS 26): a sentence-case header, a rounded card of rows
 * with inset hairline separators, an optional footer. `prominent` gives the
 * bold Health/Fitness-style section title used on dashboards.
 */
export function ListSection({
  header,
  footer,
  action,
  children,
  className,
  inset = true,
  variant = "default",
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  inset?: boolean;
  variant?: "default" | "prominent";
}) {
  const prominent = variant === "prominent";
  return (
    <section className={cn(prominent ? "mb-8" : "mb-7", className)}>
      {(header || action) && (
        <div className={cn("flex items-end justify-between", prominent ? "mb-2.5 px-1" : "mb-1.5 px-4")}>
          {header ? <h2 className={prominent ? "text-title3 font-bold text-label" : "text-footnote font-medium text-label-2"}>{header}</h2> : <span />}
          {action}
        </div>
      )}
      <div className={cn("overflow-hidden bg-bg-elevated", inset && "rounded-card")}>{children}</div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-label-2">{footer}</p>}
    </section>
  );
}

/** "Show All ›" link for a section header. */
export function SectionLink({ href, children = "Show All" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="press -my-3 flex items-center gap-0.5 py-3 text-subhead font-medium text-accent">
      {children}
      <ChevronRight className="h-4 w-4" strokeWidth={2.4} aria-hidden />
    </Link>
  );
}

/** Square rounded icon tile (Settings-style) in a system colour. */
export function IconTile({ icon: Icon, color = "blue", size = "md" }: { icon: React.ComponentType<{ className?: string }>; color?: SysColor; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-10 w-10 rounded-[10px]" : size === "sm" ? "h-6 w-6 rounded-[6px]" : "h-[30px] w-[30px] rounded-[8px]";
  const icon = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span className={cn("flex shrink-0 items-center justify-center text-white", dims, solidBg[color])}>
      <Icon className={icon} />
    </span>
  );
}

type RowProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  detail?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  className?: string;
  multiline?: boolean;
};

/** One row of a ListSection. Becomes a link or button when given href/onClick. */
export function ListRow({ title, subtitle, detail, leading, trailing, href, onClick, chevron, destructive, className, multiline }: RowProps) {
  const interactive = !!(href || onClick);
  const showChevron = chevron ?? !!href;
  const content = (
    <>
      {leading && <span className="flex shrink-0 items-center py-2 pl-4">{leading}</span>}
      <span
        className={cn(
          "row-sep flex min-h-[44px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]",
          leading ? "ml-3" : "ml-4",
        )}
      >
        <span className={cn("min-w-0 flex-1", detail !== undefined && detail !== null && "min-w-[40%]")}>
          <span className={cn("block text-body", !multiline && "truncate", destructive ? "text-ios-red" : "text-label")}>{title}</span>
          {subtitle && <span className={cn("mt-0.5 block text-subhead text-label-2", !multiline && "truncate")}>{subtitle}</span>}
        </span>
        {detail !== undefined && detail !== null && (
          // The value truncates before the label does (iOS behaviour), capped so the label keeps room.
          <span className="min-w-0 max-w-[60%] truncate text-right text-body text-label-2 tabular">{detail}</span>
        )}
        {trailing}
        {showChevron && <ChevronRight className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.5} aria-hidden />}
      </span>
    </>
  );
  const base = cn(
    "flex w-full items-stretch text-left [&:last-child_.row-sep]:shadow-none",
    interactive && "transition-colors active:bg-fill/20 md:hover:bg-fill/[0.06]",
    className,
  );
  if (href) {
    return (
      <RowLink href={href} className={base}>
        {content}
      </RowLink>
    );
  }
  if (onClick) {
    // A div with button semantics, so rows can hold their own trailing buttons.
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(base, "cursor-pointer")}
      >
        {content}
      </div>
    );
  }
  return <div className={base}>{content}</div>;
}

/** A form row: label on the left, control on the right (iOS "Name   Value >"). */
export function FieldRow({ label, children, className, stacked }: { label: React.ReactNode; children: React.ReactNode; className?: string; stacked?: boolean }) {
  return (
    <label className={cn("flex w-full items-stretch [&:last-child_.row-sep]:shadow-none", className)}>
      <span
        className={cn(
          "row-sep ml-4 flex min-h-[44px] min-w-0 flex-1 gap-3 py-2 pr-4 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]",
          stacked ? "flex-col items-stretch gap-1 py-2.5" : "items-center justify-between",
        )}
      >
        <span className={cn("shrink-0 text-body text-label", stacked && "text-footnote text-label-2")}>{label}</span>
        <span className={cn("flex min-w-0 items-center", !stacked && "justify-end")}>{children}</span>
      </span>
    </label>
  );
}

/** Borderless input sized for a FieldRow / list row. */
export function RowInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("w-full min-w-0 bg-transparent text-right text-label placeholder:text-label-3 focus:outline-none", className)}
      {...props}
    />
  );
}

/** Full-width borderless input row with placeholder only (like Contacts "First name"). */
export function PlainRowInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex w-full [&:last-child_.row-sep]:shadow-none">
      <input
        className={cn(
          "row-sep ml-4 min-h-[44px] w-full bg-transparent pr-4 text-label shadow-[inset_0_-0.5px_0_rgb(var(--separator))] placeholder:text-label-3 focus:outline-none",
          className,
        )}
        {...props}
      />
    </div>
  );
}
