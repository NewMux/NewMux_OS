import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { listContacts } from "@/lib/data/crm";
import { listClients } from "@/lib/data/clients";
import { ContactsScreen } from "./ContactsScreen";

export const metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const [contacts, clients] = await Promise.all([listContacts(), listClients()]);
  return <ContactsScreen contacts={contacts} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />;
}
