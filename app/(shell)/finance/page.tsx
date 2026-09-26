import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { ListRow, ListSection, SectionLink } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { SummaryCard } from "@/components/ui/Widget";
import { CashFlowChart } from "@/components/finance/CashFlowChart";
import { BalanceCard } from "@/components/finance/BalanceCard";
import { FundRows, PartnerRows } from "@/components/finance/PartnerRows";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { getErpDashboardSummary } from "@/lib/data/finance";
import { getCompanyBalanceBhd, getAccountBalances, getPartyBalances } from "@/lib/data/ledger";
import { getArAging, getCashFlowForecast, getMonthlyCashFlow } from "@/lib/data/reports";
import { listHostingAlerts } from "@/lib/data/hosting";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { plural } from "@/lib/utils";

export const metadata = { title: "Finance" };

/** Numbers first (item 27): the balance, what's owed each way, the reserve; the chart after. */
export default async function FinancePage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");

  const [summary, accounts, company, parties, months, aging, forecast, hostingAlerts] = await Promise.all([
    getErpDashboardSummary(),
    getAccountBalances(),
    getCompanyBalanceBhd(),
    getPartyBalances(),
    getMonthlyCashFlow(12),
    getArAging(),
    getCashFlowForecast(3),
    listHostingAlerts(),
  ]);
  const totalAr = aging.reduce((s, b) => s + b.bhdCents, 0);
  const owedToPartners = parties.partners.reduce((s, p) => s + Math.max(p.remainingBhdCents, 0), 0);
  const reserve = parties.funds[0];

  return (
    <Page title="Finance" actions={<QuickAddMenu role="partner_admin" />}>
      <BalanceCard accounts={accounts} totalBhdCents={company?.balanceBhdCents ?? null} />

      <SummaryCard
        items={[
          { label: "Owed by clients", value: compactMoney(totalAr), caption: plural(summary.unpaidInvoiceCount + summary.partiallyPaidInvoiceCount, "invoice"), href: "/documents?type=invoice&status=unpaid" },
          { label: "Owed to partners", value: compactMoney(owedToPartners), caption: "shares and costs", href: "/finance/partners" },
          ...(reserve ? [{ label: reserve.party.name, value: compactMoney(reserve.balanceBhdCents), caption: "available", href: `/finance/partners/${reserve.party.id}` }] : []),
          {
            label: "Profit this month",
            value: compactMoney(summary.netProfitThisMonthBhdCents),
            caption: "invoices issued",
            href: "/reports",
            tone: summary.netProfitThisMonthBhdCents < 0 ? ("negative" as const) : undefined,
          },
        ]}
      />

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection
            variant="prominent"
            header="Partners"
            info="Entitled is each partner's share of profit on every issued invoice. Paid counts shares, advances and withdrawals. Remaining is what the company still owes them, including costs they paid personally."
            action={<SectionLink href="/finance/partners">Payouts</SectionLink>}
          >
            <PartnerRows partners={parties.partners} />
            {parties.partners.length === 0 && <ListRow title="No partners yet" href="/settings#parties" />}
          </ListSection>
          {parties.funds.length > 0 && (
            <ListSection variant="prominent" header="Reserve" info="Set aside by split-rule deductions that feed the fund, less expenses charged to it.">
              <FundRows funds={parties.funds} />
            </ListSection>
          )}
          <ListSection
            variant="prominent"
            header="Receivables"
            info="Open invoice balances by how late they are."
            action={<SectionLink href="/documents?type=invoice&status=unpaid">Invoices</SectionLink>}
          >
            {aging.map((b, i) =>
              b.count === 0 && i > 0 ? null : (
                <ListRow
                  key={b.label}
                  href="/documents?type=invoice&status=unpaid"
                  title={b.label}
                  subtitle={plural(b.count, "invoice")}
                  detail={<span className={i >= 2 ? "text-ios-red" : undefined}>{centsToDisplay(b.bhdCents, "BHD")}</span>}
                />
              ),
            )}
          </ListSection>
        </div>

        <div>
          <ListSection variant="prominent" header="Coming Up" info="Open invoice balances due and scheduled hosting fees in; recurring expenses out. Tap a month to see what makes it up.">
            {forecast.map((f) => (
              <ListRow
                key={f.month}
                href={`/finance/forecast/${f.month}`}
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

          <ListSection variant="prominent" header="Manage">
            <ListRow href="/documents" title="Documents" subtitle="Invoices, quotes, contracts, credit notes" />
            <ListRow href="/finance/expenses" title="Expenses" />
            <ListRow href="/finance/partners" title="Partner Payouts" />
            <ListRow
              href="/hosting"
              title="Hosting Fees"
              trailing={hostingAlerts.length > 0 ? <Badge color={hostingAlerts.some((a) => a.level === "overdue") ? "red" : "orange"}>{hostingAlerts.length} due</Badge> : undefined}
            />
            <ListRow href="/reports" title="Reports & Export" />
            <ListRow href="/settings#splits" title="Profit-Split Rules" />
          </ListSection>
        </div>
      </div>

      <ListSection variant="prominent" header="Cash Flow" info="Money in (payments received) and out (expenses paid by the company, partner payouts, refunds) per month.">
        <Card>
          <CashFlowChart months={months} />
        </Card>
      </ListSection>
    </Page>
  );
}
