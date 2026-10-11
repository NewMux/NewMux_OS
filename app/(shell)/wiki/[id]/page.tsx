import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { getPageAncestors, getPageById, getSpaceById, isFavorite, listChildPages, listSpaces, listTemplates, recordPageView } from "@/lib/data/kb";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/clients";
import { listDeals } from "@/lib/data/crm";
import { WikiEditor } from "./WikiEditor";

export default async function WikiPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth())!;
  const crm = canAccessCrm(session);
  const { id } = await params;
  const page = await getPageById(id);
  if (!page) notFound();
  const [space, ancestors, children, favorite, spaces, templates, projects, clients, deals] = await Promise.all([
    getSpaceById(page.spaceId),
    getPageAncestors(id),
    listChildPages(id),
    isFavorite(session.user.id, id),
    listSpaces(),
    listTemplates(),
    listProjects(),
    crm ? listClients() : Promise.resolve([]),
    crm ? listDeals() : Promise.resolve([]),
    recordPageView(session.user.id, id),
  ]);

  return (
    <WikiEditor
      key={page.id}
      page={page}
      space={space!}
      ancestors={ancestors}
      subPages={children}
      favorite={favorite}
      spaces={spaces}
      templates={templates}
      links={{
        clients: clients.map((c) => ({ id: c.id, name: c.name })),
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
        deals: deals.map((d) => ({ id: d.id, name: d.title })),
      }}
      canLinkCrm={crm}
    />
  );
}
