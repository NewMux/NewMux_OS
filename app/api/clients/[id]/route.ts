import { NextResponse, type NextRequest } from "next/server";
import {
  conflict,
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { updateClientSchema, archiveSchema } from "@/lib/validators/client";
import {
  updateClient,
  deleteClient,
  setClientArchived,
  getClientById,
} from "@/lib/data/documents";
import { getReferences, describeReferences } from "@/lib/data/integrity";

export const PATCH = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const body = await req.json();

    // Archive/restore is a PATCH too, distinguished by carrying only `archived`.
    const archive = archiveSchema.safeParse(body);
    if (archive.success) {
      const client = await setClientArchived(id, archive.data.archived);
      return NextResponse.json({ client });
    }

    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const client = await updateClient(id, parsed.data);
    return NextResponse.json({ client });
  },
);

export const DELETE = withRoute(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const client = await getClientById(id);
    if (!client) return NextResponse.json({ ok: true });

    // Refuse rather than orphan: this is an accounting system and the linked
    // invoices are the record of what was billed.
    const references = getReferences("client", id);
    if (references.length > 0) {
      return conflict(
        `${client.name} still has linked records. Archive it instead to keep the history.`,
        {
          references: describeReferences(references),
        },
      );
    }

    await deleteClient(id);
    return NextResponse.json({ ok: true });
  },
);
