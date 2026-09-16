import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/documents";
import { AddProjectModal } from "@/components/projects/AddProjectModal";
import { ProjectRowActions } from "@/components/projects/ProjectRowActions";
import { ListToolbar } from "@/components/list/ListToolbar";
import {
  applyListQuery,
  byDate,
  byText,
  isFiltered,
  parseListParams,
  type SearchParamRecord,
} from "@/lib/list/query";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { KanbanSquare, SearchX, ExternalLink } from "lucide-react";
import type { ProjectStatus } from "@/lib/data/types";

const STATUS_TONES: Record<ProjectStatus, BadgeTone> = {
  planning: "neutral",
  active_sprint: "success",
  paused: "warning",
  completed: "info",
  archived: "muted",
};

const STATUSES: ProjectStatus[] = [
  "planning",
  "active_sprint",
  "paused",
  "completed",
  "archived",
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamRecord>;
}) {
  const session = await auth();
  const canManage = canAccessFinance(session);
  if (!session) redirect("/login");

  const params = parseListParams(await searchParams, {
    filterKeys: ["status"],
  });
  const [all, clients] = await Promise.all([
    listProjects({ includeArchived: true }),
    listClients({ includeArchived: true }),
  ]);
  const archivedCount = all.filter((p) => p.archivedAt).length;
  const clientName = (id: string | null) =>
    clients.find((c) => c.id === id)?.name ?? "Internal";

  const projects = applyListQuery(all, params, {
    searchFields: (p) => [
      p.name,
      p.techStack,
      p.domain,
      p.hostingProvider,
      clientName(p.clientId),
    ],
    sorters: {
      name: byText((p) => p.name),
      target: byDate((p) => p.targetEndAt),
      started: byDate((p) => p.startedAt),
    },
    filters: { status: (p, value) => p.status === value },
    isArchived: (p) => p.archivedAt !== null,
  });

  const narrowed = isFiltered(params);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Projects</h1>
        {canManage && <AddProjectModal clients={clients} />}
      </div>

      <ListToolbar
        searchPlaceholder="Search name, client, stack, domain…"
        filters={[
          {
            key: "status",
            label: "Status",
            options: STATUSES.map((s) => ({
              value: s,
              label: s.replace("_", " "),
            })),
          },
        ]}
        sorts={[
          { value: "name", label: "Name" },
          { value: "target", label: "Target end" },
          { value: "started", label: "Start date" },
        ]}
        archivedCount={archivedCount}
        exportType={canManage ? "projects" : undefined}
      />

      {projects.length === 0 && (
        <Card>
          {narrowed ? (
            <EmptyState
              icon={SearchX}
              title="No matching projects"
              description="Try a different search, or clear the filters to see them all."
            />
          ) : (
            <EmptyState
              icon={KanbanSquare}
              title={params.archived ? "Nothing archived" : "No projects yet"}
              description={
                params.archived
                  ? "Archived projects keep their documents and history, and can be restored at any time."
                  : "Create one directly, or win a deal on the pipeline — that sets up the project workspace for you."
              }
              action={
                params.archived || !canManage ? undefined : (
                  <AddProjectModal clients={clients} />
                )
              }
            />
          )}
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="transition-colors hover:border-primary/40"
          >
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
                  {project.startedAt
                    ? ` · started ${new Date(project.startedAt).toLocaleDateString()}`
                    : ""}
                  {project.targetEndAt
                    ? ` · due ${new Date(project.targetEndAt).toLocaleDateString()}`
                    : ""}
                  {project.techStack ? ` · ${project.techStack}` : ""}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {project.controlPanelUrl && (
                  <a
                    href={project.controlPanelUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Open the control panel for ${project.name}`}
                    className="rounded p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <Badge
                  tone={STATUS_TONES[project.status]}
                  className="capitalize"
                >
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
