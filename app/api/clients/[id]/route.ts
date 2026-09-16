import { crudRoute } from "@/lib/api/crudRoute";
import { canAccessFinance } from "@/lib/rbac";
import { updateClientSchema } from "@/lib/validators/client";
import {
  updateClient,
  deleteClient,
  setClientArchived,
  getClientById,
} from "@/lib/data/documents";

export const { PATCH, DELETE } = crudRoute({
  kind: "client",
  label: "client",
  schema: updateClientSchema,
  can: canAccessFinance,
  load: (id) => getClientById(id),
  update: (id, patch) => updateClient(id, patch),
  remove: (id) => deleteClient(id),
  setArchived: (id, archived) => setClientArchived(id, archived),
});
