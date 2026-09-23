import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { updateSubtaskSchema } from "@/lib/validators/task";
import { deleteSubtask, updateSubtask } from "@/lib/data/projects";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessWork }, async ({ req, params }) => ({
  subtask: await updateSubtask(params.id, await body(req, updateSubtaskSchema)),
}));

export const DELETE = route<P>({ allow: canAccessWork }, async ({ params }) => {
  await deleteSubtask(params.id);
  return { ok: true };
});
