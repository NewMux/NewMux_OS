"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NavIcon } from "./NavIcon";
import { StatusDot } from "./StatusDot";
import type { NavItem } from "@/lib/nav";
import { LogOut } from "lucide-react";

export function Sidebar({
  items,
  userName,
  userRole,
}: {
  items: NavItem[];
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-white/10 bg-slate-950 md:flex">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="h-8 w-8 rounded-lg bg-emerald-600" aria-hidden />
        <span className="text-sm font-semibold text-white">NEWMUX OS</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-emerald-600/15 text-emerald-400" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100",
              )}
            >
              <NavIcon icon={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <StatusDot status="ok" />
          All systems operational
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-100">{userName}</p>
            <p className="text-xs capitalize text-slate-500">{userRole.replace("_", " ")}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-900 hover:text-slate-100"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
