import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { createDocumentSchema } from "@/lib/validators/document";
import { createDocument, listDocuments } from "@/lib/data/documents";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type");
  const docs = await listDocuments(type ? { type: type as "quote" | "contract" | "invoice" } : undefined);
  return NextResponse.json({ documents: docs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const doc = await createDocument({ ...parsed.data, createdBy: session.user.id });
  return NextResponse.json({ document: doc }, { status: 201 });
}
