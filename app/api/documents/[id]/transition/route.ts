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
import { transitionSchema, canTransition } from "@/lib/validators/document";
import {
  getDocumentById,
  transitionDocumentStatus,
} from "@/lib/data/documents";

export const POST = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessDocuments(session)) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const doc = await getDocumentById(id);
    if (!doc) return notFound();

    if (!canTransition(doc.status, parsed.data.to)) {
      return NextResponse.json(
        { error: `Cannot transition from ${doc.status} to ${parsed.data.to}` },
        { status: 400 },
      );
    }

    const updated = await transitionDocumentStatus(
      id,
      parsed.data.to,
      session.user.id,
    );
    return NextResponse.json({ document: updated });
  },
);
