import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/documents";
import { AddProjectModal } from "@/components/projects/AddProjectModal";
import { ProjectRowActions } from "@/components/projects/ProjectRowActions";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { KanbanSquare } from "lucide-react";
import type { ProjectStatus } from "@/lib/data/types";

const STATUS_TONES: Record<ProjectStatus, BadgeTone> = {
  planning: "neutral",
  active_sprint: "success",
  paused: "warning",
  completed: "info",
  archived: "muted",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await auth();
  const canManage = canAccessFinance(session);
  if (!session) redirect("/login");

  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const [all, clients] = await Promise.all([
    listProjects({ includeArchived: true }),
    listClients({ includeArchived: true }),
  ]);
  const projects = all.filter((p) => (showArchived ? p.archivedAt : !p.archivedAt));
  const archivedCount = all.filter((p) => p.archivedAt).length;
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "Internal";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Projects</h1>
        {canManage && <AddProjectModal clients={clients} />}
      </div>

      {(archivedCount > 0 || showArchived) && (
        <div className="mb-3 flex gap-2 text-xs">
          <Link
            href="/projects"
            className={showArchived ? "text-muted-foreground hover:text-foreground" : "font-medium text-brand"}
          >
            Active
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/projects?archived=1"
            className={showArchived ? "font-medium text-brand" : "text-muted-foreground hover:text-foreground"}
          >
            Archived ({archivedCount})
          </Link>
        </div>
      )}

      {projects.length === 0 && (
        <Card>
          <EmptyState
            icon={KanbanSquare}
            title={showArchived ? "Nothing archived" : "No projects yet"}
            description={
              showArchived
                ? "Archived projects keep their documents and history, and can be restored at any time."
                : "Create one directly, or win a deal on the pipeline — that sets up the project workspace for you."
            }
            action={showArchived || !canManage ? undefined : <AddProjectModal clients={clients} />}
          />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {projects.map((project) => (
          <Card key={project.id} className="transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {project.name}
                  {project.archivedAt && (
                    <Badge tone="muted" className="ml-2">
                      Archived
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {clientName(project.clientId)}
                  {project.targetEndAt ? ` · due ${new Date(project.targetEndAt).toLocaleDateString()}` : ""}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONES[project.status]} className="capitalize">
                  {project.status.replace("_", " ")}
                </Badge>
                {canManage && <ProjectRowActions project={project} />}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
