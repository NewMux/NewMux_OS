import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getProjectById, listTasksByProject } from "@/lib/data/projects";
import { getClientById, listDocuments } from "@/lib/data/documents";
import { listSecrets } from "@/lib/data/vault";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { NewTaskButton } from "./NewTaskButton";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { centsToDisplay } from "@/lib/money";
import { ExternalLink, KeyRound } from "lucide-react";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const canSeeFinancials = canAccessFinance(session);
  const [tasks, client, allDocuments, allSecrets] = await Promise.all([
    listTasksByProject(id),
    project.clientId ? getClientById(project.clientId) : Promise.resolve(undefined),
    canSeeFinancials ? listDocuments() : Promise.resolve([]),
    canSeeFinancials ? listSecrets() : Promise.resolve([]),
  ]);
  const documents = allDocuments.filter((d) => d.projectId === id);
  const secretCount = allSecrets.filter((s) => s.projectId === id).length;

  const domainRenewalSoon =
    project.domainRenewalDate &&
    new Date(project.domainRenewalDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{project.name}</h1>
          {client && (
            <Link href={`/clients/${client.id}`} className="text-sm text-emerald-400 hover:underline">
              {client.name}
            </Link>
          )}
        </div>
        <NewTaskButton projectId={project.id} />
      </div>

      {canSeeFinancials && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Technical Detail</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <p className="text-slate-300">Tech stack: {project.techStack ?? "—"}</p>
            <p className="text-slate-300">Hosting: {project.hostingProvider ?? "—"}</p>
            <p className="text-slate-300">
              Domain: {project.domain ?? "—"}
              {project.domainRenewalDate && (
                <span className={domainRenewalSoon ? "ml-1 text-amber-400" : "ml-1 text-slate-500"}>
                  (renews {new Date(project.domainRenewalDate).toLocaleDateString()})
                </span>
              )}
            </p>
            <p className="flex items-center gap-1 text-slate-300">
              GitHub:{" "}
              {project.githubUrl ? (
                <a href={project.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-400 hover:underline">
                  Repository <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <Link href="/vault" className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400">
            <KeyRound className="h-3 w-3" /> {secretCount} credential{secretCount === 1 ? "" : "s"} in the vault
          </Link>
        </Card>
      )}

      <div className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Tasks</h2>
        <KanbanBoard tasks={tasks} />
      </div>

      {canSeeFinancials && (
        <Card>
          <CardHeader>
            <CardTitle>Invoices & Payments</CardTitle>
          </CardHeader>
          {documents.length === 0 && <p className="text-sm text-slate-500">No documents yet.</p>}
          <div className="flex flex-col gap-2">
            {documents.map((d) => (
              <Link key={d.id} href={`/documents/${d.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 text-sm hover:border-emerald-500/40">
                  <span className="text-slate-200">{d.documentNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{centsToDisplay(d.totalCents, d.currency)}</span>
                    <StatusBadge status={d.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
