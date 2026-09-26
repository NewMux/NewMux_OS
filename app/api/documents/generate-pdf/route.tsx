import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { getDocumentById, getLineItems, getClientById } from "@/lib/data/documents";
import { DocumentPdf } from "@/lib/pdf/templates/DocumentPdf";

export const runtime = "nodejs";

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

  const buffer = await renderToBuffer(<DocumentPdf document={document} lineItems={lineItems} client={client} creditFor={creditFor} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.documentNumber}.pdf"`,
    },
  });
}
