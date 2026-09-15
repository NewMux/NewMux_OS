import Link from "next/link";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/documents";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/data/types";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "bg-tone-neutral/20 text-secondary-foreground",
  active_sprint: "bg-tone-success/20 text-tone-success-fg",
  paused: "bg-tone-warning/20 text-tone-warning-fg",
  completed: "bg-tone-info/20 text-tone-info-fg",
  archived: "bg-tone-muted/20 text-tone-muted-fg",
};

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([listProjects(), listClients()]);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "Internal";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Projects</h1>
      <div className="flex flex-col gap-2">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{clientName(project.clientId)}</p>
                </div>
                <Badge className={cn(STATUS_STYLES[project.status], "capitalize")}>
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
