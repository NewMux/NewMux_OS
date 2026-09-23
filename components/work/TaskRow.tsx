"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { MessageCircle, ListChecks } from "lucide-react";
import { CheckCircle } from "@/components/ui/Toggle";
import { useMutation } from "@/lib/useMutation";
import { TASK_PRIORITY } from "@/lib/labels";
import { relativeDay, todayYmd } from "@/lib/time";
import { cn } from "@/lib/utils";
import { solidBg, asSysColor, text as textColor } from "@/lib/colors";
import type { TaskWithMeta } from "@/lib/data/types";

/** Opens the task sheet by adding ?task=<id> to the current URL. */
export function useOpenTask() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("task", id);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

/** Reminders-style task row: round checkbox, title, and a compact meta line. */
export function TaskRow({ task, showProject = true }: { task: TaskWithMeta; showProject?: boolean }) {
  const { run } = useMutation();
  const openTask = useOpenTask();
  const [, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(task.status === "done");
  const today = todayYmd();
  const overdue = !done && task.dueAt && task.dueAt < today;
  const priority = TASK_PRIORITY[task.priority];
  const color = asSysColor(task.projectColor);

  const toggle = (checked: boolean) =>
    startTransition(async () => {
      setDone(checked);
      await run(`/api/tasks/${task.id}`, { method: "PATCH", body: { status: checked ? "done" : "todo" } });
    });

  return (
    <div className="flex w-full items-start gap-3 pl-4 transition-colors active:bg-fill/10 [&:last-child_.row-sep]:shadow-none">
      <div className="pt-3">
        <CheckCircle checked={done} onChange={toggle} color="bg-accent border-accent" label={`Complete ${task.title}`} />
      </div>
      <button
        type="button"
        onClick={() => openTask(task.id)}
        className="row-sep min-w-0 flex-1 py-2.5 pr-4 text-left shadow-[inset_0_-0.5px_0_rgb(var(--separator))]"
      >
        <span className={cn("block text-body", done && "text-label-2 line-through decoration-label-3")}>
          {priority.marks && <span className={cn("mr-1 font-semibold", textColor[priority.color])}>{priority.marks}</span>}
          {task.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-subhead text-label-2">
          {showProject && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", solidBg[color])} />
              <span className="truncate">{task.projectName}</span>
            </span>
          )}
          {task.dueAt && <span className={cn(overdue && "text-ios-red")}>{relativeDay(task.dueAt)}</span>}
          {task.assigneeName && <span className="truncate">{task.assigneeName.split(" ")[0]}</span>}
          {task.subtaskCount > 0 && (
            <span className="flex items-center gap-0.5">
              <ListChecks className="h-3.5 w-3.5" />
              {task.subtaskDoneCount}/{task.subtaskCount}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3.5 w-3.5" />
              {task.commentCount}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
