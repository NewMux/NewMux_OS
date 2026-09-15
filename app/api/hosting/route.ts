import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createHostingSubscriptionSchema } from "@/lib/validators/hosting";
import { listHostingSubscriptions, createHostingSubscription } from "@/lib/data/hosting";
import { majorToMinorUnits } from "@/lib/money";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const subscriptions = await listHostingSubscriptions();
  return NextResponse.json({ subscriptions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createHostingSubscriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const subscription = await createHostingSubscription({
    clientId: parsed.data.clientId,
    item: parsed.data.item,
    amountCents: majorToMinorUnits(parsed.data.amount, parsed.data.currency),
    currency: parsed.data.currency,
    cycle: parsed.data.cycle,
  });
  return NextResponse.json({ subscription }, { status: 201 });
}
