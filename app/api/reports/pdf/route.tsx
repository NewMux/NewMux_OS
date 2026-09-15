import { NextResponse, type NextRequest } from "next/server";
import { apiError, forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import {
  getProfitByProjectReport,
  getProfitByPartnerReport,
  getInvoiceStatusReport,
} from "@/lib/data/reports";
import { ReportPdf } from "@/lib/pdf/templates/ReportPdf";
import { centsToDisplay } from "@/lib/money";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const type = req.nextUrl.searchParams.get("type");
  let title: string;
  let headers: string[];
  let rows: (string | number)[][];
  let filename: string;

  if (type === "project-profit") {
    const data = await getProfitByProjectReport();
    title = "Profit & Loss by Project";
    headers = ["Project", "Revenue", "Deductions", "Net Profit"];
    rows = data.map((r) => [
      r.projectName,
      centsToDisplay(r.revenueBhdCents, "BHD"),
      centsToDisplay(r.deductionsBhdCents, "BHD"),
      centsToDisplay(r.netProfitBhdCents, "BHD"),
    ]);
    filename = "profit-by-project.pdf";
  } else if (type === "partner-profit") {
    const data = await getProfitByPartnerReport();
    title = "Profit Distribution by Partner";
    headers = ["Partner", "Total Share"];
    rows = data.map((r) => [
      r.partyName,
      centsToDisplay(r.totalBhdCents, "BHD"),
    ]);
    filename = "profit-by-partner.pdf";
  } else if (type === "invoice-status") {
    const r = await getInvoiceStatusReport();
    title = "Invoice Status";
    headers = ["Status", "Count", "Amount"];
    rows = [
      ["Paid", r.paidCount, centsToDisplay(r.paidBhdCents, "BHD")],
      [
        "Partially Paid",
        r.partialCount,
        centsToDisplay(r.partialOutstandingBhdCents, "BHD"),
      ],
      ["Unpaid", r.unpaidCount, centsToDisplay(r.unpaidBhdCents, "BHD")],
      ["Overdue", r.overdueCount, centsToDisplay(r.overdueBhdCents, "BHD")],
    ];
    filename = "invoice-status.pdf";
  } else {
    return apiError("validation", "Unknown report type.");
  }

  const buffer = await renderToBuffer(
    <ReportPdf title={title} headers={headers} rows={rows} />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
