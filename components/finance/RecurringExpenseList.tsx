"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { centsToDisplay } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { RecurringExpense, Client, Project } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";
import { ExpenseRowActions } from "./ExpenseRowActions";

export function RecurringExpenseList({
  expenses,
  clients,
  projects,
  narrowed = false,
}: {
  expenses: RecurringExpense[];
  clients: Client[];
  projects: Project[];
  /** True when search or a filter is active, so "none" means "no matches". */
  narrowed?: boolean;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleToggle(id: string) {
    setUpdating(id);
    await apiMutate(`/api/finance/recurring-expenses/${id}/toggle`, {
      method: "POST",
    });
    setUpdating(null);
    router.refresh();
  }

  if (expenses.length === 0) {
    return (
      <Card className="text-center text-sm text-muted-foreground">
        {narrowed
          ? "No expenses match these filters."
          : "No recurring expenses yet."}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {expenses.map((e) => {
        const client = e.linkedClientId
          ? clients.find((c) => c.id === e.linkedClientId)
          : null;
        const project = e.linkedProjectId
          ? projects.find((p) => p.id === e.linkedProjectId)
          : null;
        return (
          <Card key={e.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {e.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.category} · {e.cycle}
                  {client ? ` · ${client.name}` : ""}
                  {project ? ` · ${project.name}` : ""}
                  {!client && !project ? " · Company-wide" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.nextDueDate
                    ? `Next due: ${new Date(e.nextDueDate).toLocaleDateString()}`
                    : ""}
                  {e.lastPaymentDate
                    ? `${e.nextDueDate ? " · " : ""}Last paid: ${new Date(e.lastPaymentDate).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {centsToDisplay(e.amountCents, e.currency)}
                </span>
                <Badge
                  className={cn(
                    e.status === "active"
                      ? "bg-tone-success/20 text-tone-success-fg"
                      : "bg-tone-muted/20 text-tone-muted-fg",
                  )}
                >
                  {e.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={updating === e.id}
                  onClick={() => handleToggle(e.id)}
                >
                  {e.status === "active" ? "Pause" : "Resume"}
                </Button>
                <ExpenseRowActions expense={e} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
