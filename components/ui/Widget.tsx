import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { text as textColor, type SysColor } from "@/lib/colors";

/** Home-screen-widget style card. */
export function Widget({
  title,
  icon: Icon,
  color = "blue",
  href,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: SysColor;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const head = (
    <div className="mb-2 flex items-center gap-1.5">
      {Icon && <Icon className={cn("h-4 w-4", textColor[color])} />}
      <span className={cn("text-footnote font-semibold", textColor[color])}>{title}</span>
      {href && <ChevronRight className="ml-auto h-4 w-4 text-label-3" />}
    </div>
  );
  const cls = cn("block rounded-[20px] bg-bg-elevated p-4 shadow-widget dark:shadow-none", href && "press", className);
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

/** Big number + caption, for use inside a Widget. */
export function Metric({ value, caption, tone }: { value: React.ReactNode; caption?: React.ReactNode; tone?: "positive" | "negative" }) {
  return (
    <div>
      <div
        className={cn(
          "font-rounded text-title2 tabular leading-tight lg:text-title1",
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
