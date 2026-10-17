import { NextResponse, type NextRequest } from "next/server";
import { getSharedPdf } from "@/lib/data/officialDocs";

/**
 * The link sent to a client by email or WhatsApp: the issued PDF, exactly
 * as signed. Anyone with the link can open it (it's 48 random hex digits);
 * it stops working once the document is voided.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pdf = await getSharedPdf(token);
  if (pdf === "void") return new NextResponse("This document has been cancelled.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!pdf) return new NextResponse("Not found.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new NextResponse(pdf.data as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.number.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
