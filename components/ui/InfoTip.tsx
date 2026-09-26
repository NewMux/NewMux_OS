"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ⓘ beside a heading: the explanation is one tap away instead of a
 * sentence under every card. Closes on a second tap, outside tap or Escape.
 */
export function InfoTip({ children, label = "More info", align = "start" }: { children: React.ReactNode; label?: string; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={box} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn("press -m-1.5 inline-flex items-center justify-center p-1.5 hover:text-accent", open ? "text-accent" : "text-label-2")}
      >
        <Info className="h-[15px] w-[15px]" strokeWidth={2.2} />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={cn(
            "glass-thick absolute top-full z-[85] mt-1.5 block w-max max-w-[min(300px,80vw)] rounded-[14px] px-3.5 py-2.5 text-left text-footnote font-normal normal-case tracking-normal text-label animate-pop-in",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
