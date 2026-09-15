import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { FollowUpReminder } from "@/lib/data/deals";

const STATUS_STYLE: Record<FollowUpReminder["status"], string> = {
  overdue: "bg-red-500/20 text-red-300",
  today: "bg-amber-500/20 text-amber-300",
  upcoming: "bg-slate-700/60 text-slate-300",
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
        <span className="text-xs text-slate-500">
          {overdue} overdue · {today} today
        </span>
      </CardHeader>

      {reminders.length === 0 && <p className="text-sm text-slate-500">No follow-ups scheduled in the next two weeks.</p>}

      <div className="flex flex-col gap-1">
        {reminders.map((r) => (
          <Link
            key={r.dealId}
            href={`/pipeline/${r.dealId}`}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-900"
          >
            <span className="text-slate-200">{r.dealName}</span>
            <span className="flex items-center gap-2 text-xs text-slate-500">
              {ownerNames[r.ownerId] ?? "Unassigned"} · {new Date(r.dueDate).toLocaleDateString()}
              <Badge className={STATUS_STYLE[r.status]}>{r.status}</Badge>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
