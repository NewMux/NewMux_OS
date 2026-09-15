import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listClients } from "@/lib/data/documents";
import { NewDocumentForm } from "./NewDocumentForm";

export default async function NewDocumentPage() {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/dashboard");

  const clients = await listClients();
  return <NewDocumentForm clients={clients} />;
}
