import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { navItemsForRole } from "@/lib/nav";
import { BottomNav } from "@/components/shell/BottomNav";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopHeader } from "@/components/shell/TopHeader";
import { QuickActionDrawer } from "@/components/shell/QuickActionDrawer";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const items = navItemsForRole(session.user.role);

  return (
    <div className="min-h-screen">
      <Sidebar
        items={items}
        userName={session.user.name ?? session.user.email ?? "User"}
        userRole={session.user.role}
      />
      <TopHeader title="NEWMUX OS" />
      <main className="min-h-screen px-4 pb-24 pt-20 md:ml-64 md:px-8 md:pb-10">
        {children}
      </main>
      <BottomNav items={items} />
      <QuickActionDrawer />
    </div>
  );
}
