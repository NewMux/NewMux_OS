import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { ventureSchema } from "@/lib/validators/finance";
import { createVenture } from "@/lib/data/finance";

export const POST = route({ allow: canAccessCompany, status: 201 }, async ({ req }) => ({
  venture: await createVenture(await body(req, ventureSchema)),
}));
