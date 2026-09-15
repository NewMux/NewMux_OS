import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]",
  {
    variants: {
      variant: {
        default: "bg-emerald-600 text-white hover:bg-emerald-500",
        secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
        ghost: "bg-transparent text-slate-300 hover:bg-slate-800",
        destructive: "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        default: "px-4 py-2",
        sm: "px-3 py-1.5 text-xs min-h-[36px]",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
