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
import { getProfitByProjectReport } from "@/lib/data/reports";
import { convertMinorUnits } from "@/lib/money";
import { ProjectDetail } from "./ProjectDetail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();
  const [tasks, client, documents, secrets, pages, meetings, users, clients, pl] = await Promise.all([
    listTasksByProject(id),
    project.clientId ? getClientById(project.clientId) : undefined,
    admin ? listDocuments({ projectId: id }) : Promise.resolve([]),
    listSecrets({ projectId: id }),
    listLinkedPages({ projectId: id }),
    listMeetings({ projectId: id }),
    listUsers(),
    admin ? listClients() : Promise.resolve([]),
    admin ? getProfitByProjectReport({ projectId: id }) : Promise.resolve([]),
  ]);
  // Item 36: invoiced, collected, costs, profit and shares (partners only).
  const row = pl.find((r) => r.projectId === id);
  const invoices = documents.filter((d) => d.type === "invoice" && !["draft", "void"].includes(d.status));
  const bhd = (v: number, c: string) => convertMinorUnits(v, c, "BHD");
  const money =
    admin && (row || invoices.length)
      ? {
          invoicedBhdCents: row?.revenueBhdCents ?? 0,
          collectedBhdCents: invoices.reduce((s, d) => s + bhd(d.paidCents, d.currency), 0),
          outstandingBhdCents: invoices.reduce((s, d) => s + (d.status === "sent" ? bhd(Math.max(d.totalCents - d.creditedCents - d.paidCents, 0), d.currency) : 0), 0),
          costsBhdCents: row?.costsBhdCents ?? 0,
          reserveBhdCents: row?.reserveBhdCents ?? 0,
          profitBhdCents: row?.netProfitBhdCents ?? 0,
          shares: row?.shares.filter((s) => s.bhdCents !== 0) ?? [],
        }
      : null;
  return (
    <ProjectDetail
      project={project}
      clientName={client?.name ?? null}
      tasks={tasks}
      documents={documents}
      money={money}
      secretCount={secrets.length}
      pages={pages}
      meetings={meetings}
      users={users.map((u) => ({ id: u.id, name: u.fullName }))}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      admin={admin}
    />
  );
}
