import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Quiet summary card: grey label, one figure. Colour is reserved for meaning (see Metric tone). */
export function Widget({
  title,
  icon: Icon,
  href,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const head = (
    <div className="mb-1.5 flex items-center gap-1.5 text-label-2">
      {Icon && <Icon className="h-4 w-4" />}
      <span className="text-footnote font-medium">{title}</span>
      {href && <ChevronRight className="ml-auto h-4 w-4 text-label-3" />}
    </div>
  );
  const cls = cn("block rounded-card bg-bg-elevated p-4", href && "press", className);
  return href ? (
    <Link href={href} className={cls}>
      {head}
      {children}
    </Link>
  ) : (
    <div className={cls}>
      {head}
      {children}
    </div>
  );
}

/** Figure + caption, for use inside a Widget. */
export function Metric({ value, caption, tone }: { value: React.ReactNode; caption?: React.ReactNode; tone?: "positive" | "negative" }) {
  return (
    <div>
      <div
        className={cn(
          "font-rounded text-title2 font-semibold tabular leading-tight",
          tone === "positive" && "text-ios-green",
          tone === "negative" && "text-ios-red",
        )}
      >
        {value}
      </div>
      {caption && <div className="mt-0.5 text-footnote text-label-2">{caption}</div>}
    </div>
  );
}

export type SummaryItem = {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  href?: string;
  tone?: "negative";
};

/** One card holding two to four related figures side by side, split by hairlines. */
export function SummaryCard({ items, className }: { items: SummaryItem[]; className?: string }) {
  return (
    <div
      className={cn("mb-7 grid overflow-hidden rounded-card bg-bg-elevated", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => {
        const body = (
          <>
            <div className="truncate text-footnote text-label-2">{item.label}</div>
            <div className={cn("mt-0.5 truncate font-rounded text-headline font-semibold tabular md:text-title2", item.tone === "negative" && "text-ios-red")}>
              <Amount value={item.value} />
            </div>
            {item.caption && <div className="mt-0.5 truncate text-caption1 text-label-2">{item.caption}</div>}
          </>
        );
        const cls = cn("block min-w-0 px-3 py-3 md:px-5 md:py-4", i > 0 && "shadow-[inset_0.5px_0_0_rgb(var(--separator))]");
        return item.href ? (
          <Link key={item.label} href={item.href} className={cn(cls, "press transition-colors hover:bg-fill/[0.06]")}>
            {body}
          </Link>
        ) : (
          <div key={item.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** "BHD 305.1" → a small grey currency code and the figure, so three fit side by side on a phone. */
function Amount({ value }: { value: React.ReactNode }) {
  const m = typeof value === "string" ? /^(-?)([A-Z]{3}) (.+)$/.exec(value) : null;
  if (!m) return <>{value}</>;
  return (
    <>
      <span className="mr-1 text-footnote font-medium text-label-2">{m[2]}</span>
      {m[1]}
      {m[3]}
    </>
  );
}
