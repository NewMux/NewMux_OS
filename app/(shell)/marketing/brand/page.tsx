import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessMarketing } from "@/lib/rbac";
import { listFiles } from "@/lib/data/files";
import { listPagesInSpace, listSpaces } from "@/lib/data/kb";
import { listClients } from "@/lib/data/clients";
import { listProjects } from "@/lib/data/projects";
import { listVentures } from "@/lib/data/finance";
import { BrandScreen } from "./BrandScreen";

export const metadata = { title: "Brand & Assets" };

export default async function BrandPage() {
  const session = await auth();
  if (!canAccessMarketing(session)) redirect("/home");
  const [files, spaces, clients, projects, ventures] = await Promise.all([listFiles({ categories: ["brand", "marketing"] }), listSpaces(), listClients(), listProjects(), listVentures()]);
  // The brand guide lives in the wiki: a space named Brand (or Marketing).
  const space = spaces.find((s) => /^brand/i.test(s.name)) ?? spaces.find((s) => /^marketing/i.test(s.name)) ?? null;
  const pages = space ? (await listPagesInSpace(space.id)).filter((p) => !p.isTemplate) : [];
  const opt = (x: { id: string; name: string }) => ({ id: x.id, name: x.name });
  return <BrandScreen files={files} space={space} pages={pages} clients={clients.map(opt)} projects={projects.map(opt)} ventures={ventures.map(opt)} />;
}
