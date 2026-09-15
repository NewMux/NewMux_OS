import { NextResponse, type NextRequest } from "next/server";
import { apiError, forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import {
  getProfitByProjectReport,
  getProfitByPartnerReport,
  getInvoiceStatusReport,
} from "@/lib/data/reports";
import { toCsv } from "@/lib/csv";
import { centsToDisplay } from "@/lib/money";

export const GET = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const type = req.nextUrl.searchParams.get("type");
  let csv: string;
  let filename: string;

  if (type === "project-profit") {
    const rows = await getProfitByProjectReport();
    csv = toCsv(
      ["Project", "Revenue (BHD)", "Deductions (BHD)", "Net Profit (BHD)"],
      rows.map((r) => [
        r.projectName,
        centsToDisplay(r.revenueBhdCents, "BHD"),
        centsToDisplay(r.deductionsBhdCents, "BHD"),
        centsToDisplay(r.netProfitBhdCents, "BHD"),
      ]),
    );
    filename = "profit-by-project.csv";
  } else if (type === "partner-profit") {
    const rows = await getProfitByPartnerReport();
    csv = toCsv(
      ["Partner", "Total Profit Share (BHD)"],
      rows.map((r) => [r.partyName, centsToDisplay(r.totalBhdCents, "BHD")]),
    );
    filename = "profit-by-partner.csv";
  } else if (type === "invoice-status") {
    const r = await getInvoiceStatusReport();
    csv = toCsv(
      ["Status", "Count", "Amount (BHD)"],
      [
        ["Paid", r.paidCount, centsToDisplay(r.paidBhdCents, "BHD")],
        [
          "Partially Paid",
          r.partialCount,
          centsToDisplay(r.partialOutstandingBhdCents, "BHD"),
        ],
        ["Unpaid", r.unpaidCount, centsToDisplay(r.unpaidBhdCents, "BHD")],
        ["Overdue", r.overdueCount, centsToDisplay(r.overdueBhdCents, "BHD")],
      ],
    );
    filename = "invoice-status.csv";
  } else {
    return apiError("validation", "Unknown report type.");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
