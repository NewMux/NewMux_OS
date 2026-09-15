"use client";

import useSWR from "swr";
import { StatusDot } from "./StatusDot";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function TopHeader({ title }: { title: string }) {
  const { data } = useSWR<{ status: string }>("/api/health", fetcher, {
    refreshInterval: 30000,
  });
  const ok = data?.status === "ok";

  return (
    <header className="safe-top fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-popover/90 px-4 backdrop-blur-md md:left-64 md:right-0">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <ThemeToggle />
        <span className="flex items-center gap-2">
          <StatusDot status={ok ? "ok" : "warn"} />
          <span className="hidden sm:inline">
            {ok ? "Operational" : "Checking…"}
          </span>
        </span>
      </div>
    </header>
  );
}
