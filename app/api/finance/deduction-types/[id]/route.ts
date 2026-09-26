import { route, body } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { updateDeductionTypeSchema } from "@/lib/validators/finance";
import { deleteDeductionType, updateDeductionType } from "@/lib/data/finance";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessSettings }, async ({ req, params }) => ({
  deductionType: await updateDeductionType(params.id, await body(req, updateDeductionTypeSchema)),
}));

export const DELETE = route<P>({ allow: canAccessSettings }, async ({ params }) => {
  await deleteDeductionType(params.id);
  return { ok: true };
});
