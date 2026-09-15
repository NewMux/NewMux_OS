import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { FollowUpReminder } from "@/lib/data/deals";

const STATUS_TONE: Record<FollowUpReminder["status"], BadgeTone> = {
  overdue: "danger",
  today: "warning",
  upcoming: "outline",
};

export function FollowUpsPanel({
  reminders,
  ownerNames,
}: {
  reminders: FollowUpReminder[];
  ownerNames: Record<string, string>;
}) {
  const overdue = reminders.filter((r) => r.status === "overdue").length;
  const today = reminders.filter((r) => r.status === "today").length;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Follow-ups</CardTitle>
        <span className="text-xs text-muted-foreground">
          {overdue} overdue · {today} today
        </span>
      </CardHeader>

      {reminders.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No follow-ups scheduled in the next two weeks.
        </p>
      )}

      <div className="flex flex-col gap-1">
        {reminders.map((r) => (
          <Link
            key={r.dealId}
            href={`/pipeline/${r.dealId}`}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-card"
          >
            <span className="text-foreground">{r.dealName}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {ownerNames[r.ownerId] ?? "Unassigned"} ·{" "}
              {new Date(r.dueDate).toLocaleDateString()}
              <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
