import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { canAccessDocuments } from "@/lib/rbac";
import { getIssuedPdf } from "@/lib/data/officialDocs";
import { NotFoundError } from "@/lib/data/sql";

/** The issued PDF, as signed (partners only: it carries the signature). */
export const GET = route<{ id: string }>({ allow: canAccessDocuments }, async ({ params, req }) => {
  const pdf = await getIssuedPdf(params.id);
  if (!pdf) throw new NotFoundError("Issued PDF");
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(pdf.data as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.number.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-SHA256": pdf.sha256,
    },
  });
});
