import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createDealSchema } from "@/lib/validators/deal";
import { listDeals, createDeal } from "@/lib/data/deals";
import { majorToMinorUnits } from "@/lib/money";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const deals = await listDeals();
  return NextResponse.json({ deals });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createDealSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const deal = await createDeal({
    name: parsed.data.name,
    contactPerson: parsed.data.contactPerson,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone,
    quotedValueCents: majorToMinorUnits(parsed.data.quotedValue, parsed.data.currency),
    currency: parsed.data.currency,
    ownerId: parsed.data.ownerId,
    notes: parsed.data.notes,
    createdBy: session.user.id,
  });
  return NextResponse.json({ deal }, { status: 201 });
}
