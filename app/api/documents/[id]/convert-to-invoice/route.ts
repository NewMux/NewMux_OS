import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { convertQuotationToInvoice } from "@/lib/data/finance";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const invoice = await convertQuotationToInvoice(id, session.user.id);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
