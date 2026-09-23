import { route } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { toggleRecurringExpenseStatus } from "@/lib/data/finance";

export const POST = route<{ id: string }>({ allow: canAccessFinance }, async ({ params }) => ({
  expense: await toggleRecurringExpenseStatus(params.id),
}));
