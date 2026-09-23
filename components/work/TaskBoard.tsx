"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ListChecks, MessageCircle, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useMutation } from "@/lib/useMutation";
import { useOpenTask } from "./TaskRow";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/labels";
import { relativeDay, todayYmd } from "@/lib/time";
import { solidBg, text as textColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskWithMeta } from "@/lib/data/types";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

/** Kanban for one project. Drag with the mouse, or long-press on touch. */
export function TaskBoard({ tasks: initial, onAdd }: { tasks: TaskWithMeta[]; onAdd: (status: TaskStatus) => void }) {
  // Re-sync when the server sends fresh data (router.refresh after edits).
  const [tasks, setTasks] = useState(initial);
  useEffect(() => setTasks(initial), [initial]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { run } = useMutation();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, TaskWithMeta[]>(COLUMNS.map((c) => [c, []]));
    for (const t of tasks) m.get(t.status)!.push(t);
    return m;
  }, [tasks]);

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const task = tasks.find((t) => t.id === e.active.id);
    const status = e.over?.id as TaskStatus | undefined;
    if (!task || !status || task.status === status) return;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    navigator.vibrate?.(8);
    const orderedIds = [...byStatus.get(status)!.map((t) => t.id), task.id];
    const ok = await run(`/api/tasks/${task.id}/move`, { body: { status, orderedIds } });
    if (!ok) setTasks(initial);
  };

  const active = tasks.find((t) => t.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="no-scrollbar snap-x-mandatory -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8 xl:grid xl:grid-cols-4 xl:overflow-visible">
        {COLUMNS.map((status) => (
          <Column key={status} status={status} tasks={byStatus.get(status)!} onAdd={() => onAdd(status)} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.32,0.72,0,1)" }}>{active && <Card task={active} lifted />}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, onAdd }: { status: TaskStatus; tasks: TaskWithMeta[]; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = TASK_STATUS[status];
  return (
    <section
      ref={setNodeRef}
      className={cn("flex w-[82vw] max-w-[320px] shrink-0 snap-center flex-col rounded-card p-2 transition-colors xl:w-auto xl:max-w-none", isOver ? "bg-accent/10 ring-2 ring-accent/40" : "bg-fill/[0.08]")}
    >
      <header className="flex items-center gap-2 px-2 pb-2 pt-1">
        <span className={cn("h-2.5 w-2.5 rounded-full", solidBg[meta.color])} />
        <h3 className="text-headline">{meta.label}</h3>
        <span className="text-subhead text-label-2">{tasks.length}</span>
        <button type="button" onClick={onAdd} aria-label={`Add task to ${meta.label}`} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-accent hover:bg-fill/10">
          <Plus className="h-4 w-4" />
        </button>
      </header>
      <div className="flex min-h-[100px] flex-1 flex-col gap-2">
        {tasks.map((t) => (
          <Draggable key={t.id} task={t} />
        ))}
      </div>
    </section>
  );
}

function Draggable({ task }: { task: TaskWithMeta }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-30")}>
      <Card task={task} />
    </div>
  );
}

function Card({ task, lifted }: { task: TaskWithMeta; lifted?: boolean }) {
  const openTask = useOpenTask();
  const overdue = task.status !== "done" && task.dueAt && task.dueAt < todayYmd();
  const p = TASK_PRIORITY[task.priority];
  return (
    <button
      type="button"
      onClick={() => openTask(task.id)}
      className={cn("w-full rounded-[16px] bg-bg-elevated p-3 text-left", lifted && "rotate-[1.5deg] scale-[1.03] shadow-float")}
    >
      <div className={cn("text-body leading-snug", task.status === "done" && "text-label-2 line-through")}>
        {p.marks && <span className={cn("mr-1 font-semibold", textColor[p.color])}>{p.marks}</span>}
        {task.title}
      </div>
      <div className="mt-2 flex items-center gap-2.5 text-caption1 text-label-2">
        {task.dueAt && <span className={cn(overdue && "font-semibold text-ios-red")}>{relativeDay(task.dueAt)}</span>}
        {task.subtaskCount > 0 && (
          <span className="flex items-center gap-0.5">
            <ListChecks className="h-3 w-3" />
            {task.subtaskDoneCount}/{task.subtaskCount}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="flex items-center gap-0.5">
            <MessageCircle className="h-3 w-3" />
            {task.commentCount}
          </span>
        )}
        {task.assigneeName && <Avatar name={task.assigneeName} size={20} className="ml-auto" />}
      </div>
    </button>
  );
}
