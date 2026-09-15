import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Tones are semantic, not color names, so a badge reads correctly in both
 * themes: the fill is the tone at low alpha, the text is the tone's
 * theme-specific readable shade (light in dark mode, dark in light mode).
 */
const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-tone-neutral/20 text-tone-neutral-fg",
      muted: "bg-tone-muted/20 text-tone-muted-fg",
      info: "bg-tone-info/20 text-tone-info-fg",
      success: "bg-tone-success/20 text-tone-success-fg",
      warning: "bg-tone-warning/20 text-tone-warning-fg",
      alert: "bg-tone-alert/20 text-tone-alert-fg",
      danger: "bg-tone-danger/20 text-tone-danger-fg",
      outline: "border border-border text-muted-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
