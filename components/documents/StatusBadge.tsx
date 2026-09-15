import { Badge } from "@/components/ui/Badge";
import type { DocumentStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STYLES: Record<DocumentStatus, string> = {
  draft: "bg-tone-neutral/20 text-secondary-foreground",
  sent: "bg-tone-info/20 text-tone-info-fg",
  accepted: "bg-tone-warning/20 text-tone-warning-fg",
  signed: "bg-tone-warning/20 text-tone-warning-fg",
  paid: "bg-tone-success/20 text-tone-success-fg",
  archived: "bg-tone-muted/20 text-tone-muted-fg",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge className={cn(STYLES[status], "capitalize")}>{status}</Badge>;
}
