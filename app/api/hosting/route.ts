import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createHostingSubscriptionSchema } from "@/lib/validators/hosting";
import {
  listHostingSubscriptions,
  createHostingSubscription,
} from "@/lib/data/hosting";
import { majorToMinorUnits } from "@/lib/money";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const subscriptions = await listHostingSubscriptions();
  return NextResponse.json({ subscriptions });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const body = await req.json();
  const parsed = createHostingSubscriptionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const subscription = await createHostingSubscription({
    clientId: parsed.data.clientId,
    item: parsed.data.item,
    amountCents: majorToMinorUnits(parsed.data.amount, parsed.data.currency),
    currency: parsed.data.currency,
    cycle: parsed.data.cycle,
  });
  return NextResponse.json({ subscription }, { status: 201 });
});
