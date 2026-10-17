import { route, body } from "@/lib/api";
import { isPartnerAdmin } from "@/lib/rbac";
import { updateSignatory } from "@/lib/data/signatories";
import { signatorySchema } from "@/lib/validators/officialDocs";

/** Rename, change position or login, deactivate. Never deleted: issued documents keep their snapshot. */
export const PATCH = route<{ id: string }>({ allow: isPartnerAdmin }, async ({ req, params, session }) => ({
  signatory: await updateSignatory(params.id, await body(req, signatorySchema), session.user.id),
}));
