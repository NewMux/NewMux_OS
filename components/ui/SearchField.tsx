"use client";

import { Search, XCircle } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }
>(({ value, onChange, className, placeholder = "Search", ...props }, ref) => (
  <div className={cn("relative flex h-10 items-center rounded-full bg-fill/[0.12]", className)}>
    <Search className="pointer-events-none absolute left-3 h-4 w-4 text-label-2" aria-hidden />
    <input
      ref={ref}
      type="search"
      enterKeyHint="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-full w-full bg-transparent pl-9 pr-9 text-label placeholder:text-label-2 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      {...props}
    />
    {value && (
      <button type="button" aria-label="Clear" onClick={() => onChange("")} className="absolute right-3 text-label-3">
        <XCircle className="h-4 w-4 fill-label-3 text-bg-elevated" />
      </button>
    )}
  </div>
));
SearchField.displayName = "SearchField";
