import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { recurringExpenseSchema } from "@/lib/validators/finance";
import { createRecurringExpense, listRecurringExpenses } from "@/lib/data/finance";
import { majorToMinorUnits } from "@/lib/money";

export const GET = route({ allow: canAccessFinance }, async () => ({ expenses: await listRecurringExpenses() }));

export const POST = route({ allow: canAccessFinance, status: 201 }, async ({ req }) => {
  const { amount, ...input } = await body(req, recurringExpenseSchema);
  return { expense: await createRecurringExpense({ ...input, amountCents: majorToMinorUnits(amount, input.currency) }) };
});
