import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { createDeductionTypeSchema } from "@/lib/validators/finance";
import { listDeductionTypes, createDeductionType } from "@/lib/data/finance";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const types = await listDeductionTypes();
  return NextResponse.json({ deductionTypes: types });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessSettings(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createDeductionTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const type = await createDeductionType(parsed.data.name, parsed.data.kind);
  return NextResponse.json({ deductionType: type }, { status: 201 });
}
