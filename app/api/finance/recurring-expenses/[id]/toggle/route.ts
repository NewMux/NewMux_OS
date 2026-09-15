import { NextResponse } from "next/server";
import { forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { toggleRecurringExpenseStatus } from "@/lib/data/finance";

export const POST = withRoute(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const expense = await toggleRecurringExpenseStatus(id);
    return NextResponse.json({ expense });
  },
);
