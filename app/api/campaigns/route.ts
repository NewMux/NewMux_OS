import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessGrowth } from "@/lib/rbac";
import { createCampaignSchema } from "@/lib/validators/campaign";
import { createCampaign, listCampaigns } from "@/lib/data/campaigns";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessGrowth(session)) return forbidden();

  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessGrowth(session)) return forbidden();

  const body = await req.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const campaign = await createCampaign({
    ...parsed.data,
    createdBy: session.user.id,
  });
  return NextResponse.json({ campaign }, { status: 201 });
});
