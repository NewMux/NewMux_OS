"use client";

import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-slate-900 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "min-h-[36px] rounded-md px-4 text-sm font-medium transition-colors",
            value === opt.value ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
