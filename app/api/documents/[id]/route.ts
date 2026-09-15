import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { updateDocumentSchema } from "@/lib/validators/document";
import { getDocumentById, getLineItems, updateDocumentLineItems } from "@/lib/data/documents";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const lineItems = await getLineItems(id);
  return NextResponse.json({ document: doc, lineItems });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.lineItems) {
    const doc = await updateDocumentLineItems(id, parsed.data.lineItems);
    return NextResponse.json({ document: doc });
  }

  return NextResponse.json({ error: "no fields to update" }, { status: 400 });
}
