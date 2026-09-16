import { crudRoute } from "@/lib/api/crudRoute";
import { canAccessFinance } from "@/lib/rbac";
import { updateProjectSchema } from "@/lib/validators/project";
import {
  updateProject,
  deleteProject,
  setProjectArchived,
  getProjectById,
} from "@/lib/data/projects";

export const { PATCH, DELETE } = crudRoute({
  kind: "project",
  label: "project",
  schema: updateProjectSchema,
  can: canAccessFinance,
  load: (id) => getProjectById(id),
  update: (id, patch) => updateProject(id, patch),
  remove: (id) => deleteProject(id),
  setArchived: (id, archived) => setProjectArchived(id, archived),
});
