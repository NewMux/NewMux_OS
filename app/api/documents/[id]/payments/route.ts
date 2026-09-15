import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  notFound,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { addPaymentSchema } from "@/lib/validators/finance";
import { addPayment, listPaymentsForDocument } from "@/lib/data/finance";
import { getDocumentById } from "@/lib/data/documents";
import { majorToMinorUnits } from "@/lib/money";

export const GET = withRoute(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessDocuments(session)) return forbidden();

    const { id } = await params;
    const payments = await listPaymentsForDocument(id);
    return NextResponse.json({ payments });
  },
);

export const POST = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessDocuments(session)) return forbidden();

    const { id } = await params;
    const doc = await getDocumentById(id);
    if (!doc) return notFound();
    if (doc.type !== "invoice")
      return NextResponse.json(
        { error: "Only invoices accept payments" },
        { status: 400 },
      );

    const body = await req.json();
    const parsed = addPaymentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const payment = await addPayment({
      documentId: id,
      amountCents: majorToMinorUnits(parsed.data.amount, doc.currency),
      method: parsed.data.method,
      recordedBy: session.user.id,
    });
    return NextResponse.json({ payment }, { status: 201 });
  },
);
