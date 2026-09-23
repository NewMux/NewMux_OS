"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CalendarDays, CalendarClock, Inbox, Plus, FolderKanban } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProjectSheet } from "@/components/work/WorkSheets";
import type { Option } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { PROJECT_STATUS } from "@/lib/labels";
import { asSysColor, solidBg, text as textColor } from "@/lib/colors";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ProjectWithStats } from "@/lib/data/projects";

const SMART = [
  { list: "today", label: "Today", icon: CalendarDays, color: "blue" },
  { list: "upcoming", label: "Next 7 Days", icon: CalendarClock, color: "red" },
  { list: "overdue", label: "Overdue", icon: AlertCircle, color: "orange" },
  { list: "all", label: "All Mine", icon: Inbox, color: "gray" },
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
      {/* Reminders-style smart lists */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SMART.map((s) => (
          <Link key={s.list} href={`/tasks?list=${s.list}`} className="press rounded-[14px] bg-bg-elevated p-3 shadow-widget dark:shadow-none">
            <div className="flex items-start justify-between">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white", solidBg[s.color])}>
                <s.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="font-rounded text-title1 tabular">{counts[s.list]}</span>
            </div>
            <div className="mt-2 text-headline text-label-2">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-title3">Projects</h2>
        <SegmentedControl
          size="sm"
          className="w-48"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: "Active" },
            { value: "done", label: "Done" },
          ]}
        />
      </div>

      {visible.length === 0 && <EmptyState icon={FolderKanban} title={filter === "active" ? "No active projects" : "Nothing finished yet"} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const color = asSysColor(p.color);
          const progress = p.taskCount ? p.doneCount / p.taskCount : 0;
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="press flex flex-col rounded-[18px] bg-bg-elevated p-4 shadow-widget dark:shadow-none">
              <div className="flex items-start gap-3">
                <ProgressRing value={progress} size={40} stroke={4.5} color={`rgb(var(--${color}))`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-headline">{p.name}</div>
                  <div className="truncate text-subhead text-label-2">{p.clientName ?? "Internal"}</div>
                </div>
                <Badge color={PROJECT_STATUS[p.status].color}>{PROJECT_STATUS[p.status].label}</Badge>
              </div>
              <div className="mt-4 flex items-center gap-3 text-footnote text-label-2">
                <span className={cn("font-semibold", textColor[color])}>{Math.round(progress * 100)}%</span>
                <span>{p.openCount} open</span>
                {p.overdueCount > 0 && <span className="text-ios-red">{p.overdueCount} overdue</span>}
                {p.targetEndAt && <span className="ml-auto">Due {formatDate(p.targetEndAt, { day: "numeric", month: "short" })}</span>}
              </div>
            </Link>
          );
        })}
      </div>
      <ProjectSheet open={creating} onOpenChange={setCreating} clients={clients} canDelete={canDelete} />
    </Page>
  );
}
