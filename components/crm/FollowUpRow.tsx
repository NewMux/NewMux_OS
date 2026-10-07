"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { CheckCircle } from "@/components/ui/Toggle";
import { useMutation } from "@/lib/useMutation";
import { relativeDay, toYmd, todayYmd } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ActivityListItem } from "@/lib/data/crm";

/** An open follow-up (a CRM reminder) that can be ticked off in place. */
export function FollowUpRow({ activity }: { activity: ActivityListItem }) {
  const { run } = useMutation();
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(!!activity.completedAt);
  const due = activity.dueAt ? toYmd(activity.dueAt) : null;
  const overdue = !done && due !== null && due < todayYmd();
  const href = activity.dealId ? `/crm/deals/${activity.dealId}` : activity.clientId ? `/clients/${activity.clientId}` : "/crm/activities";

  return (
    <div className="flex items-start gap-3 pl-4 [&:last-child_.row-sep]:shadow-none">
      <div className="pt-3">
        <CheckCircle
          checked={done}
          color="bg-accent border-accent"
          label={`Complete ${activity.subject}`}
          onChange={(v) =>
            start(async () => {
              setDone(v);
              await run(`/api/activities/${activity.id}`, { method: "PATCH", body: { completed: v }, success: v ? "Follow-up done" : undefined });
            })
          }
        />
      </div>
      <Link href={href} className="row-sep min-w-0 flex-1 py-2.5 pr-4 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
        <span className={cn("block text-body", done && "text-label-2 line-through")}>{activity.subject}</span>
        <span className="mt-0.5 flex gap-2 text-subhead text-label-2">
          {due && <span className={cn(overdue && "text-ios-red")}>{relativeDay(due)}</span>}
          <span className="truncate">{activity.dealTitle ?? activity.clientName ?? activity.contactName}</span>
        </span>
      </Link>
    </div>
  );
}
