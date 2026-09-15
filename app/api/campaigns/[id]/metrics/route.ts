import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessGrowth } from "@/lib/rbac";
import { addMetricSchema } from "@/lib/validators/campaign";
import { addCampaignMetric } from "@/lib/data/campaigns";

export const POST = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessGrowth(session)) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = addMetricSchema.safeParse({ ...body, campaignId: id });
    if (!parsed.success) return validationError(parsed.error);

    const metric = await addCampaignMetric(parsed.data);
    return NextResponse.json({ metric }, { status: 201 });
  },
);
