import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { commentSchema } from "@/lib/validators/task";
import { addTaskComment } from "@/lib/data/projects";

export const POST = route<{ id: string }>({ allow: canAccessWork, status: 201 }, async ({ req, params, session }) => ({
  comment: await addTaskComment(params.id, session.user.id, (await body(req, commentSchema)).body),
}));
