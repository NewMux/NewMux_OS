"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { centsToDisplay } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { HostingSubscription, Client } from "@/lib/data/types";
import type { HostingAlertLevel } from "@/lib/data/hosting";

const ALERT_STYLES: Record<HostingAlertLevel, string> = {
  overdue: "bg-red-500/20 text-red-300",
  due_soon: "bg-amber-500/20 text-amber-300",
  upcoming: "bg-blue-500/20 text-blue-300",
  ok: "bg-slate-500/20 text-slate-300",
};

const ALERT_LABEL: Record<HostingAlertLevel, string> = {
  overdue: "Overdue",
  due_soon: "Due in ≤3 days",
  upcoming: "Due in ≤14 days",
  ok: "On track",
};

function alertLevel(sub: HostingSubscription): HostingAlertLevel {
  if (!sub.nextDueDate || sub.status === "paused") return "ok";
  const daysUntil = Math.ceil((new Date(sub.nextDueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "due_soon";
  if (daysUntil <= 14) return "upcoming";
  return "ok";
}

export function HostingList({ subscriptions, clients }: { subscriptions: HostingSubscription[]; clients: Client[] }) {
  const router = useRouter();
  const [collecting, setCollecting] = useState<string | null>(null);

  async function handleCollect(id: string) {
    setCollecting(id);
    await fetch(`/api/hosting/${id}/collect`, { method: "POST" });
    setCollecting(null);
    router.refresh();
  }

  if (subscriptions.length === 0) {
    return <Card className="text-center text-sm text-slate-500">No hosting subscriptions yet.</Card>;
  }

  return (
    <div className="flex flex-col gap-2">
      {subscriptions.map((sub) => {
        const client = clients.find((c) => c.id === sub.clientId);
        const level = alertLevel(sub);
        return (
          <Card key={sub.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {client?.name ?? "Unknown client"} · <span className="capitalize text-slate-400">{sub.item}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {centsToDisplay(sub.amountCents, sub.currency)} / {sub.cycle}
                  {sub.nextDueDate ? ` · Next due: ${new Date(sub.nextDueDate).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={cn(ALERT_STYLES[level])}>{ALERT_LABEL[level]}</Badge>
                <Button size="sm" disabled={collecting === sub.id} onClick={() => handleCollect(sub.id)}>
                  {collecting === sub.id ? "Recording…" : "Collected"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
