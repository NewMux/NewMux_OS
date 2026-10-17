import { route, body } from "@/lib/api";
import { isPartnerAdmin } from "@/lib/rbac";
import { saveStandaloneClauses } from "@/lib/data/terms";
import { standaloneClausesSchema } from "@/lib/validators/officialDocs";

/** Replaces the standalone clauses (payment terms, confidentiality…) that can go into any document. */
export const PUT = route({ allow: isPartnerAdmin }, async ({ req, session }) => ({
  clauses: await saveStandaloneClauses((await body(req, standaloneClausesSchema)).clauses, session.user.id),
}));
