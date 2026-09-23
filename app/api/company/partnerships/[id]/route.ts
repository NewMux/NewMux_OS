import { route } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { deletePartnership } from "@/lib/data/company";

export const DELETE = route<{ id: string }>({ allow: canAccessCompany }, async ({ params }) => {
  await deletePartnership(params.id);
  return { ok: true };
});
