import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { certificationSchema } from "@/lib/validators/company";
import { deleteCertification, updateCertification } from "@/lib/data/company";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCompany }, async ({ req, params }) => ({
  certification: await updateCertification(params.id, await body(req, certificationSchema)),
}));

export const DELETE = route<P>({ allow: canAccessCompany }, async ({ params }) => {
  await deleteCertification(params.id);
  return { ok: true };
});
