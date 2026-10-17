import { route, body } from "@/lib/api";
import { canAccessDocuments, isPartnerAdmin } from "@/lib/rbac";
import { listTemplateVersions, saveTermsTemplate } from "@/lib/data/terms";
import { termsTemplateSchema } from "@/lib/validators/officialDocs";

type P = { id: string };

/** Every saved version of a template's text. */
export const GET = route<P>({ allow: canAccessDocuments }, async ({ params }) => ({ versions: await listTemplateVersions(params.id) }));

/** Saving changed text makes a new version; documents already made keep theirs. */
export const PATCH = route<P>({ allow: isPartnerAdmin }, async ({ req, params, session }) => ({
  template: await saveTermsTemplate(params.id, await body(req, termsTemplateSchema), session.user.id),
}));
