import { NextResponse, type NextRequest } from "next/server";
import { apiError, forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { getReportDefinition } from "@/lib/reports/registry";
import { toCsv } from "@/lib/csv";

export const GET = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();

  const definition = getReportDefinition(req.nextUrl.searchParams.get("type"));
  if (!definition) return apiError("validation", "Unknown report type.");
  if (!definition.can(session)) return forbidden();

  const table = await definition.build(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  return new NextResponse(toCsv(table.headers, table.rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${table.filename}.csv"`,
    },
  });
});
