import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listClients } from "@/lib/data/documents";
import { listProjects } from "@/lib/data/projects";
import { NewDocumentForm } from "./NewDocumentForm";

export default async function NewDocumentPage() {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/dashboard");

  const [clients, projects] = await Promise.all([
    listClients(),
    listProjects(),
  ]);
  return <NewDocumentForm clients={clients} projects={projects} />;
}
