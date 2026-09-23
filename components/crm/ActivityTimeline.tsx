import { Phone, Mail, Users, StickyNote, MessageCircle, AlarmClock } from "lucide-react";
import { ACTIVITY_KIND } from "@/lib/labels";
import { formatDate, timeAgo } from "@/lib/time";
import { solidBg } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { ActivityListItem } from "@/lib/data/crm";
import type { ActivityKind } from "@/lib/data/types";

const ICON: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: StickyNote,
  whatsapp: MessageCircle,
  follow_up: AlarmClock,
};

/** Vertical timeline of calls, messages, notes and follow-ups. */
export function ActivityTimeline({ activities, showContext }: { activities: ActivityListItem[]; showContext?: boolean }) {
  if (activities.length === 0) return <p className="px-4 py-6 text-center text-subhead text-label-2">No activity yet. Log calls, messages and notes here.</p>;
  return (
    <ol className="px-4 py-3">
      {activities.map((a, i) => {
        const Icon = ICON[a.kind];
        const meta = ACTIVITY_KIND[a.kind];
        const pending = a.kind === "follow_up" && !a.completedAt;
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < activities.length - 1 && <span className="absolute bottom-0 left-[13px] top-7 w-px bg-separator" aria-hidden />}
            <span className={cn("z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white", pending ? "bg-ios-orange" : solidBg[meta.color])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("text-body font-medium", a.kind === "follow_up" && a.completedAt && "text-label-2 line-through")}>{a.subject}</span>
                <span className="shrink-0 text-caption1 text-label-2">{pending && a.dueAt ? `due ${formatDate(a.dueAt, { day: "numeric", month: "short" })}` : timeAgo(a.completedAt ?? a.createdAt)}</span>
              </div>
              {a.body && <p className="mt-0.5 whitespace-pre-wrap text-subhead text-label-2">{a.body}</p>}
              <p className="mt-0.5 text-caption1 text-label-3">
                {[meta.label, a.createdByName, showContext ? (a.dealTitle ?? a.clientName) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
