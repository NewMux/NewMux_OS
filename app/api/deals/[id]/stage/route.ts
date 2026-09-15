import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { moveDealSchema } from "@/lib/validators/deal";
import { moveDeal } from "@/lib/data/deals";

export const PATCH = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const body = await req.json();
    const parsed = moveDealSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { id } = await params;
    const deal = await moveDeal(
      id,
      parsed.data.stage,
      parsed.data.index,
      session.user.id,
      parsed.data.lostReason,
    );
    return NextResponse.json({ deal });
  },
);
