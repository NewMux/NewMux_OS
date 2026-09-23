import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { getContactById, listActivities, listDeals } from "@/lib/data/crm";
import { listClients } from "@/lib/data/clients";
import { ContactDetail } from "./ContactDetail";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) notFound();
  const [activities, deals, clients] = await Promise.all([listActivities({ contactId: id }), listDeals({ contactId: id }), listClients()]);
  return <ContactDetail contact={contact} activities={activities} deals={deals} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />;
}
