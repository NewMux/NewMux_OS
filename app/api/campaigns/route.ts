import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessGrowth } from "@/lib/rbac";
import { createCampaignSchema } from "@/lib/validators/campaign";
import { createCampaign, listCampaigns } from "@/lib/data/campaigns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessGrowth(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessGrowth(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const campaign = await createCampaign({ ...parsed.data, createdBy: session.user.id });
  return NextResponse.json({ campaign }, { status: 201 });
}
