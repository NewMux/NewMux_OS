import { cn } from "@/lib/utils";
import { tintBg, tintText, type SysColor } from "@/lib/colors";

/** Tinted capsule label. */
export function Badge({ color = "gray", className, children }: { color?: SysColor; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption1 font-medium", tintBg[color], tintText[color], className)}>
      {children}
    </span>
  );
}
