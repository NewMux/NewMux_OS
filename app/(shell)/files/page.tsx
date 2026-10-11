import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCompany, canSeeMoney } from "@/lib/rbac";
import { fileCategoriesFor, listFiles } from "@/lib/data/files";
import { listClients } from "@/lib/data/clients";
import { listProjects } from "@/lib/data/projects";
import { listVentures } from "@/lib/data/finance";
import { FilesScreen } from "./FilesScreen";

export const metadata = { title: "Files" };

export default async function FilesPage() {
  const session = await auth();
  if (!canAccessCompany(session)) redirect("/home");
  const categories = fileCategoriesFor(canSeeMoney(session));
  const [files, clients, projects, ventures] = await Promise.all([listFiles({ categories }), listClients(), listProjects(), listVentures()]);
  const opt = (x: { id: string; name: string }) => ({ id: x.id, name: x.name });
  return <FilesScreen files={files} categories={categories} clients={clients.map(opt)} projects={projects.map(opt)} ventures={ventures.map(opt)} />;
}
