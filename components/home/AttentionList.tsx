"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, CalendarClock, ChevronRight, FileWarning, MessageSquareReply, Server } from "lucide-react";
import { ListSection, IconTile } from "@/components/ui/List";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { CollectSheet } from "@/components/hosting/HostingSheet";
import { useMutation } from "@/lib/useMutation";
import { amountOrTbd } from "@/lib/money";
import { formatDate, relativeDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AttentionItem, AttentionKind } from "@/lib/data/attention";
import type { BankAccount } from "@/lib/data/types";

const GROUPS: { kinds: AttentionKind[]; header: string }[] = [
  { kinds: ["hosting"], header: "Hosting fees to collect" },
  { kinds: ["renewal", "file"], header: "Renewals & expiring files" },
  { kinds: ["follow_up"], header: "Follow-ups" },
];

const ICON = { hosting: Server, renewal: CalendarClock, file: FileWarning, follow_up: MessageSquareReply } as const;

function when(item: AttentionItem) {
  if (item.kind === "follow_up") return item.overdue ? `Overdue since ${formatDate(item.date, { day: "numeric", month: "short" })}` : "Due today";
  if (item.overdue) return `${item.kind === "hosting" ? "Overdue since" : "Expired"} ${formatDate(item.date, { day: "numeric", month: "short" })}`;
  return `${item.kind === "hosting" ? "Due" : item.kind === "file" ? "Expires" : "Renews"} ${relativeDay(item.date)}`;
}

/**
 * Needs Attention (item 26): grouped by type with an icon each, red when
 * overdue, and the action that clears it — Collect, Renewed, Done — plus
 * Snooze.
 */
export function AttentionList({ items, accounts, canAct }: { items: AttentionItem[]; accounts: BankAccount[]; canAct: boolean }) {
  const { run, pending } = useMutation();
  const [collecting, setCollecting] = useState<AttentionItem | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !hidden.has(i.key));
  const hide = (key: string) => setHidden((s) => new Set(s).add(key));

  const snooze = async (key: string, days: number) => {
    hide(key);
    await run("/api/attention", { body: { action: "snooze", key, days }, success: days === 1 ? "Snoozed until tomorrow" : `Snoozed for ${days} days` });
  };

  const primary = (item: AttentionItem) => {
    if (!canAct) return null;
    const variant = item.overdue ? "destructive-tinted" : "tinted";
    if (item.kind === "hosting" && item.hosting)
      return (
        <Button size="sm" variant={variant} disabled={pending} onClick={() => setCollecting(item)}>
          Collect
        </Button>
      );
    if (item.kind === "renewal")
      return (
        <Button
          size="sm"
          variant={variant}
          disabled={pending}
          onClick={async () => {
            hide(item.key);
            await run("/api/attention", { body: { action: "renewed", key: item.key }, success: "Renewal date moved on a year" });
          }}
        >
          Renewed
        </Button>
      );
    if (item.kind === "follow_up" && item.activityId)
      return (
        <Button
          size="sm"
          variant={variant}
          disabled={pending}
          onClick={async () => {
            hide(item.key);
            await run(`/api/activities/${item.activityId}`, { method: "PATCH", body: { completed: true }, success: "Follow-up done" });
          }}
        >
          Done
        </Button>
      );
    return (
      <Link href={item.href} className={cn("press inline-flex h-8 items-center rounded-full px-3.5 text-subhead font-semibold", item.overdue ? "bg-ios-red/15 text-ios-red" : "bg-accent/15 text-accent")}>
        Update
      </Link>
    );
  };

  if (visible.length === 0) return null;
  return (
    <ListSection variant="prominent" header="Needs Attention">
      {GROUPS.map((g) => {
        const group = visible.filter((i) => g.kinds.includes(i.kind));
        if (!group.length) return null;
        return (
          <div key={g.header} className="[&:not(:first-child)]:shadow-[inset_0_0.5px_0_rgb(var(--separator))]">
            <div className="px-4 pb-1 pt-2.5 text-footnote font-semibold uppercase tracking-[0.03em] text-label-2">{g.header}</div>
            {group.map((item) => {
              const Icon = ICON[item.kind];
              return (
                <div key={item.key} className="flex items-center gap-3 pl-4 [&:last-child_.row-sep]:shadow-none">
                  <IconTile icon={Icon} color={item.overdue ? "red" : item.kind === "follow_up" ? "blue" : "orange"} size="sm" />
                  <div className="row-sep flex min-h-[52px] min-w-0 flex-1 items-center gap-2 py-2 pr-3 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
                    <Link href={item.href} className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-body">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-subhead">
                        <span className={item.overdue ? "font-medium text-ios-red" : "text-label-2"}>{when(item)}</span>
                        {item.hosting && <span className="text-label-2"> · {amountOrTbd(item.hosting.amountCents, item.hosting.currency)}</span>}
                        {item.detail && <span className="text-label-2"> · {item.detail}</span>}
                      </span>
                    </Link>
                    {primary(item)}
                    {canAct ? (
                      <Menu
                        label="Snooze"
                        items={[
                          { label: "Snooze until tomorrow", icon: BellOff, onSelect: () => snooze(item.key, 1) },
                          { label: "Snooze for a week", icon: BellOff, onSelect: () => snooze(item.key, 7) },
                          { label: "Snooze for a month", icon: BellOff, onSelect: () => snooze(item.key, 30) },
                        ]}
                        trigger={
                          <button type="button" aria-label="Snooze" className="press flex h-8 w-8 items-center justify-center rounded-full text-label-2 hover:bg-fill/[0.1]">
                            <BellOff className="h-4 w-4" />
                          </button>
                        }
                      />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-label-3" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {collecting?.hosting && (
        <CollectSheet
          sub={collecting.hosting}
          open={!!collecting}
          onOpenChange={(o) => {
            if (!o) setCollecting(null);
          }}
          accounts={accounts}
        />
      )}
    </ListSection>
  );
}
