import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { getDocumentById, getLineItems, getClientById } from "@/lib/data/documents";
import type { DocumentPdfData } from "@/lib/pdf/download";

/**
 * Data for a document's PDF. The browser renders the PDF itself
 * (lib/pdf/download.tsx): Cloudflare Workers can't run @react-pdf's
 * WebAssembly layout engine, and rendering there would eat the CPU budget.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessDocuments(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const document = await getDocumentById(id);
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [lineItems, client, credited] = await Promise.all([
    getLineItems(id),
    getClientById(document.clientId),
    document.creditForId ? getDocumentById(document.creditForId) : undefined,
  ]);
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
  const creditFor = credited ? `${credited.documentNumber}${credited.externalRef ? ` (${credited.externalRef})` : ""}` : null;

  const data: DocumentPdfData = { kind: "document", filename: `${document.documentNumber}.pdf`, document, lineItems, client, creditFor };
  return NextResponse.json(data);
}
