import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { logOutreachSchema } from "@/lib/validators/deal";
import { listOutreachForDeal, logOutreachActivity } from "@/lib/data/deals";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const activities = await listOutreachForDeal(id);
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = logOutreachSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = await params;
  try {
    const activity = await logOutreachActivity({
      dealId: id,
      channel: parsed.data.channel,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes,
      nextFollowUpDate: parsed.data.nextFollowUpDate,
      contactedBy: session.user.id,
    });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
