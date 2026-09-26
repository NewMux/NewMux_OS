import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getProfitByProjectReport, getProfitByPartnerReport, getInvoiceStatusReport, getMonthlyCashFlow } from "@/lib/data/reports";
import { listExpenses } from "@/lib/data/expenses";
import { toCsv } from "@/lib/csv";
import { centsToDisplay } from "@/lib/money";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAccessFinance(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type");
  let csv: string;
  let filename: string;

  if (type === "project-profit") {
    const rows = await getProfitByProjectReport();
    csv = toCsv(
      ["Project", "Revenue (BHD)", "Costs (BHD)", "Net Profit (BHD)"],
      rows.map((r) => [r.projectName, centsToDisplay(r.revenueBhdCents, "BHD"), centsToDisplay(r.costsBhdCents, "BHD"), centsToDisplay(r.netProfitBhdCents, "BHD")]),
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
        ["Partially Paid", r.partialCount, centsToDisplay(r.partialOutstandingBhdCents, "BHD")],
        ["Unpaid", r.unpaidCount, centsToDisplay(r.unpaidBhdCents, "BHD")],
        ["Overdue", r.overdueCount, centsToDisplay(r.overdueBhdCents, "BHD")],
      ],
    );
    filename = "invoice-status.csv";
  } else if (type === "cash-flow") {
    const months = await getMonthlyCashFlow(12);
    csv = toCsv(
      ["Month", "In (BHD)", "Out (BHD)", "Net (BHD)"],
      months.map((m) => [m.month, centsToDisplay(m.inBhdCents, "BHD"), centsToDisplay(m.outBhdCents, "BHD"), centsToDisplay(m.inBhdCents - m.outBhdCents, "BHD")]),
    );
    filename = "cash-flow-12-months.csv";
  } else if (type === "expenses") {
    const rows = await listExpenses();
    csv = toCsv(
      ["Date", "Description", "Category", "Vendor", "Amount", "Currency", "Client", "Project"],
      rows.map((e) => [e.spentOn, e.description, e.category, e.vendor ?? "", centsToDisplay(e.amountCents, e.currency), e.currency, e.clientName ?? "", e.projectName ?? ""]),
    );
    filename = "expenses.csv";
  } else {
    return NextResponse.json({ error: "unknown report type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
