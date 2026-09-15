import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import {
  getMrrArrCents,
  getSubscriberBreakdown,
  getCashFlowCents,
  getActiveDeliveryIndex,
  listProductsForScopeSwitcher,
} from "@/lib/data/metrics";
import { getErpDashboardSummary } from "@/lib/data/finance";
import { getDashboardAlerts } from "@/lib/data/alerts";
import { centsToDisplay } from "@/lib/money";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProductScopeSwitcher } from "@/components/dashboard/ProductScopeSwitcher";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const session = await auth();
  const { product } = await searchParams;
  const canSeeFinancials = canAccessDocuments(session);

  const { mrrCents, arrCents } = getMrrArrCents(product);
  const subscribers = getSubscriberBreakdown();
  const cashFlow = getCashFlowCents();
  const deliveryIndex = await getActiveDeliveryIndex();
  const products = listProductsForScopeSwitcher();
  const erpSummary = canSeeFinancials ? await getErpDashboardSummary() : null;
  const alerts = await getDashboardAlerts();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          Executive Command Center
        </h1>
        <ProductScopeSwitcher products={products} />
      </div>

      <AlertsPanel alerts={alerts} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="MRR"
          value={centsToDisplay(mrrCents)}
          sub="Active SaaS subscriptions, USD"
        />
        <StatCard title="ARR" value={centsToDisplay(arrCents)} sub="MRR × 12" />
        <StatCard
          title="Active Delivery Index"
          value={String(deliveryIndex)}
          sub="Projects in active sprint"
        />
        <StatCard
          title="Subscribers"
          value={String(
            subscribers.paying + subscribers.trialing + subscribers.pastDue,
          )}
          sub={`${subscribers.paying} paying · ${subscribers.trialing} trialing · ${subscribers.pastDue} past due`}
        />
      </div>

      {erpSummary && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Finance (PRD section 4 daily summary)</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Unpaid / partially paid invoices
              </p>
              <p className="text-lg font-semibold text-foreground">
                {erpSummary.unpaidInvoiceCount +
                  erpSummary.partiallyPaidInvoiceCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Outstanding balance from clients
              </p>
              <p className="text-lg font-semibold text-foreground">
                {centsToDisplay(erpSummary.totalOutstandingBhdCents, "BHD")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Net profit this month
              </p>
              <p className="text-lg font-semibold text-foreground">
                {centsToDisplay(erpSummary.netProfitThisMonthBhdCents, "BHD")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {canSeeFinancials ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Agency Cash Flow (USD, legacy)</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Cash collected</p>
              <p className="text-lg font-semibold text-foreground">
                {centsToDisplay(cashFlow.cashCollected)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Pending quote pipeline
              </p>
              <p className="text-lg font-semibold text-foreground">
                {centsToDisplay(cashFlow.pendingQuotePipeline)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Outstanding invoices
              </p>
              <p className="text-lg font-semibold text-foreground">
                {centsToDisplay(cashFlow.outstandingInvoices)}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mt-4 text-sm text-muted-foreground">
          Agency cash flow is visible to Partner/Admin accounts only.
        </Card>
      )}
    </div>
  );
}
