import { cn } from "@/lib/utils";

const COLORS = {
  ok: "bg-success",
  warn: "bg-warning",
  down: "bg-danger",
} as const;

export function StatusDot({ status }: { status: keyof typeof COLORS }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", COLORS[status])} aria-hidden />;
}
