"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, X } from "lucide-react";
import type { Project, Meeting } from "@/lib/data/types";

export function AddMeetingModal({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [projectId, setProjectId] = useState("");
  const [recurring, setRecurring] = useState<Meeting["recurring"]>("none");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const project = projects.find((p) => p.id === projectId);
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        startsAt: new Date(startsAt).toISOString(),
        linkedProjectId: project?.id ?? null,
        linkedClientId: project?.clientId ?? null,
        recurring,
      }),
    });
    setSaving(false);
    setTitle("");
    setStartsAt("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New meeting
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-4">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-foreground">New meeting</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="">No linked project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value as Meeting["recurring"])}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="none">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <Button type="submit" disabled={saving || !title || !startsAt}>
              {saving ? "Saving…" : "Add meeting"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
