import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { CashFlowChart } from "@/components/finance/CashFlowChart";
import { getErpDashboardSummary } from "@/lib/data/finance";
import { getArAging, getCashFlowForecast, getMonthlyCashFlow, getProfitByPartnerReport } from "@/lib/data/reports";
import { listHostingAlerts } from "@/lib/data/hosting";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { plural } from "@/lib/utils";

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
    <Page title="Finance">
      <Card className="mb-7">
        <CashFlowChart months={months} />
      </Card>

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection
            header="Receivables"
            action={<Link href="/documents?type=invoice" className="text-subhead text-accent">Invoices</Link>}
            footer={`${centsToDisplay(totalAr, "BHD")} outstanding in total`}
          >
            {aging.map((b, i) => (b.count === 0 && i > 0 ? null : (
              <ListRow
                key={b.label}
                href="/documents?type=invoice"
                title={b.label}
                subtitle={plural(b.count, "invoice")}
                detail={<span className={i >= 2 ? "text-ios-red" : undefined}>{centsToDisplay(b.bhdCents, "BHD")}</span>}
              />
            )))}
          </ListSection>

          <ListSection header="Manage">
            <ListRow href="/documents" title="Invoices & Quotes" />
            <ListRow href="/finance/expenses" title="Expenses" />
            <ListRow
              href="/hosting"
              title="Hosting Fees"
              trailing={hostingAlerts.length > 0 ? <Badge color={hostingAlerts.some((a) => a.level === "overdue") ? "red" : "orange"}>{hostingAlerts.length} due</Badge> : undefined}
            />
            <ListRow href="/reports" title="Reports & Export" />
            <ListRow href="/settings#splits" title="Profit-Split Rules" />
          </ListSection>
        </div>

        <div>
          <ListSection header="Profit" footer="Net profit on invoices issued this month, and each partner's share across all invoices with a split rule.">
            <ListRow
              title="This month"
              detail={<span className={summary.netProfitThisMonthBhdCents < 0 ? "text-ios-red" : undefined}>{centsToDisplay(summary.netProfitThisMonthBhdCents, "BHD")}</span>}
            />
            {partners.map((p) => (
              <ListRow key={p.partyId} title={p.partyName} detail={centsToDisplay(p.totalBhdCents, "BHD")} />
            ))}
          </ListSection>

          <ListSection header="Forecast" footer="Open invoice balances and scheduled hosting fees in; recurring expenses out.">
            {forecast.map((f) => (
              <ListRow
                key={f.label}
                title={f.label}
                subtitle={`In ${compactMoney(f.expectedBhdCents)} · Out ${compactMoney(f.expectedOutBhdCents)}`}
                detail={
                  <span className={f.expectedBhdCents - f.expectedOutBhdCents < 0 ? "text-ios-red" : undefined}>
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
