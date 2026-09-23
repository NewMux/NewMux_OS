import { route } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { deleteDeductionType } from "@/lib/data/finance";

export const DELETE = route<{ id: string }>({ allow: canAccessSettings }, async ({ params }) => {
  await deleteDeductionType(params.id);
  return { ok: true };
});
