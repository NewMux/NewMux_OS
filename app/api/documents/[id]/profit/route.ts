import { NextRequest, NextResponse } from "next/server";
import { forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getInvoiceProfitBreakdown } from "@/lib/data/finance";

export const GET = withRoute(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const breakdown = await getInvoiceProfitBreakdown(id);
    if (!breakdown)
      return NextResponse.json(
        { error: "No profit-split rule configured for this invoice" },
        { status: 404 },
      );
    return NextResponse.json({ breakdown });
  },
);
