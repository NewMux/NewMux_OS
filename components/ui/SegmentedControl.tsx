"use client";

import { cn } from "@/lib/utils";

/** iOS 26 segmented control: a capsule track with a springy sliding thumb. */
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
      className={cn("relative grid rounded-full bg-fill/[0.12] p-[3px]", size === "sm" ? "h-8" : "h-9", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute bottom-[3px] top-[3px] rounded-full bg-bg-elevated shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_2px_8px_rgb(0_0_0/0.12)] transition-transform duration-500 ease-spring dark:bg-[#5b5b60] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_2px_8px_rgb(0_0_0/0.4)]"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${index * 100}%)`, left: 3 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 truncate px-2.5 text-footnote transition-colors",
            o.value === value ? "font-semibold text-label" : "font-medium text-label",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
