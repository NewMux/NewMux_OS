import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScrollText } from "lucide-react";
import type { VaultAccessLogEntry } from "@/lib/data/types";

const ACTION_TONES: Record<VaultAccessLogEntry["action"], BadgeTone> = {
  reveal: "info",
  unlock_attempt: "warning",
  create: "success",
  update: "neutral",
  delete: "danger",
};

const ACTION_LABELS: Record<VaultAccessLogEntry["action"], string> = {
  reveal: "Revealed",
  unlock_attempt: "Unlock attempt while locked",
  create: "Stored",
  update: "Renamed",
  delete: "Deleted",
};

/**
 * The audit trail for credential access.
 *
 * Deleted credentials still appear here, by name: each entry carries the label
 * as it stood when it was written, so "who destroyed which secret, and when"
 * survives the secret itself. That is the whole point of the log.
 */
export function VaultAccessLog({
  entries,
  liveSecretIds,
  userFor,
}: {
  entries: VaultAccessLogEntry[];
  /** Ids still in the vault; anything else is marked as since-deleted. */
  liveSecretIds: Set<string>;
  userFor: (userId: string) => string | null;
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Access log</CardTitle>
      </CardHeader>
      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nothing logged yet"
          description="Every reveal, rename, deletion and failed unlock is recorded here."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map((entry) => {
            const gone = !liveSecretIds.has(entry.secretId);
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-foreground">
                    {entry.secretLabel}
                    {gone && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (no longer in the vault)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userFor(entry.accessedBy) ?? "Unknown user"} ·{" "}
                    {new Date(entry.accessedAt).toLocaleString()}
                  </p>
                </div>
                <Badge tone={ACTION_TONES[entry.action]} className="shrink-0">
                  {ACTION_LABELS[entry.action]}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
