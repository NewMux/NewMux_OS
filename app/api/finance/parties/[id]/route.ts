import { route } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { deleteParty } from "@/lib/data/finance";

export const DELETE = route<{ id: string }>({ allow: canAccessSettings }, async ({ params }) => {
  await deleteParty(params.id);
  return { ok: true };
});
