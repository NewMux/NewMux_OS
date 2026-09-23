import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { getPipelineSummary, listContacts, listDeals, openPipelineTotals } from "@/lib/data/crm";
import { listClients } from "@/lib/data/clients";
import { listUsers } from "@/lib/data/users";
import { PipelineScreen } from "./PipelineScreen";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const [deals, clients, contacts, users, summary] = await Promise.all([listDeals(), listClients(), listContacts(), listUsers(), getPipelineSummary()]);
  const totals = openPipelineTotals(summary);
  return (
    <PipelineScreen
      deals={deals}
      totals={totals}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      contacts={contacts.map((c) => ({ id: c.id, name: c.fullName, clientId: c.clientId }))}
      users={users.map((u) => ({ id: u.id, name: u.fullName }))}
    />
  );
}
