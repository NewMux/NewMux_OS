import { cn } from "@/lib/utils";

const COLORS = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  down: "bg-red-500",
} as const;

export function StatusDot({ status }: { status: keyof typeof COLORS }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", COLORS[status])} aria-hidden />;
}
