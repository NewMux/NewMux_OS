import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SIDEBAR, TABS, forRole } from "@/lib/nav";
import { TabBar } from "@/components/shell/TabBar";
import { Sidebar } from "@/components/shell/Sidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { TaskSheetHost } from "@/components/work/TaskSheetHost";
import { Suspense } from "react";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const sections = SIDEBAR.map((s) => ({ ...s, items: forRole(s.items, role) })).filter((s) => s.items.length > 0);

  return (
    <div className="min-h-dvh">
      <Sidebar sections={sections} userName={session.user.name ?? session.user.email ?? "You"} userRole={role} />
      <main className="min-h-dvh md:pl-64">{children}</main>
      <TabBar tabs={forRole(TABS, role)} />
      <CommandPalette links={sections.flatMap((s) => s.items)} />
      <Suspense>
        <TaskSheetHost />
      </Suspense>
    </div>
  );
}
