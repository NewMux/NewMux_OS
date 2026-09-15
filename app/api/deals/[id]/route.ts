import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  notFound,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { updateDealSchema } from "@/lib/validators/deal";
import { getDealById, updateDeal } from "@/lib/data/deals";
import { majorToMinorUnits } from "@/lib/money";

export const GET = withRoute(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const deal = await getDealById(id);
    if (!deal) return notFound();
    return NextResponse.json({ deal });
  },
);

export const PATCH = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const existing = await getDealById(id);
    if (!existing) return notFound();

    const body = await req.json();
    const parsed = updateDealSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { quotedValue, nextFollowUpDate, expectedCloseDate, ...rest } =
      parsed.data;
    const deal = await updateDeal(id, {
      ...rest,
      ...(quotedValue !== undefined
        ? {
            quotedValueCents: majorToMinorUnits(quotedValue, existing.currency),
          }
        : {}),
      ...(nextFollowUpDate !== undefined
        ? { nextFollowUpDate: nextFollowUpDate || null }
        : {}),
      ...(expectedCloseDate !== undefined
        ? { expectedCloseDate: expectedCloseDate || null }
        : {}),
    });
    return NextResponse.json({ deal });
  },
);
