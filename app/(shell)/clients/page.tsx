import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { listClientsWithStats } from "@/lib/data/clients";
import { ClientsScreen } from "./ClientsScreen";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  return <ClientsScreen clients={await listClientsWithStats()} />;
}
