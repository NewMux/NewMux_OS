import Link from "next/link";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/documents";
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

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([
    listProjects(),
    listClients(),
  ]);
  const clientName = (id: string | null) =>
    clients.find((c) => c.id === id)?.name ?? "Internal";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Projects</h1>
      {projects.length === 0 && (
        <Card>
          <EmptyState
            icon={KanbanSquare}
            title="No projects yet"
            description="Projects appear here when you win a deal on the pipeline, or you can create one directly."
          />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {project.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {clientName(project.clientId)}
                  </p>
                </div>
                <Badge
                  tone={STATUS_TONES[project.status]}
                  className="capitalize"
                >
                  {project.status.replace("_", " ")}
                </Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
