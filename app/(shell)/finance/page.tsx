import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, BarChart3, FileText, PieChart, Receipt, Server, Scale, TrendingUp, Landmark } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Widget, Metric } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { CashFlowChart } from "@/components/finance/CashFlowChart";
import { getErpDashboardSummary } from "@/lib/data/finance";
import { getArAging, getCashFlowForecast, getMonthlyCashFlow, getProfitByPartnerReport } from "@/lib/data/reports";
import { listHostingAlerts } from "@/lib/data/hosting";
import { centsToDisplay, compactMoney } from "@/lib/money";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");

  const [summary, months, aging, partners, forecast, hostingAlerts] = await Promise.all([
    getErpDashboardSummary(),
    getMonthlyCashFlow(12),
    getArAging(),
    getProfitByPartnerReport(),
    getCashFlowForecast(),
    listHostingAlerts(),
  ]);
  const totalAr = aging.reduce((s, b) => s + b.bhdCents, 0);

  return (
    <Page title="Finance" subtitle="All figures in BHD · USD converted at the fixed peg">
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Widget title="Collected" icon={ArrowDownLeft} color="blue">
          <Metric value={compactMoney(summary.collectedThisMonthBhdCents)} caption="this month" />
        </Widget>
        <Widget title="Spent" icon={ArrowUpRight} color="orange" href="/finance/expenses">
          <Metric value={compactMoney(summary.spentThisMonthBhdCents)} caption="this month" />
        </Widget>
        <Widget title="Net Profit" icon={TrendingUp} color="green" href="/reports">
          <Metric
            value={compactMoney(summary.netProfitThisMonthBhdCents)}
            tone={summary.netProfitThisMonthBhdCents < 0 ? "negative" : undefined}
            caption="invoices issued this month"
          />
        </Widget>
        <Widget title="Receivables" icon={FileText} color="red" href="/documents?type=invoice">
          <Metric value={compactMoney(summary.totalOutstandingBhdCents)} caption={`${summary.unpaidInvoiceCount} unpaid · ${summary.partiallyPaidInvoiceCount} partial`} />
        </Widget>
      </div>

      <Card className="mb-7">
        <div className="mb-1 text-headline">Cash Flow</div>
        <p className="mb-3 text-footnote text-label-2">Payments received vs. expenses logged, last 12 months</p>
        <CashFlowChart months={months} />
      </Card>

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection header="Manage">
            <ListRow href="/documents" leading={<IconTile icon={FileText} color="green" />} title="Invoices & Quotes" />
            <ListRow href="/finance/expenses" leading={<IconTile icon={Receipt} color="orange" />} title="Expenses" />
            <ListRow
              href="/hosting"
              leading={<IconTile icon={Server} color="teal" />}
              title="Hosting Fees"
              trailing={hostingAlerts.length > 0 ? <Badge color={hostingAlerts.some((a) => a.level === "overdue") ? "red" : "orange"}>{hostingAlerts.length}</Badge> : undefined}
            />
            <ListRow href="/reports" leading={<IconTile icon={BarChart3} color="indigo" />} title="Reports & Export" />
            <ListRow href="/settings#splits" leading={<IconTile icon={PieChart} color="purple" />} title="Profit-Split Rules" />
          </ListSection>

          <ListSection header="Receivables Aging" footer={`${centsToDisplay(totalAr, "BHD")} outstanding in total`}>
            {aging.map((b, i) => (
              <ListRow
                key={b.label}
                leading={<IconTile icon={Scale} color={i === 0 ? "gray" : i === 1 ? "yellow" : i === 2 ? "orange" : "red"} size="sm" />}
                title={b.label}
                subtitle={`${b.count} invoice${b.count === 1 ? "" : "s"}`}
                detail={centsToDisplay(b.bhdCents, "BHD")}
              />
            ))}
          </ListSection>
        </div>

        <div>
          <ListSection header="Profit by Partner" footer="Net profit shares across all non-archived invoices with a split rule.">
            {partners.map((p) => (
              <ListRow key={p.partyId} leading={<IconTile icon={Landmark} color="green" size="sm" />} title={p.partyName} detail={centsToDisplay(p.totalBhdCents, "BHD")} />
            ))}
            {partners.length === 0 && <ListRow title="No split rules applied yet" />}
          </ListSection>

          <ListSection header="Forecast" footer="Open invoice balances + scheduled hosting fees in; active recurring expenses out.">
            {forecast.map((f) => (
              <ListRow
                key={f.label}
                title={f.label}
                subtitle={`In ${centsToDisplay(f.expectedBhdCents, "BHD")} · Out ${centsToDisplay(f.expectedOutBhdCents, "BHD")}`}
                detail={
                  <span className={f.expectedBhdCents - f.expectedOutBhdCents < 0 ? "text-ios-red" : "text-label"}>
                    {centsToDisplay(f.expectedBhdCents - f.expectedOutBhdCents, "BHD")}
                  </span>
                }
              />
            ))}
          </ListSection>
        </div>
      </div>
    </Page>
  );
}
