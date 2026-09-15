import { notFound } from "next/navigation";
import { getProjectById, listTasksByProject } from "@/lib/data/projects";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { NewTaskButton } from "./NewTaskButton";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const tasks = await listTasksByProject(id);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">{project.name}</h1>
        <NewTaskButton projectId={project.id} />
      </div>
      <KanbanBoard tasks={tasks} />
    </div>
  );
}
