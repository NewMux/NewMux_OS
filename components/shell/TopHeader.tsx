"use client";

import useSWR from "swr";
import { StatusDot } from "./StatusDot";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function TopHeader({ title }: { title: string }) {
  const { data } = useSWR<{ status: string }>("/api/health", fetcher, { refreshInterval: 30000 });
  const ok = data?.status === "ok";

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 safe-top backdrop-blur-md md:left-64 md:right-0">
      <h1 className="text-sm font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <StatusDot status={ok ? "ok" : "warn"} />
        <span className="hidden sm:inline">{ok ? "Operational" : "Checking…"}</span>
      </div>
    </header>
  );
}
