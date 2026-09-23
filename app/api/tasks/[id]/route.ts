import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { updateTaskSchema } from "@/lib/validators/task";
import { deleteTask, getTaskById, listSubtasks, listTaskComments, updateTask } from "@/lib/data/projects";
import { NotFoundError } from "@/lib/data/sql";

type P = { id: string };

/** Full task detail for the task sheet: task + subtasks + comments. */
export const GET = route<P>({ allow: canAccessWork }, async ({ params }) => {
  const task = await getTaskById(params.id);
  if (!task) throw new NotFoundError("Task");
  const [subtasks, comments] = await Promise.all([listSubtasks(params.id), listTaskComments(params.id)]);
  return { task, subtasks, comments };
});

export const PATCH = route<P>({ allow: canAccessWork }, async ({ req, params }) => ({
  task: await updateTask(params.id, await body(req, updateTaskSchema)),
}));

export const DELETE = route<P>({ allow: canAccessWork }, async ({ params }) => {
  await deleteTask(params.id);
  return { ok: true };
});
