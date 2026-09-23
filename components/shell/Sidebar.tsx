"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, type NavLink } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { Avatar } from "@/components/ui/Avatar";
import { Menu } from "@/components/ui/Menu";
import { useRouter } from "next/navigation";

/** Mail/Notes-style source list for iPad and desktop. */
export function Sidebar({
  sections,
  userName,
  userRole,
}: {
  sections: { title?: string; items: NavLink[] }[];
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const all = sections.flatMap((s) => s.items);

  return (
    <aside className="material fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r-[0.5px] border-separator md:flex">
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#1c1c1e] to-[#3a3a3c] font-rounded text-[13px] font-bold text-white shadow-widget dark:from-white dark:to-[#d1d1d6] dark:text-black">
          N
        </span>
        <div className="min-w-0">
          <div className="text-headline leading-tight">NEWMUX</div>
          <div className="text-caption1 text-label-2">Operating System</div>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="ml-auto flex items-center gap-0.5 rounded-md bg-fill/[0.12] px-1.5 py-1 text-caption2 text-label-2 hover:bg-fill/20"
          aria-label="Open command palette"
        >
          <Command className="h-3 w-3" />K
        </button>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className="mt-3 first:mt-1">
            {section.title && <div className="mb-1 px-2 text-caption1 font-semibold text-label-2">{section.title}</div>}
            {section.items.map((item) => {
              const active = isActive(pathname, item, all);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-lg px-2 text-body transition-colors",
                    active ? "bg-fill/[0.18] font-medium text-label" : "text-label hover:bg-fill/[0.08]",
                  )}
                >
                  <NavIcon icon={item.icon} className="h-[17px] w-[17px] text-accent" strokeWidth={1.9} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="hairline-t px-3 py-3">
        <Menu
          align="start"
          items={[
            { label: "Settings", onSelect: () => router.push("/settings") },
            "separator",
            { label: "Sign Out", icon: LogOut, destructive: true, onSelect: () => signOut({ callbackUrl: "/login" }) },
          ]}
          trigger={
            <button type="button" className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-fill/[0.08]">
              <Avatar name={userName} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-subhead font-medium">{userName}</span>
                <span className="block text-caption1 text-label-2">{userRole === "partner_admin" ? "Partner · Admin" : "Team member"}</span>
              </span>
            </button>
          }
        />
      </div>
    </aside>
  );
}
