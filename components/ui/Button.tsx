import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const buttonVariants = cva(
  "press inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent/90",
        tinted: "bg-accent/15 text-accent hover:bg-accent/20",
        secondary: "bg-fill/[0.14] text-label hover:bg-fill/20",
        ghost: "bg-transparent text-accent hover:bg-fill/10",
        destructive: "bg-ios-red text-white hover:bg-ios-red/90",
        "destructive-tinted": "bg-ios-red/15 text-ios-red hover:bg-ios-red/20",
        glass: "glass text-label shadow-glass",
      },
      size: {
        default: "h-11 rounded-xl px-5 text-body",
        sm: "h-8 rounded-full px-3.5 text-subhead",
        lg: "h-[50px] w-full rounded-2xl px-6 text-headline",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
