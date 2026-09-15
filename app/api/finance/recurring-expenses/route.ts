import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createRecurringExpenseSchema } from "@/lib/validators/finance";
import { listRecurringExpenses, createRecurringExpense } from "@/lib/data/finance";
import { majorToMinorUnits } from "@/lib/money";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const expenses = await listRecurringExpenses();
  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createRecurringExpenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const expense = await createRecurringExpense({
    ...parsed.data,
    amountCents: majorToMinorUnits(parsed.data.amount, parsed.data.currency),
  });
  return NextResponse.json({ expense }, { status: 201 });
}
