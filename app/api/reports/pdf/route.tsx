import { NextResponse, type NextRequest } from "next/server";
import { apiError, forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { getReportDefinition } from "@/lib/reports/registry";
import { ReportPdf } from "@/lib/pdf/templates/ReportPdf";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();

  const definition = getReportDefinition(req.nextUrl.searchParams.get("type"));
  if (!definition) return apiError("validation", "Unknown report type.");
  if (!definition.can(session)) return forbidden();

  const table = await definition.build(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  const buffer = await renderToBuffer(
    <ReportPdf title={table.title} headers={table.headers} rows={table.rows} />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${table.filename}.pdf"`,
    },
  });
});
