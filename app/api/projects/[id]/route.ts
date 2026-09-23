import { route, body } from "@/lib/api";
import { canAccessWork, isPartnerAdmin } from "@/lib/rbac";
import { updateProjectSchema } from "@/lib/validators/project";
import { deleteProject, updateProject } from "@/lib/data/projects";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessWork }, async ({ req, params }) => ({
  project: await updateProject(params.id, await body(req, updateProjectSchema)),
}));

/** Deleting a project removes its tasks — partners only. */
export const DELETE = route<P>({ allow: isPartnerAdmin }, async ({ params }) => {
  await deleteProject(params.id);
  return { ok: true };
});
