"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PriorityBadge } from "./PriorityBadge";
import { Avatar } from "@/components/ui/Avatar";
import { DragBoard, type BoardItem } from "@/components/kanban/DragBoard";
import type { Task, TaskStatus } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
];

type TaskBoardItem = BoardItem & { task: Task };

export function KanbanBoard({
  tasks,
  assignees = {},
}: {
  tasks: Task[];
  /** User id → display name, for the assignee avatar on each card. */
  assignees?: Record<string, string>;
}) {
  const router = useRouter();
  const [tasksById, setTasksById] = useState<Record<string, Task>>(() =>
    Object.fromEntries(tasks.map((t) => [t.id, t])),
  );

  const items = useMemo<TaskBoardItem[]>(
    () =>
      [...tasks]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => ({
          id: t.id,
          columnId: t.status,
          task: tasksById[t.id] ?? t,
        })),
    [tasks, tasksById],
  );

  const columns = COLUMNS.map((col) => {
    const count = items.filter((i) => i.columnId === col.status).length;
    return {
      id: col.status,
      label: col.label,
      meta: `${count} task${count === 1 ? "" : "s"}`,
    };
  });

  async function handleMove(taskId: string, toColumnId: string, index: number) {
    const status = toColumnId as TaskStatus;
    setTasksById((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? tasks.find((t) => t.id === taskId)!),
        status,
      },
    }));

    await apiMutate(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, index }),
    });
    router.refresh();
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tasks yet. Drag cards between columns once you add some.
      </p>
    );
  }

  return (
    <DragBoard
      items={items}
      columns={columns}
      onMove={handleMove}
      renderCard={(item) => (
        <Card className="cursor-grab text-sm active:cursor-grabbing">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-foreground">{item.task.title}</p>
            <PriorityBadge priority={item.task.priority} />
          </div>
          {item.task.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {item.task.description}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {item.task.dueAt
                ? `Due ${new Date(item.task.dueAt).toLocaleDateString()}`
                : ""}
            </p>
            {item.task.assigneeId && assignees[item.task.assigneeId] && (
              <Avatar name={assignees[item.task.assigneeId]!} />
            )}
          </div>
        </Card>
      )}
    />
  );
}
