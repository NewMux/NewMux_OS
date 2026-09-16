import { crudRoute } from "@/lib/api/crudRoute";
import { canAccessSettings } from "@/lib/rbac";
import { updateDeductionTypeSchema } from "@/lib/validators/finance";
import {
  updateDeductionType,
  deleteDeductionType,
  getDeductionTypeById,
} from "@/lib/data/finance";

export const { PATCH, DELETE } = crudRoute({
  kind: "deductionType",
  label: "deduction type",
  schema: updateDeductionTypeSchema,
  can: canAccessSettings,
  load: (id) => getDeductionTypeById(id).then((d) => d && { name: d.name }),
  update: (id, patch) => updateDeductionType(id, patch),
  remove: (id) => deleteDeductionType(id),
});
