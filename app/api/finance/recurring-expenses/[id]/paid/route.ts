import { route } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { markRecurringExpensePaid } from "@/lib/data/finance";

export const POST = route<{ id: string }>({ allow: canAccessFinance }, async ({ params, session }) => ({
  expense: await markRecurringExpensePaid(params.id, session.user.id),
}));
