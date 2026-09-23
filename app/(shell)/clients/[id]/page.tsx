import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { getClientById, listClients } from "@/lib/data/clients";
import { listActivities, listContacts, listDeals } from "@/lib/data/crm";
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
  const [contacts, deals, projects, documents, hosting, activities, pages, clients, allContacts, users, expenses] = await Promise.all([
    listContacts({ clientId: id }),
    listDeals({ clientId: id }),
    listProjectsWithStats({ clientId: id, includeArchived: true }),
    listDocuments({ clientId: id }),
    listHostingSubscriptionsForClient(id),
    listActivities({ clientId: id }),
    listLinkedPages({ clientId: id }),
    listClients(),
    listContacts(),
    listUsers(),
    listExpenses({ clientId: id }),
  ]);
  return (
    <ClientDetail
      client={client}
      contacts={contacts}
      deals={deals}
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
      }}
    />
  );
}
