import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { expenseSchema } from "@/lib/validators/finance";
import { createExpense, listExpenses } from "@/lib/data/expenses";
import { majorToMinorUnits } from "@/lib/money";

export const GET = route({ allow: canAccessFinance }, async () => ({ expenses: await listExpenses() }));

export const POST = route({ allow: canAccessFinance, status: 201 }, async ({ req, session }) => {
  const { amount, amountBhd, ...input } = await body(req, expenseSchema);
  const amountBhdCents = amountBhd === null ? null : majorToMinorUnits(amountBhd, "BHD");
  return { expense: await createExpense({ ...input, amountCents: majorToMinorUnits(amount, input.currency), amountBhdCents }, session.user.id) };
});
