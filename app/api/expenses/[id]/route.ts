import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { expenseSchema } from "@/lib/validators/finance";
import { deleteExpense, updateExpense } from "@/lib/data/expenses";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessFinance }, async ({ req, params, session }) => {
  const { amount, ...input } = await body(req, expenseSchema);
  return { expense: await updateExpense(params.id, { ...input, amountCents: majorToMinorUnits(amount, input.currency) }, session.user.id) };
});

export const DELETE = route<P>({ allow: canAccessFinance }, async ({ params, session }) => {
  await deleteExpense(params.id, session.user.id);
  return { ok: true };
});
