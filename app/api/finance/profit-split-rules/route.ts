import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { upsertProfitSplitRuleSchema } from "@/lib/validators/finance";
import { listProfitSplitRules, upsertProfitSplitRule } from "@/lib/data/finance";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSettings(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rules = await listProfitSplitRules();
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSettings(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = upsertProfitSplitRuleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const rule = await upsertProfitSplitRule({ ...parsed.data, updatedBy: session.user.id });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
