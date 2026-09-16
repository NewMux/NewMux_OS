import { crudRoute } from "@/lib/api/crudRoute";
import { isPartnerAdmin } from "@/lib/rbac";
import { updateSecretSchema } from "@/lib/validators/vault";
import {
  getSecretById,
  updateSecretLabel,
  deleteSecret,
} from "@/lib/data/vault";

/**
 * Lead Dev gets 403 here as it does on reveal: renaming or destroying a
 * credential is partner-admin only. Both paths write to the vault access log.
 */
export const { PATCH, DELETE } = crudRoute({
  kind: "secret",
  label: "credential",
  schema: updateSecretSchema,
  can: isPartnerAdmin,
  load: (id) => getSecretById(id).then((s) => s && { name: s.label }),
  update: (id, patch, session) =>
    updateSecretLabel(id, patch.label, session.user.id),
  remove: (id, session) => deleteSecret(id, session.user.id),
});
