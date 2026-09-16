import { crudRoute } from "@/lib/api/crudRoute";
import { canAccessSettings } from "@/lib/rbac";
import { updatePartySchema } from "@/lib/validators/finance";
import { updateParty, deleteParty, getPartyById } from "@/lib/data/finance";

export const { PATCH, DELETE } = crudRoute({
  kind: "party",
  label: "payout party",
  schema: updatePartySchema,
  can: canAccessSettings,
  load: (id) => getPartyById(id).then((p) => p && { name: p.name }),
  update: (id, patch) => updateParty(id, patch),
  remove: (id) => deleteParty(id),
});
