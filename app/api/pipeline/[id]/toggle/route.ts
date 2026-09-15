import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { togglePipelineStage } from "@/lib/data/pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const item = await togglePipelineStage(id);
  return NextResponse.json({ item });
}
