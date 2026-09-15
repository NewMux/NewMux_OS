import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { transitionSchema, canTransition } from "@/lib/validators/document";
import { getDocumentById, transitionDocumentStatus } from "@/lib/data/documents";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const doc = await getDocumentById(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!canTransition(doc.status, parsed.data.to)) {
    return NextResponse.json(
      { error: `Cannot transition from ${doc.status} to ${parsed.data.to}` },
      { status: 400 },
    );
  }

  const updated = await transitionDocumentStatus(id, parsed.data.to, session.user.id);
  return NextResponse.json({ document: updated });
}
