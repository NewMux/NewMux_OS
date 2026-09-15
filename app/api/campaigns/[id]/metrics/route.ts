import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessGrowth } from "@/lib/rbac";
import { addMetricSchema } from "@/lib/validators/campaign";
import { addCampaignMetric } from "@/lib/data/campaigns";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessGrowth(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = addMetricSchema.safeParse({ ...body, campaignId: id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const metric = await addCampaignMetric(parsed.data);
  return NextResponse.json({ metric }, { status: 201 });
}
