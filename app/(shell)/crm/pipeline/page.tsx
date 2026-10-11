import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm, canSeeMoney } from "@/lib/rbac";
import { getPipelineSummary, listContacts, listDeals, openPipelineTotals, withoutValue } from "@/lib/data/crm";
import { listClients } from "@/lib/data/clients";
import { listUsers } from "@/lib/data/users";
import { listCampaigns } from "@/lib/data/campaigns";
import { PipelineScreen } from "./PipelineScreen";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const [deals, clients, contacts, users, summary, campaigns] = await Promise.all([listDeals(), listClients(), listContacts(), listUsers(), getPipelineSummary(), listCampaigns()]);
  const money = canSeeMoney(session);
  const totals = openPipelineTotals(summary);
  return (
    <PipelineScreen
      deals={money ? deals : deals.map(withoutValue)}
      totals={money ? totals : { ...totals, totalBhdCents: 0, weightedBhdCents: 0 }}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      contacts={contacts.map((c) => ({ id: c.id, name: c.fullName, clientId: c.clientId }))}
      users={users.map((u) => ({ id: u.id, name: u.fullName }))}
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
