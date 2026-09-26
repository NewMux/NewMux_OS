import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { COMPANY_LINKS, TABS, allLinksFor, forRole, sidebarFor } from "@/lib/nav";
import { TabBar } from "@/components/shell/TabBar";
import { Sidebar } from "@/components/shell/Sidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { RoleProvider } from "@/components/shell/QuickAdd";
import { TaskSheetHost } from "@/components/work/TaskSheetHost";
import { Suspense } from "react";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const sections = sidebarFor(role);
  const inSidebar = new Set(sections.flatMap((s) => [s.href, ...(s.children ?? []).map((c) => c.href)]));

  return (
    <RoleProvider role={role}>
    <div className="min-h-dvh">
      <Sidebar
        sections={sections}
        accountLinks={forRole(COMPANY_LINKS, role).filter((l) => !inSidebar.has(l.href))}
        userName={session.user.name ?? session.user.email ?? "You"}
        userRole={role}
      />
      <main className="min-h-dvh md:pl-[272px]">{children}</main>
      <TabBar tabs={forRole(TABS, role)} />
      <CommandPalette links={allLinksFor(role)} />
      <Suspense>
        <TaskSheetHost />
      </Suspense>
    </div>
    </RoleProvider>
  );
}
