import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { projectSchema } from "@/lib/validators/project";
import { createProject, listProjectsWithStats } from "@/lib/data/projects";

export const GET = route({ allow: canAccessWork }, async () => ({ projects: await listProjectsWithStats() }));

export const POST = route({ allow: canAccessWork, status: 201 }, async ({ req, session }) => ({
  project: await createProject(await body(req, projectSchema), session.user.id),
}));
