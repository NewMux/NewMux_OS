"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, type NavLink, type NavSection } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { Avatar } from "@/components/ui/Avatar";
import { Menu } from "@/components/ui/Menu";
import { QuickAddMenu } from "./QuickAdd";
import type { UserRole } from "@/lib/data/types";

/**
 * Mail/Notes-style source list for iPad and desktop, as a floating Liquid
 * Glass pane (iPadOS 26): five sections, and only the one you're in shows its pages.
 */
export function Sidebar({
  sections,
  accountLinks,
  userName,
  userRole,
}: {
  sections: NavSection[];
  accountLinks: NavLink[];
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="glass fixed bottom-2 left-2 top-2 z-40 hidden w-64 flex-col rounded-card md:flex">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <Image src="/icons/icon.svg" alt="" width={32} height={32} unoptimized className="rounded-[22.5%]" />
        <span className="text-headline">NEWMUX</span>
        {/* Item 24: one "+" that's always here, whatever the page. */}
        <QuickAddMenu role={userRole as UserRole} persistent className="ml-auto h-9 min-w-9 px-2" />
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="flex h-9 w-full items-center gap-2 rounded-[10px] bg-fill/[0.12] px-2.5 text-subhead text-label-2 hover:bg-fill/20"
          aria-label="Search everything (Command K)"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-[5px] bg-bg-elevated/70 px-1.5 py-0.5 font-sans text-caption2 font-semibold text-label-2 shadow-[0_0.5px_0_rgb(0_0_0/0.15)]">⌘K</kbd>
        </button>
      </div>

      <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {sections.map((section) => {
          const children = section.children ?? [];
          const inSection = isActive(pathname, section) || children.some((c) => isActive(pathname, c, children));
          const expanded = inSection && children.length > 0;
          return (
            <div key={section.href}>
              <Link
                href={section.href}
                aria-current={inSection && !expanded ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2 text-body transition-colors",
                  inSection && !expanded ? "bg-fill/[0.16] font-medium" : "hover:bg-fill/[0.08]",
                  expanded && "font-medium",
                )}
              >
                <NavIcon icon={section.icon} className={cn("h-[18px] w-[18px]", inSection ? "text-accent" : "text-label-2")} strokeWidth={1.9} />
                {section.label}
              </Link>
              {expanded && (
                <div className="mb-1 mt-0.5 space-y-0.5">
                  {children.map((item) => {
                    const active = isActive(pathname, item, children);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-8 items-center rounded-lg pl-[38px] pr-2 text-subhead transition-colors",
                          active ? "bg-fill/[0.16] font-medium text-label" : "text-label-2 hover:bg-fill/[0.08] hover:text-label",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mx-3 border-t-[0.5px] border-separator py-3">
        <Menu
          align="start"
          items={[
            ...accountLinks.map((l) => ({ label: l.label, onSelect: () => router.push(l.href) })),
            ...(accountLinks.length ? (["separator"] as const) : []),
            { label: "Settings", icon: Settings, onSelect: () => router.push("/settings") },
            { label: "Sign Out", icon: LogOut, destructive: true, onSelect: () => signOut({ callbackUrl: "/login" }) },
          ]}
          trigger={
            <button type="button" className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-fill/[0.08]">
              <Avatar name={userName} size={30} />
              <span className="min-w-0">
                <span className="block truncate text-subhead font-medium">{userName}</span>
                <span className="block text-caption1 text-label-2">{userRole === "partner_admin" ? "Partner" : "Team member"}</span>
              </span>
            </button>
          }
        />
      </div>
    </aside>
  );
}
