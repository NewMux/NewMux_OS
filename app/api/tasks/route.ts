import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { createTaskSchema } from "@/lib/validators/task";
import { createTask, listTasks } from "@/lib/data/projects";

export const GET = route({ allow: canAccessWork }, async ({ req, session }) => ({
  tasks: await listTasks({ assigneeId: req.nextUrl.searchParams.get("mine") ? session.user.id : undefined }),
}));

export const POST = route({ allow: canAccessWork, status: 201 }, async ({ req, session }) => ({
  task: await createTask({ ...(await body(req, createTaskSchema)), createdBy: session.user.id }),
}));
