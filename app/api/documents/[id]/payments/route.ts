import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { addPaymentSchema } from "@/lib/validators/finance";
import { addPayment, listPaymentsForDocument } from "@/lib/data/finance";
import { getDocumentById } from "@/lib/data/documents";
import { majorToMinorUnits } from "@/lib/money";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const payments = await listPaymentsForDocument(id);
  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (doc.type !== "invoice") return NextResponse.json({ error: "Only invoices accept payments" }, { status: 400 });

  const body = await req.json();
  const parsed = addPaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payment = await addPayment({
    documentId: id,
    amountCents: majorToMinorUnits(parsed.data.amount, doc.currency),
    method: parsed.data.method,
    recordedBy: session.user.id,
  });
  return NextResponse.json({ payment }, { status: 201 });
}
