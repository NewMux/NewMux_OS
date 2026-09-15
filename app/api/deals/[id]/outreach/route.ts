import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { logOutreachSchema } from "@/lib/validators/deal";
import { listOutreachForDeal, logOutreachActivity } from "@/lib/data/deals";

export const GET = withRoute(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const activities = await listOutreachForDeal(id);
    return NextResponse.json({ activities });
  },
);

export const POST = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const body = await req.json();
    const parsed = logOutreachSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { id } = await params;
    const activity = await logOutreachActivity({
      dealId: id,
      channel: parsed.data.channel,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes,
      nextFollowUpDate: parsed.data.nextFollowUpDate,
      contactedBy: session.user.id,
    });
    return NextResponse.json({ activity }, { status: 201 });
  },
);
