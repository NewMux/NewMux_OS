import { NextRequest, NextResponse } from "next/server";
import { forbidden, notFound, unauthorized, withRoute } from "@/lib/api/errors";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import {
  getDocumentById,
  getLineItems,
  getClientById,
} from "@/lib/data/documents";
import { DocumentPdf } from "@/lib/pdf/templates/DocumentPdf";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessDocuments(session)) return forbidden();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const document = await getDocumentById(id);
  if (!document) return notFound();

  const [lineItems, client] = await Promise.all([
    getLineItems(id),
    getClientById(document.clientId),
  ]);
  if (!client)
    return NextResponse.json({ error: "client not found" }, { status: 404 });

  const buffer = await renderToBuffer(
    <DocumentPdf document={document} lineItems={lineItems} client={client} />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.documentNumber}.pdf"`,
    },
  });
});
