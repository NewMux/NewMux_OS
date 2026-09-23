import { route } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { deletePayment } from "@/lib/data/finance";

export const DELETE = route<{ id: string }>({ allow: canAccessFinance }, async ({ params, session }) => {
  await deletePayment(params.id, session.user.id);
  return { ok: true };
});
