import { route, body } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { createDeductionTypeSchema } from "@/lib/validators/finance";
import { createDeductionType, listDeductionTypes } from "@/lib/data/finance";

export const GET = route({ allow: canAccessSettings }, async () => ({ deductionTypes: await listDeductionTypes() }));

export const POST = route({ allow: canAccessSettings, status: 201 }, async ({ req }) => {
  const { name, kind, fundPartyId } = await body(req, createDeductionTypeSchema);
  return { deductionType: await createDeductionType(name, kind, fundPartyId) };
});
