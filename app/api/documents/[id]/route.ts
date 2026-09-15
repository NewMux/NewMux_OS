import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  forbidden,
  notFound,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { updateDocumentSchema } from "@/lib/validators/document";
import {
  getDocumentById,
  getLineItems,
  updateDocumentLineItems,
} from "@/lib/data/documents";

export const GET = withRoute(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessDocuments(session)) return forbidden();

    const { id } = await params;
    const doc = await getDocumentById(id);
    if (!doc) return notFound();

    const lineItems = await getLineItems(id);
    return NextResponse.json({ document: doc, lineItems });
  },
);

export const PATCH = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessDocuments(session)) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    if (parsed.data.lineItems) {
      const doc = await updateDocumentLineItems(id, parsed.data.lineItems);
      return NextResponse.json({ document: doc });
    }

    return apiError("validation", "No fields to update.");
  },
);
