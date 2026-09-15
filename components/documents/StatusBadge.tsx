import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { DocumentStatus } from "@/lib/data/types";

const TONES: Record<DocumentStatus, BadgeTone> = {
  draft: "neutral",
  sent: "info",
  accepted: "warning",
  signed: "warning",
  paid: "success",
  archived: "muted",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge tone={TONES[status]} className="capitalize">
      {status}
    </Badge>
  );
}
