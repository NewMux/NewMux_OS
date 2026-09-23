import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { addPartnershipSchema } from "@/lib/validators/company";
import { addPartnership } from "@/lib/data/company";

export const POST = route({ allow: canAccessCompany, status: 201 }, async ({ req }) => ({
  partnership: await addPartnership(await body(req, addPartnershipSchema)),
}));
