import { redirect } from "next/navigation";
import { Contact } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { listContacts } from "@/lib/data/crm";
import { listClients } from "@/lib/data/clients";
import { SplitView } from "@/components/shell/SplitView";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContactsScreen } from "./ContactsScreen";

/** Contacts list beside the selected contact on iPad/Mac. */
export default async function ContactsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const [contacts, clients] = await Promise.all([listContacts(), listClients()]);
  return (
    <SplitView
      list={<ContactsScreen contacts={contacts} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />}
      placeholder={<EmptyState icon={Contact} title="No contact selected" message="Choose someone to call, message or follow up with." />}
    >
      {children}
    </SplitView>
  );
}
