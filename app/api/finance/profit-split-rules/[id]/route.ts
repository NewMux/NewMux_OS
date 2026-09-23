import { route } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { deleteProfitSplitRule } from "@/lib/data/finance";

export const DELETE = route<{ id: string }>({ allow: canAccessSettings }, async ({ params, session }) => {
  await deleteProfitSplitRule(params.id, session.user.id);
  return { ok: true };
});
