import { route, body } from "@/lib/api";
import { canAccessDocuments, isPartnerAdmin } from "@/lib/rbac";
import { listStandaloneClauses, listTermsTemplates, saveTermsTemplate } from "@/lib/data/terms";
import { termsTemplateSchema } from "@/lib/validators/officialDocs";

/** The Terms & Conditions library: templates per product type, and standalone clauses. */
export const GET = route({ allow: canAccessDocuments }, async () => {
  const [templates, standalone] = await Promise.all([listTermsTemplates(), listStandaloneClauses()]);
  return { templates, standalone };
});

export const POST = route({ allow: isPartnerAdmin, status: 201 }, async ({ req, session }) => ({
  template: await saveTermsTemplate(null, await body(req, termsTemplateSchema), session.user.id),
}));
