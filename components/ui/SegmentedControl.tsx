"use client";

import { cn } from "@/lib/utils";

/** iOS segmented control with a sliding thumb. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="tablist"
      className={cn("relative grid rounded-[9px] bg-fill/[0.12] p-[2px]", size === "sm" ? "h-7" : "h-8", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute bottom-[2px] top-[2px] rounded-[7px] bg-bg-elevated shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-ios dark:bg-[#636366]"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)`, left: 2 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 truncate px-2 text-footnote transition-colors",
            o.value === value ? "font-semibold text-label" : "font-medium text-label",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
