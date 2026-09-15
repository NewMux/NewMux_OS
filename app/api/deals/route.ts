import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createDealSchema } from "@/lib/validators/deal";
import { listDeals, createDeal } from "@/lib/data/deals";
import { majorToMinorUnits } from "@/lib/money";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const deals = await listDeals();
  return NextResponse.json({ deals });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const body = await req.json();
  const parsed = createDealSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const deal = await createDeal({
    name: parsed.data.name,
    contactPerson: parsed.data.contactPerson,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone,
    quotedValueCents: majorToMinorUnits(
      parsed.data.quotedValue,
      parsed.data.currency,
    ),
    currency: parsed.data.currency,
    ownerId: parsed.data.ownerId,
    notes: parsed.data.notes,
    createdBy: session.user.id,
  });
  return NextResponse.json({ deal }, { status: 201 });
});
