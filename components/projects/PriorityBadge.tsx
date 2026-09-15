import { Badge } from "@/components/ui/Badge";
import type { TaskPriority } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STYLES: Record<TaskPriority, string> = {
  urgent: "bg-red-500/20 text-red-300",
  high: "bg-orange-500/20 text-orange-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-sky-500/20 text-sky-300",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge className={cn(STYLES[priority], "capitalize")}>{priority}</Badge>;
}
