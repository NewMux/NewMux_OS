"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PriorityBadge } from "./PriorityBadge";
import type { Task, TaskStatus } from "@/lib/data/types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
];

export function KanbanBoard({ tasks: initialTasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [updating, setUpdating] = useState<string | null>(null);

  async function changeStatus(taskId: string, status: TaskStatus) {
    setUpdating(taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(null);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => (
        <div key={col.status}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {col.label} · {tasks.filter((t) => t.status === col.status).length}
          </h3>
          <div className="flex flex-col gap-2">
            {tasks
              .filter((t) => t.status === col.status)
              .map((task) => (
                <Card key={task.id} className="text-sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{task.title}</p>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  {task.description && <p className="mb-2 text-xs text-slate-500">{task.description}</p>}
                  <select
                    value={task.status}
                    disabled={updating === task.id}
                    onChange={(e) => changeStatus(task.id, e.target.value as TaskStatus)}
                    className="min-h-[36px] w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.status} value={c.status}>
                        Move to {c.label}
                      </option>
                    ))}
                  </select>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
