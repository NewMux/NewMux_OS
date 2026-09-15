import { Badge } from "@/components/ui/Badge";
import type { DocumentStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STYLES: Record<DocumentStatus, string> = {
  draft: "bg-slate-500/20 text-slate-300",
  sent: "bg-blue-500/20 text-blue-300",
  accepted: "bg-amber-500/20 text-amber-300",
  signed: "bg-amber-500/20 text-amber-300",
  paid: "bg-emerald-500/20 text-emerald-300",
  archived: "bg-zinc-500/20 text-zinc-400",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge className={cn(STYLES[status], "capitalize")}>{status}</Badge>;
}
