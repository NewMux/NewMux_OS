"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { centsToDisplay } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { RecurringExpense, Client, Project } from "@/lib/data/types";

export function RecurringExpenseList({
  expenses,
  clients,
  projects,
}: {
  expenses: RecurringExpense[];
  clients: Client[];
  projects: Project[];
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleToggle(id: string) {
    setUpdating(id);
    await fetch(`/api/finance/recurring-expenses/${id}/toggle`, { method: "POST" });
    setUpdating(null);
    router.refresh();
  }

  if (expenses.length === 0) {
    return <Card className="text-center text-sm text-slate-500">No recurring expenses yet.</Card>;
  }

  return (
    <div className="flex flex-col gap-2">
      {expenses.map((e) => {
        const client = e.linkedClientId ? clients.find((c) => c.id === e.linkedClientId) : null;
        const project = e.linkedProjectId ? projects.find((p) => p.id === e.linkedProjectId) : null;
        return (
          <Card key={e.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{e.name}</p>
                <p className="text-xs text-slate-500">
                  {e.category} · {e.cycle}
                  {client ? ` · ${client.name}` : ""}
                  {project ? ` · ${project.name}` : ""}
                  {!client && !project ? " · Company-wide" : ""}
                </p>
                {e.nextDueDate && (
                  <p className="text-xs text-slate-500">Next due: {new Date(e.nextDueDate).toLocaleDateString()}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{centsToDisplay(e.amountCents, e.currency)}</span>
                <Badge className={cn(e.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-500/20 text-zinc-400")}>
                  {e.status}
                </Badge>
                <Button variant="ghost" size="sm" disabled={updating === e.id} onClick={() => handleToggle(e.id)}>
                  {e.status === "active" ? "Pause" : "Resume"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
