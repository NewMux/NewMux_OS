"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus } from "lucide-react";
import type { Project, Meeting } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";

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
    await apiMutate("/api/meetings", {
      method: "POST",
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New meeting
        </Button>
      </DialogTrigger>
      <DialogContent title="New meeting">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
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
            onChange={(e) =>
              setRecurring(e.target.value as Meeting["recurring"])
            }
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
      </DialogContent>
    </Dialog>
  );
}
