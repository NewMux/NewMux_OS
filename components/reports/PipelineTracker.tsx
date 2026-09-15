"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { PipelineItem } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";

export function PipelineTracker({ items }: { items: PipelineItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggle(id: string) {
    setToggling(id);
    await apiMutate(`/api/pipeline/${id}/toggle`, { method: "POST" });
    setToggling(null);
    router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiMutate("/api/pipeline", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    setName("");
    router.refresh();
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Business Development Pipeline</CardTitle>
      </CardHeader>
      <div className="mb-3 flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleToggle(item.id)}
            disabled={toggling === item.id}
            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-left text-sm hover:border-primary/40"
          >
            <span className="text-foreground">{item.name}</span>
            <Badge
              className={cn(
                item.stage === "complete"
                  ? "bg-tone-success/20 text-tone-success-fg"
                  : "bg-tone-warning/20 text-tone-warning-fg",
              )}
            >
              {item.stage === "complete" ? "Complete" : "In progress"}
            </Badge>
          </button>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input
          placeholder="New pipeline item"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
          required
        />
        <Button type="submit" size="sm" disabled={saving || !name}>
          Add
        </Button>
      </form>
    </Card>
  );
}
