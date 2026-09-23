import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { companyProfileSchema } from "@/lib/validators/company";
import { updateCompanyProfile } from "@/lib/data/company";

export const PATCH = route({ allow: canAccessCompany }, async ({ req }) => ({
  profile: await updateCompanyProfile(await body(req, companyProfileSchema)),
}));
