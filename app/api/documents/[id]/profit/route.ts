import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getInvoiceProfitBreakdown } from "@/lib/data/finance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const breakdown = await getInvoiceProfitBreakdown(id);
  if (!breakdown) return NextResponse.json({ error: "No profit-split rule configured for this invoice" }, { status: 404 });
  return NextResponse.json({ breakdown });
}
