"use client";

import { useState } from "react";
import { AlertCircle, CalendarDays, CalendarClock, CalendarRange, Inbox, Plus, FolderKanban } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ListRow, ListSection } from "@/components/ui/List";
import { ProjectSheet } from "@/components/work/WorkSheets";
import type { Option } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { PROJECT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ProjectWithStats } from "@/lib/data/projects";

const SMART = [
  { list: "today", label: "Today", icon: CalendarDays },
  { list: "upcoming", label: "Next 7 Days", icon: CalendarClock },
  { list: "overdue", label: "Overdue", icon: AlertCircle },
  { list: "all", label: "All Mine", icon: Inbox },
] as const;

export function WorkScreen({ projects, counts, clients, canDelete }: { projects: ProjectWithStats[]; counts: Record<(typeof SMART)[number]["list"], number>; clients: Option[]; canDelete: boolean }) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"active" | "done">("active");
  useNewParam(() => setCreating(true));
  const visible = projects.filter((p) => (filter === "active" ? !["completed", "archived"].includes(p.status) : ["completed", "archived"].includes(p.status)));

  return (
    <Page
      title="Work"
      actions={
        <NavButton label="New project" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" />
        </NavButton>
      }
    >
      <div className="grid gap-x-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] [&>*]:min-w-0">
        <ListSection header="My Tasks">
          {SMART.map((s) => (
            <ListRow
              key={s.list}
              href={`/tasks?list=${s.list}`}
              leading={<s.icon className="h-[22px] w-[22px] text-label-2" strokeWidth={1.7} />}
              title={s.label}
              detail={<span className={cn(s.list === "overdue" && counts[s.list] > 0 && "text-ios-red")}>{counts[s.list]}</span>}
            />
          ))}
          <ListRow href="/meetings" leading={<CalendarRange className="h-[22px] w-[22px] text-label-2" strokeWidth={1.7} />} title="Calendar" />
        </ListSection>

        <section className="mb-7">
          <div className="mb-1.5 flex items-center justify-between gap-3 px-4">
            <h2 className="text-footnote font-medium text-label-2">Projects</h2>
            <SegmentedControl
              size="sm"
              className="w-40"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "active", label: "Active" },
                { value: "done", label: "Done" },
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={FolderKanban} title={filter === "active" ? "No active projects" : "Nothing finished yet"} />
          ) : (
            <div className="overflow-hidden rounded-card bg-bg-elevated">
              {visible.map((p) => {
                const progress = p.taskCount ? p.doneCount / p.taskCount : 0;
                const status = PROJECT_STATUS[p.status];
                return (
                  <ListRow
                    key={p.id}
                    href={`/projects/${p.id}`}
                    leading={<ProgressRing value={progress} size={26} stroke={3.5} color="rgb(var(--blue))" />}
                    title={p.name}
                    subtitle={
                      <>
                        {[p.clientName ?? "Internal", `${p.openCount} open`].join(" · ")}
                        {p.overdueCount > 0 && <span className="text-ios-red"> · {p.overdueCount} overdue</span>}
                        {p.targetEndAt && ` · due ${formatDate(p.targetEndAt, { day: "numeric", month: "short" })}`}
                      </>
                    }
                    trailing={["planning", "on_hold"].includes(p.status) ? <Badge color={status.color}>{status.label}</Badge> : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
      <ProjectSheet open={creating} onOpenChange={setCreating} clients={clients} canDelete={canDelete} />
    </Page>
  );
}
