import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/** iOS 26 buttons: capsules; the one prominent action per screen is tinted glass. */
export const buttonVariants = cva(
  "press inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "glass-prominent hover:brightness-105",
        tinted: "bg-accent/15 text-accent hover:bg-accent/20",
        secondary: "bg-fill/[0.14] text-label hover:bg-fill/20",
        ghost: "bg-transparent text-accent hover:bg-fill/10",
        destructive: "bg-ios-red text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28)] hover:bg-ios-red/90",
        "destructive-tinted": "bg-ios-red/15 text-ios-red hover:bg-ios-red/20",
        glass: "glass text-label",
      },
      size: {
        default: "h-11 px-5 text-body",
        sm: "h-8 px-3.5 text-subhead",
        lg: "h-[50px] w-full px-6 text-headline",
        icon: "h-10 w-10",
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
