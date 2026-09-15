import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createRecurringExpenseSchema } from "@/lib/validators/finance";
import {
  listRecurringExpenses,
  createRecurringExpense,
} from "@/lib/data/finance";
import { majorToMinorUnits } from "@/lib/money";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const expenses = await listRecurringExpenses();
  return NextResponse.json({ expenses });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const body = await req.json();
  const parsed = createRecurringExpenseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const expense = await createRecurringExpense({
    ...parsed.data,
    amountCents: majorToMinorUnits(parsed.data.amount, parsed.data.currency),
  });
  return NextResponse.json({ expense }, { status: 201 });
});
