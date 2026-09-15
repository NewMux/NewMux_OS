import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { updateDealSchema } from "@/lib/validators/deal";
import { getDealById, updateDeal } from "@/lib/data/deals";
import { majorToMinorUnits } from "@/lib/money";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const deal = await getDealById(id);
  if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ deal });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await getDealById(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateDealSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { quotedValue, nextFollowUpDate, expectedCloseDate, ...rest } = parsed.data;
  try {
    const deal = await updateDeal(id, {
      ...rest,
      ...(quotedValue !== undefined ? { quotedValueCents: majorToMinorUnits(quotedValue, existing.currency) } : {}),
      ...(nextFollowUpDate !== undefined ? { nextFollowUpDate: nextFollowUpDate || null } : {}),
      ...(expectedCloseDate !== undefined ? { expectedCloseDate: expectedCloseDate || null } : {}),
    });
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
