import { auth } from "@/lib/auth";
import { listProjects, listTasks } from "@/lib/data/projects";
import { listUsers } from "@/lib/data/users";
import { TasksScreen } from "./TasksScreen";

export const metadata = { title: "My Tasks" };

export default async function TasksPage() {
  const session = (await auth())!;
  const [tasks, projects, users] = await Promise.all([listTasks({ assigneeId: session.user.id }), listProjects(), listUsers()]);
  return (
    <TasksScreen
      tasks={tasks}
      userId={session.user.id}
      projects={projects.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, name: p.name }))}
      users={users.map((u) => ({ id: u.id, name: u.fullName }))}
    />
  );
}
