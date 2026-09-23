import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { recurringExpenseSchema } from "@/lib/validators/finance";
import { deleteRecurringExpense, updateRecurringExpense } from "@/lib/data/finance";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessFinance }, async ({ req, params }) => {
  const { amount, ...input } = await body(req, recurringExpenseSchema);
  return { expense: await updateRecurringExpense(params.id, { ...input, amountCents: majorToMinorUnits(amount, input.currency) }) };
});

export const DELETE = route<P>({ allow: canAccessFinance }, async ({ params, session }) => {
  await deleteRecurringExpense(params.id, session.user.id);
  return { ok: true };
});
