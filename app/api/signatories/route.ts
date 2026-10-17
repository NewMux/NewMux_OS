import { route, body } from "@/lib/api";
import { canAccessDocuments, isPartnerAdmin } from "@/lib/rbac";
import { createSignatory, listSignatories } from "@/lib/data/signatories";
import { signatorySchema } from "@/lib/validators/officialDocs";

/** Who signs official documents (Settings → Signatories). Only partners change them. */
export const GET = route({ allow: canAccessDocuments }, async () => ({ signatories: await listSignatories() }));

export const POST = route({ allow: isPartnerAdmin, status: 201 }, async ({ req, session }) => ({
  signatory: await createSignatory(await body(req, signatorySchema), session.user.id),
}));
