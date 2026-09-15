import { NextResponse } from "next/server";
import { forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { convertQuotationToInvoice } from "@/lib/data/finance";

export const POST = withRoute(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessDocuments(session)) return forbidden();

    const { id } = await params;
    const invoice = await convertQuotationToInvoice(id, session.user.id);
    return NextResponse.json({ invoice }, { status: 201 });
  },
);
