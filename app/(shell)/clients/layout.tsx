import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { listClientsWithStats } from "@/lib/data/clients";
import { SplitView } from "@/components/shell/SplitView";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientsScreen } from "./ClientsScreen";

/** Clients list beside the selected client on iPad/Mac. */
export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  return (
    <SplitView list={<ClientsScreen clients={await listClientsWithStats()} />} placeholder={<EmptyState icon={Building2} title="No client selected" message="Choose a client to see their people, deals, work and money." />}>
      {children}
    </SplitView>
  );
}
