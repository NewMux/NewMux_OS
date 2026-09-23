import { forwardRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Filled text field (iOS search-field style). For rows inside a form list, use FieldRow. */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-[14px] bg-fill/[0.12] px-3.5 text-label placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-accent/40",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("w-full resize-none bg-transparent text-label placeholder:text-label-3 focus:outline-none", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/**
 * Native <select> — on iPhone this opens the system wheel picker, which is
 * exactly what an Apple app would use. Styled as right-aligned value text.
 */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <span className="relative inline-flex min-w-0 max-w-full items-center">
    <select
      ref={ref}
      className={cn(
        "min-w-0 max-w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-right text-label-2 focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronsUpDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-label-3" aria-hidden />
  </span>
));
Select.displayName = "Select";
