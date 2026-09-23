"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Command, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, type NavLink, type NavSection } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { Avatar } from "@/components/ui/Avatar";
import { Menu } from "@/components/ui/Menu";

/**
 * Mail/Notes-style source list for iPad and desktop: five sections, and only
 * the one you're in shows its pages.
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
    <aside className="material fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r-[0.5px] border-separator md:flex">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-label font-rounded text-[13px] font-bold text-bg">N</span>
        <span className="text-headline">NEWMUX</span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="ml-auto flex items-center gap-0.5 rounded-md bg-fill/[0.12] px-1.5 py-1 text-caption2 text-label-2 hover:bg-fill/20"
          aria-label="Search everything"
          title="Search everything"
        >
          <Command className="h-3 w-3" />K
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

      <div className="hairline-t px-3 py-3">
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
