import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { collectHostingFee } from "@/lib/data/hosting";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const result = await collectHostingFee(id, session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
