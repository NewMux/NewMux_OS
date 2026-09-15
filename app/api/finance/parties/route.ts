import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { createPartySchema } from "@/lib/validators/finance";
import { listParties, createParty } from "@/lib/data/finance";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parties = await listParties();
  return NextResponse.json({ parties });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSettings(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createPartySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const party = await createParty(parsed.data.name);
  return NextResponse.json({ party }, { status: 201 });
}
