import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { TaskPriority } from "@/lib/data/types";

const TONES: Record<TaskPriority, BadgeTone> = {
  urgent: "danger",
  high: "alert",
  medium: "warning",
  low: "info",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge tone={TONES[priority]} className="capitalize">
      {priority}
    </Badge>
  );
}
