"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";
import type { TaskPriority } from "@/lib/data/types";

export function NewTaskButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title, priority }),
    });
    setSaving(false);
    setTitle("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New task
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-white">New task</Dialog.Title>
            <Dialog.Close className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              placeholder="Task title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="min-h-[44px] rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? "Creating…" : "Create task"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
