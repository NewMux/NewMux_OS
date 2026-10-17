import { route, body } from "@/lib/api";
import { canAccessDocuments, isPartnerAdmin } from "@/lib/rbac";
import { getCompanyDetails, updateCompanyDetails } from "@/lib/data/company";
import { companyDetailsSchema } from "@/lib/validators/officialDocs";
import { logAudit } from "@/lib/data/audit";

/** The fixed company details every official document prints in its footer, IBAN included. */
export const GET = route({ allow: canAccessDocuments }, async () => ({ details: await getCompanyDetails() }));

export const PATCH = route({ allow: isPartnerAdmin }, async ({ req, session }) => {
  const details = await updateCompanyDetails(await body(req, companyDetailsSchema));
  await logAudit({ entityType: "company", entityId: session.user.id, action: "update", summary: "Changed the company details on official documents", changedBy: session.user.id });
  return { details };
});
