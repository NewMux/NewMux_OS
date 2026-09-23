import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { certificationSchema } from "@/lib/validators/company";
import { addCertification } from "@/lib/data/company";

export const POST = route({ allow: canAccessCompany, status: 201 }, async ({ req }) => ({
  certification: await addCertification(await body(req, certificationSchema)),
}));
