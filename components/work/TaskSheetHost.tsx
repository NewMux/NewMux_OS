"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Trash2, Plus, ArrowUp } from "lucide-react";
import { Sheet, SheetIconButton } from "@/components/ui/Sheet";
import { FieldRow, ListSection, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { CheckCircle } from "@/components/ui/Toggle";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/Confirm";
import { useMutation } from "@/lib/useMutation";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/labels";
import { timeAgo } from "@/lib/time";
import type { Subtask, TaskComment, TaskPriority, TaskStatus, TaskWithMeta } from "@/lib/data/types";

type Detail = { task: TaskWithMeta; subtasks: Subtask[]; comments: TaskComment[] };

/**
 * The task detail sheet, available on every screen: any link with
 * ?task=<id> opens it. Edits save as you go, like Reminders.
 */
export function TaskSheetHost() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const taskId = params.get("task");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [users, setUsers] = useState<{ id: string; fullName: string }[]>([]);
  const { run } = useMutation();
  const confirm = useConfirm();

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`);
    if (res.ok) setDetail((await res.json()) as Detail);
  }, []);

  useEffect(() => {
    setDetail(null);
    if (taskId) void load(taskId);
  }, [taskId, load]);

  useEffect(() => {
    if (taskId && users.length === 0) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((d: { users?: { id: string; fullName: string }[] }) => setUsers(d.users ?? []))
        .catch(() => {});
    }
  }, [taskId, users.length]);

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!detail) return;
    setDetail({ ...detail, task: { ...detail.task, ...body } as TaskWithMeta });
    await run(`/api/tasks/${detail.task.id}`, { method: "PATCH", body });
  };

  const remove = async () => {
    if (!detail) return;
    const ok = await confirm({ title: `Delete “${detail.task.title}”?`, message: "Subtasks and comments are deleted too.", destructive: true, confirmLabel: "Delete Task" });
    if (!ok) return;
    if (await run(`/api/tasks/${detail.task.id}`, { method: "DELETE", success: "Task deleted" })) close();
  };

  return (
    <Sheet
      open={!!taskId}
      onOpenChange={(o) => !o && close()}
      title={detail?.task.projectName ?? "Task"}
      right={<SheetIconButton kind="confirm" label="Done" onClick={close} />}
    >
      {!detail ? (
        <div className="space-y-3 pt-2">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-44 rounded-card" />
        </div>
      ) : (
        <TaskEditor key={detail.task.id} detail={detail} users={users} onPatch={patch} onReload={() => load(detail.task.id)} onDelete={remove} />
      )}
    </Sheet>
  );
}

function TaskEditor({
  detail,
  users,
  onPatch,
  onReload,
  onDelete,
}: {
  detail: Detail;
  users: { id: string; fullName: string }[];
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
  onDelete: () => void;
}) {
  const { task } = detail;
  const { run } = useMutation();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.description ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  const [comment, setComment] = useState("");
  const subtaskInput = useRef<HTMLInputElement>(null);

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) void onPatch({ title: t });
    else setTitle(task.title);
  };
  const saveNotes = () => {
    if (notes !== (task.description ?? "")) void onPatch({ description: notes });
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = newSubtask.trim();
    if (!t) return;
    setNewSubtask("");
    if (await run(`/api/tasks/${task.id}/subtasks`, { body: { title: t } })) await onReload();
    subtaskInput.current?.focus();
  };

  const toggleSubtask = async (s: Subtask, done: boolean) => {
    if (await run(`/api/subtasks/${s.id}`, { method: "PATCH", body: { done } })) await onReload();
  };

  const deleteSubtask = async (s: Subtask) => {
    if (await run(`/api/subtasks/${s.id}`, { method: "DELETE" })) await onReload();
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = comment.trim();
    if (!b) return;
    setComment("");
    if (await run(`/api/tasks/${task.id}/comments`, { body: { body: b } })) await onReload();
  };

  return (
    <div className="pt-2">
      <ListSection>
        <div className="px-4 pt-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Title"
            className="w-full bg-transparent text-title3 font-semibold focus:outline-none"
          />
        </div>
        <div className="px-4 pb-3 pt-1">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Notes" rows={3} className="text-body text-label-2" />
        </div>
      </ListSection>

      <ListSection>
        <FieldRow label="Status">
          <Select value={task.status} onChange={(e) => onPatch({ status: e.target.value as TaskStatus })}>
            {Object.entries(TASK_STATUS).map(([v, m]) => (
              <option key={v} value={v}>
                {m.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Priority">
          <Select value={task.priority} onChange={(e) => onPatch({ priority: e.target.value as TaskPriority })}>
            {Object.entries(TASK_PRIORITY).map(([v, m]) => (
              <option key={v} value={v}>
                {m.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Due">
          <RowInput type="date" value={task.dueAt ?? ""} onChange={(e) => onPatch({ dueAt: e.target.value || null })} className="text-label-2" />
        </FieldRow>
        <FieldRow label="Assignee">
          <Select value={task.assigneeId ?? ""} onChange={(e) => onPatch({ assigneeId: e.target.value || null })}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>

      <ListSection header={`Subtasks${detail.subtasks.length ? ` · ${detail.subtasks.filter((s) => s.done).length}/${detail.subtasks.length}` : ""}`}>
        {detail.subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-3 pl-4 [&:last-child_.row-sep]:shadow-none">
            <CheckCircle checked={s.done} onChange={(v) => toggleSubtask(s, v)} label={s.title} size={20} />
            <span className="row-sep flex min-h-[44px] flex-1 items-center justify-between gap-2 pr-3 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
              <span className={s.done ? "text-label-2 line-through" : ""}>{s.title}</span>
              <button type="button" aria-label="Delete subtask" onClick={() => deleteSubtask(s)} className="p-2 text-label-3 hover:text-ios-red">
                <Trash2 className="h-4 w-4" />
              </button>
            </span>
          </div>
        ))}
        <form onSubmit={addSubtask} className="flex items-center gap-3 pl-4">
          <Plus className="h-5 w-5 text-accent" />
          <input
            ref={subtaskInput}
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            placeholder="Add Subtask"
            enterKeyHint="done"
            className="min-h-[44px] flex-1 bg-transparent pr-4 placeholder:text-accent focus:outline-none focus:placeholder:text-label-3"
          />
        </form>
      </ListSection>

      <ListSection header="Comments">
        {detail.comments.map((c) => (
          <div key={c.id} className="flex gap-3 px-4 py-3 hairline-b last:shadow-none">
            <Avatar name={c.authorName ?? "?"} size={30} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-subhead font-semibold">{c.authorName ?? "Former user"}</span>
                <span className="text-caption1 text-label-2">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-body">{c.body}</p>
            </div>
          </div>
        ))}
        <form onSubmit={addComment} className="flex items-center gap-2 px-3 py-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment"
            className="h-9 flex-1 rounded-full bg-fill/[0.12] px-4 placeholder:text-label-3 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!comment.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white disabled:bg-fill/30"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </form>
      </ListSection>

      <ListSection>
        <button type="button" onClick={onDelete} className="flex min-h-[44px] w-full items-center justify-center text-body text-ios-red active:bg-fill/20">
          Delete Task
        </button>
      </ListSection>
    </div>
  );
}
