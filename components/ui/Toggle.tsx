"use client";

import { cn } from "@/lib/utils";

/** iOS switch. */
export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40",
        checked ? "bg-ios-green" : "bg-fill/[0.16] dark:bg-fill/[0.32]",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[inset_0_1px_0_rgb(255_255_255),0_3px_8px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.08)] transition-all duration-300 ease-spring group-active:w-[33px]",
          checked ? "left-[22px] group-active:left-[16px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

/** Round Reminders-style checkbox. */
export function CheckCircle({
  checked,
  onChange,
  color = "bg-accent border-accent",
  label,
  size = 22,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  color?: string;
  label?: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange?.(!checked);
      }}
      style={{ width: size, height: size }}
      className={cn(
        "press flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        checked ? color : "border-label-3 bg-transparent",
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-[60%] w-[60%] text-white" aria-hidden>
          <path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
