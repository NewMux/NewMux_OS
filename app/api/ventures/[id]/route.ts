import { crudRoute } from "@/lib/api/crudRoute";
import { canAccessFinance } from "@/lib/rbac";
import { updateVentureSchema } from "@/lib/validators/finance";
import {
  updateVenture,
  deleteVenture,
  getVentureById,
} from "@/lib/data/finance";

export const { PATCH, DELETE } = crudRoute({
  kind: "venture",
  label: "venture",
  schema: updateVentureSchema,
  can: canAccessFinance,
  load: (id) => getVentureById(id).then((v) => v && { name: v.name }),
  update: (id, patch) => updateVenture(id, patch),
  remove: (id) => deleteVenture(id),
});
