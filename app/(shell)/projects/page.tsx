import Link from "next/link";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/documents";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/data/types";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "bg-slate-500/20 text-slate-300",
  active_sprint: "bg-emerald-500/20 text-emerald-300",
  paused: "bg-amber-500/20 text-amber-300",
  completed: "bg-blue-500/20 text-blue-300",
  archived: "bg-zinc-500/20 text-zinc-400",
};

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([listProjects(), listClients()]);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "Internal";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-semibold text-white">Projects</h1>
      <div className="flex flex-col gap-2">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="transition-colors hover:border-emerald-500/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{project.name}</p>
                  <p className="text-xs text-slate-500">{clientName(project.clientId)}</p>
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
