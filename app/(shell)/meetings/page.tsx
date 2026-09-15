import { auth } from "@/lib/auth";
import { listMeetings } from "@/lib/data/meetings";
import { listTasks, listProjects } from "@/lib/data/projects";
import { AddMeetingModal } from "@/components/meetings/AddMeetingModal";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/projects/PriorityBadge";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default async function MeetingsPage() {
  await auth();
  const [meetings, tasks, projects] = await Promise.all([listMeetings(), listTasks(), listProjects()]);

  const now = Date.now();
  const sortedTasks = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt < b.dueAt ? -1 : 1;
    });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Meetings & Tasks</h1>
        <AddMeetingModal projects={projects} />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Meetings</CardTitle>
        </CardHeader>
        {meetings.length === 0 && <p className="text-sm text-muted-foreground">No meetings scheduled.</p>}
        <div className="flex flex-col gap-2">
          {meetings.map((m) => {
            const project = projects.find((p) => p.id === m.linkedProjectId);
            return (
              <div key={m.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{m.title}</p>
                  {m.recurring !== "none" && (
                    <Badge tone="neutral" className="capitalize">{m.recurring}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.startsAt).toLocaleString()}
                  {project ? ` · ${project.name}` : ""}
                </p>
                {m.notes && <p className="mt-1 text-xs text-muted-foreground">{m.notes}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks (all projects)</CardTitle>
        </CardHeader>
        {sortedTasks.length === 0 && <p className="text-sm text-muted-foreground">Nothing outstanding.</p>}
        <div className="flex flex-col gap-2">
          {sortedTasks.map((t) => {
            const project = projects.find((p) => p.id === t.projectId);
            const overdue = t.dueAt && new Date(t.dueAt).getTime() < now;
            return (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {project?.name ?? "—"}
                    {t.dueAt && (
                      <span className={cn(overdue ? "text-danger" : "text-muted-foreground")}>
                        {" "}
                        · due {new Date(t.dueAt).toLocaleDateString()}
                        {overdue ? " (overdue)" : ""}
                      </span>
                    )}
                  </p>
                </div>
                <PriorityBadge priority={t.priority} />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
