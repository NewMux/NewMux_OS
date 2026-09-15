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
    <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-border bg-popover md:flex">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="h-8 w-8 rounded-lg bg-primary" aria-hidden />
        <span className="text-sm font-semibold text-foreground">NEWMUX OS</span>
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
                active
                  ? "bg-primary/15 text-brand"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <NavIcon icon={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <StatusDot status="ok" />
          All systems operational
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {userRole.replace("_", " ")}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
