import { crudRoute } from "@/lib/api/crudRoute";
import { canAccessFinance } from "@/lib/rbac";
import { updateRecurringExpenseSchema } from "@/lib/validators/finance";
import {
  updateRecurringExpense,
  deleteRecurringExpense,
  getRecurringExpenseById,
} from "@/lib/data/finance";
import { majorToMinorUnits } from "@/lib/money";

export const { PATCH, DELETE } = crudRoute({
  kind: "expense",
  label: "expense",
  schema: updateRecurringExpenseSchema,
  can: canAccessFinance,
  load: (id) => getRecurringExpenseById(id).then((e) => e && { name: e.name }),
  update: async (id, patch, session) => {
    const { amount, ...rest } = patch;
    const existing = await getRecurringExpenseById(id);
    return updateRecurringExpense(id, session.user.id, {
      ...rest,
      ...(amount !== undefined
        ? {
            amountCents: majorToMinorUnits(
              amount,
              patch.currency ?? existing?.currency ?? "BHD",
            ),
          }
        : {}),
    });
  },
  remove: (id, session) => deleteRecurringExpense(id, session.user.id),
});
