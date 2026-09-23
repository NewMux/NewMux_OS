"use client";

import { Search, XCircle } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }
>(({ value, onChange, className, placeholder = "Search", ...props }, ref) => (
  <div className={cn("relative flex h-9 items-center rounded-[10px] bg-fill/[0.12]", className)}>
    <Search className="pointer-events-none absolute left-2 h-4 w-4 text-label-2" aria-hidden />
    <input
      ref={ref}
      type="search"
      enterKeyHint="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-full w-full bg-transparent pl-8 pr-8 text-label placeholder:text-label-2 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      {...props}
    />
    {value && (
      <button type="button" aria-label="Clear" onClick={() => onChange("")} className="absolute right-2 text-label-3">
        <XCircle className="h-4 w-4 fill-label-3 text-bg-elevated" />
      </button>
    )}
  </div>
));
SearchField.displayName = "SearchField";
