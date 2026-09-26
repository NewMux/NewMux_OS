"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheckBig } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListSection } from "@/components/ui/List";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/work/TaskRow";
import { NewTaskSheet } from "@/components/work/WorkSheets";
import type { Option } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { addDaysYmd, relativeDay, todayYmd } from "@/lib/time";
import type { TaskWithMeta } from "@/lib/data/types";

type List = "today" | "upcoming" | "overdue" | "all";

export function TasksScreen({ tasks, userId, projects, users }: { tasks: TaskWithMeta[]; userId: string; projects: Option[]; users: Option[] }) {
  const params = useSearchParams();
  const initial = (params.get("list") as List | null) ?? "all";
  const [list, setList] = useState<List>(["today", "upcoming", "overdue", "all"].includes(initial) ? initial : "all");
  const [showDone, setShowDone] = useState(false);
  const [creating, setCreating] = useState(false);
  useNewParam(() => setCreating(true));
  const today = todayYmd();
  const week = addDaysYmd(today, 7);

  const groups = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    const pick =
      list === "today"
        ? open.filter((t) => t.dueAt && t.dueAt <= today)
        : list === "upcoming"
          ? open.filter((t) => t.dueAt && t.dueAt > today && t.dueAt <= week)
          : list === "overdue"
            ? open.filter((t) => t.dueAt && t.dueAt < today)
            : open;
    const out = new Map<string, TaskWithMeta[]>();
    for (const t of pick) {
      const key = !t.dueAt ? "No Date" : t.dueAt < today ? "Overdue" : relativeDay(t.dueAt);
      out.set(key, [...(out.get(key) ?? []), t]);
    }
    const order = (k: string) => (k === "Overdue" ? -1 : k === "No Date" ? 99 : 0);
    return [...out.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  }, [tasks, list, today, week]);

  const done = tasks.filter((t) => t.status === "done");

  return (
    <Page
      title="My Tasks"
      back={{ href: "/work", label: "Work" }}
      actions={
        <QuickAddMenu extra={[{ label: "New task", onSelect: () => setCreating(true) }]} />
      }
      accessory={
        <SegmentedControl
          value={list}
          onChange={setList}
          options={[
            { value: "today", label: "Today" },
            { value: "upcoming", label: "7 Days" },
            { value: "overdue", label: "Overdue" },
            { value: "all", label: "All" },
          ]}
        />
      }
    >
      <div className="mx-auto max-w-2xl">
        {groups.length === 0 && <EmptyState icon={CircleCheckBig} title="All done" message={list === "all" ? "Nothing assigned to you." : "Nothing in this list."} />}
        {groups.map(([label, items]) => (
          <ListSection key={label} header={<span className={label === "Overdue" ? "text-ios-red" : undefined}>{label}</span>}>
            {items.map((t) => (
              <TaskRow key={t.id} task={t} hideAssignee />
            ))}
          </ListSection>
        ))}
        {done.length > 0 && (
          <>
            <button type="button" onClick={() => setShowDone((s) => !s)} className="mb-3 px-4 text-subhead text-accent">
              {showDone ? "Hide Completed" : `Show ${done.length} Completed`}
            </button>
            {showDone && (
              <ListSection>
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} hideAssignee />
                ))}
              </ListSection>
            )}
          </>
        )}
      </div>
      <NewTaskSheet open={creating} onOpenChange={setCreating} projects={projects} users={users} defaultAssigneeId={userId} />
    </Page>
  );
}
