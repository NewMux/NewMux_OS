import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { getProjectById, listTasksByProject } from "@/lib/data/projects";
import { getClientById, listClients } from "@/lib/data/clients";
import { listDocuments } from "@/lib/data/documents";
import { listSecrets } from "@/lib/data/vault";
import { listLinkedPages } from "@/lib/data/kb";
import { listMeetings } from "@/lib/data/meetings";
import { listUsers } from "@/lib/data/users";
import { ProjectDetail } from "./ProjectDetail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();
  const [tasks, client, documents, secrets, pages, meetings, users, clients] = await Promise.all([
    listTasksByProject(id),
    project.clientId ? getClientById(project.clientId) : undefined,
    admin ? listDocuments({ projectId: id }) : Promise.resolve([]),
    listSecrets({ projectId: id }),
    listLinkedPages({ projectId: id }),
    listMeetings({ projectId: id }),
    listUsers(),
    admin ? listClients() : Promise.resolve([]),
  ]);
  return (
    <ProjectDetail
      project={project}
      clientName={client?.name ?? null}
      tasks={tasks}
      documents={documents}
      secretCount={secrets.length}
      pages={pages}
      meetings={meetings}
      users={users.map((u) => ({ id: u.id, name: u.fullName }))}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      admin={admin}
    />
  );
}
