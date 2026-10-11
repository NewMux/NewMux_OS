import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm, canSeeMoney } from "@/lib/rbac";
import { getClientById, listClients } from "@/lib/data/clients";
import { listActivities, listContacts, listDeals, withoutValue } from "@/lib/data/crm";
import { listCampaigns } from "@/lib/data/campaigns";
import { listProjectsWithStats } from "@/lib/data/projects";
import { listDocuments } from "@/lib/data/documents";
import { listHostingSubscriptionsForClient } from "@/lib/data/hosting";
import { listLinkedPages } from "@/lib/data/kb";
import { listUsers } from "@/lib/data/users";
import { listExpenses } from "@/lib/data/expenses";
import { ClientDetail } from "./ClientDetail";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();
  // Documents, hosting fees, expenses and deal values are partners only.
  const money = canSeeMoney(session);
  const [contacts, deals, projects, documents, hosting, activities, pages, clients, allContacts, users, expenses, campaigns] = await Promise.all([
    listContacts({ clientId: id }),
    listDeals({ clientId: id }),
    listProjectsWithStats({ clientId: id, includeArchived: true }),
    money ? listDocuments({ clientId: id }) : Promise.resolve([]),
    money ? listHostingSubscriptionsForClient(id) : Promise.resolve([]),
    listActivities({ clientId: id }),
    listLinkedPages({ clientId: id }),
    listClients(),
    listContacts(),
    listUsers(),
    money ? listExpenses({ clientId: id }) : Promise.resolve([]),
    listCampaigns(),
  ]);
  return (
    <ClientDetail
      client={client}
      contacts={contacts}
      deals={money ? deals : deals.map(withoutValue)}
      projects={projects}
      documents={documents}
      hosting={hosting}
      activities={activities}
      pages={pages}
      expenses={expenses}
      options={{
        clients: clients.map((c) => ({ id: c.id, name: c.name })),
        contacts: allContacts.map((c) => ({ id: c.id, name: c.fullName, clientId: c.clientId })),
        users: users.map((u) => ({ id: u.id, name: u.fullName })),
        campaigns: campaigns.map((c) => ({ id: c.id, name: c.name })),
      }}
    />
  );
}
