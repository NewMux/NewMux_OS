"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Bell, BellOff, Calendar, CheckCircle2, RefreshCw, Server, Target } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { markRead, readDismissed, reconcile } from "@/lib/notifications/readState";
import {
  KIND_LABELS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type AppNotification,
  type NotificationKind,
  type NotificationSeverity,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<NotificationKind, typeof Bell> = {
  meeting: Calendar,
  task: CheckCircle2,
  renewal: RefreshCw,
  hosting: Server,
  follow_up: Target,
};

const SEVERITY_TONES: Record<NotificationSeverity, BadgeTone> = {
  overdue: "danger",
  today: "warning",
  upcoming: "info",
};

const fetcher = (url: string) =>
  fetch(url).then((res) => (res.ok ? res.json() : { notifications: [] }));

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const hydrated = useRef(false);

  const { data } = useSWR<{ notifications: AppNotification[] }>(
    "/api/notifications",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  const notifications = useMemo(() => data?.notifications ?? [], [data]);

  // localStorage is client-only, so the first render must match the server's
  // (nothing dismissed) and the real state lands on the first effect.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setDismissed(readDismissed());
  }, []);

  // Prune ids that have fallen out of the feed so the key cannot grow forever.
  useEffect(() => {
    if (!hydrated.current || notifications.length === 0) return;
    setDismissed((prev) => reconcile(prev, notifications.map((n) => n.id)));
  }, [notifications]);

  const unread = notifications.filter((n) => !dismissed.has(n.id));
  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: notifications.filter((n) => n.severity === severity),
  })).filter((group) => group.items.length > 0);

  function handleOpen(notification: AppNotification) {
    // Opening one marks that one read. There is deliberately no mark-all:
    // a missed renewal is expensive, so dismissing in bulk is not offered.
    setDismissed((prev) => markRead(notification.id, prev));
    setOpen(false);
    router.push(notification.href);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-label={
          unread.length > 0
            ? `Notifications, ${unread.length} unread`
            : "Notifications, none unread"
        }
        className="relative flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread.length > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-primary-foreground"
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 max-h-[70vh] w-[min(92vw,22rem)] animate-content-in overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-2 shadow-lg"
        >
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unread.length > 0 ? `${unread.length} unread` : "All caught up"}
            </p>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Nothing due. Meetings, tasks, renewals and hosting fees show up here.
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.severity} className="mb-2 last:mb-0">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {SEVERITY_LABELS[group.severity]}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((notification) => {
                    const Icon = KIND_ICONS[notification.kind];
                    const isUnread = !dismissed.has(notification.id);
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleOpen(notification)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          !isUnread && "opacity-60",
                        )}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                              {notification.title}
                            </span>
                            {isUnread && (
                              <span
                                aria-label="Unread"
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                              />
                            )}
                          </span>
                          {notification.body && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {notification.body}
                            </span>
                          )}
                        </span>
                        <Badge tone={SEVERITY_TONES[notification.severity]} className="shrink-0">
                          {KIND_LABELS[notification.kind]}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
