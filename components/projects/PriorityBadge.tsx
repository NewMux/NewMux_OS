import { Badge } from "@/components/ui/Badge";
import type { TaskPriority } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STYLES: Record<TaskPriority, string> = {
  urgent: "bg-tone-danger/20 text-tone-danger-fg",
  high: "bg-tone-alert/20 text-tone-alert-fg",
  medium: "bg-tone-warning/20 text-tone-warning-fg",
  low: "bg-tone-info/20 text-tone-info-fg",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge className={cn(STYLES[priority], "capitalize")}>{priority}</Badge>;
}
