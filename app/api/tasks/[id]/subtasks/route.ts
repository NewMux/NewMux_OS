import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { subtaskSchema } from "@/lib/validators/task";
import { addSubtask } from "@/lib/data/projects";

export const POST = route<{ id: string }>({ allow: canAccessWork, status: 201 }, async ({ req, params }) => ({
  subtask: await addSubtask(params.id, (await body(req, subtaskSchema)).title),
}));
