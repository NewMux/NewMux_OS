import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { moveTaskSchema } from "@/lib/validators/task";
import { moveTask } from "@/lib/data/projects";

export const POST = route<{ id: string }>({ allow: canAccessWork }, async ({ req, params }) => {
  const { status, orderedIds } = await body(req, moveTaskSchema);
  await moveTask(params.id, status, orderedIds);
  return { ok: true };
});
