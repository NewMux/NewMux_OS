import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import {
  getProfitByProjectReport,
  getProfitByPartnerReport,
  getInvoiceStatusReport,
  getHostingFeeReport,
  getCashFlowForecast,
} from "@/lib/data/reports";
import { listPipelineItems } from "@/lib/data/pipeline";
import { listAuditLog } from "@/lib/data/pipeline";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PipelineTracker } from "@/components/reports/PipelineTracker";
import { NotionMigrationChecklist } from "@/components/reports/NotionMigrationChecklist";
import { centsToDisplay } from "@/lib/money";
import { Download } from "lucide-react";

function ExportLink({ type }: { type: string }) {
  return (
    <div className="flex items-center gap-3">
      <a href={`/api/reports/export?type=${type}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
        <Download className="h-3 w-3" /> CSV
      </a>
      <a href={`/api/reports/pdf?type=${type}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
        <Download className="h-3 w-3" /> PDF
      </a>
    </div>
  );
}

export default async function ReportsPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const [projectProfit, partnerProfit, invoiceStatus, hostingFees, forecast, pipelineItems, auditLog] = await Promise.all([
    getProfitByProjectReport(),
    getProfitByPartnerReport(),
    getInvoiceStatusReport(),
    getHostingFeeReport(),
    getCashFlowForecast(),
    listPipelineItems(),
    listAuditLog(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Reports &amp; Export</h1>
      <p className="mb-4 text-xs text-muted-foreground">All figures rolled up to BHD via the fixed peg rate.</p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Profit &amp; Loss by Project</CardTitle>
          <ExportLink type="project-profit" />
        </CardHeader>
        {projectProfit.length === 0 && <p className="text-sm text-muted-foreground">No invoiced projects yet.</p>}
        <div className="flex flex-col gap-1">
          {projectProfit.map((r) => (
            <div key={r.projectId} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{r.projectName}</span>
              <span className="text-muted-foreground">
                {centsToDisplay(r.revenueBhdCents, "BHD")} rev · {centsToDisplay(r.netProfitBhdCents, "BHD")} net
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Profit Distribution by Partner</CardTitle>
          <ExportLink type="partner-profit" />
        </CardHeader>
        {partnerProfit.length === 0 && <p className="text-sm text-muted-foreground">Nothing distributed yet.</p>}
        <div className="flex flex-col gap-1">
          {partnerProfit.map((r) => (
            <div key={r.partyId} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{r.partyName}</span>
              <span className="font-medium text-foreground">{centsToDisplay(r.totalBhdCents, "BHD")}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Invoice Status</CardTitle>
          <ExportLink type="invoice-status" />
        </CardHeader>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="font-medium text-foreground">
              {invoiceStatus.paidCount} · {centsToDisplay(invoiceStatus.paidBhdCents, "BHD")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Partially paid</p>
            <p className="font-medium text-foreground">
              {invoiceStatus.partialCount} · {centsToDisplay(invoiceStatus.partialOutstandingBhdCents, "BHD")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unpaid</p>
            <p className="font-medium text-foreground">
              {invoiceStatus.unpaidCount} · {centsToDisplay(invoiceStatus.unpaidBhdCents, "BHD")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="font-medium text-danger">
              {invoiceStatus.overdueCount} · {centsToDisplay(invoiceStatus.overdueBhdCents, "BHD")}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Hosting Fees</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Collected to date</p>
            <p className="font-medium text-foreground">{centsToDisplay(hostingFees.collectedBhdCents, "BHD")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total active subscriptions</p>
            <p className="font-medium text-foreground">{centsToDisplay(hostingFees.dueBhdCents, "BHD")}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Cash Flow Forecast (next 3 months)</CardTitle>
        </CardHeader>
        <p className="mb-2 text-xs text-muted-foreground">
          Confirmed revenue only — outstanding invoice balances due in-month, plus scheduled hosting collections.
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {forecast.map((m) => (
            <div key={m.label}>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="font-medium text-foreground">{centsToDisplay(m.expectedBhdCents, "BHD")}</p>
            </div>
          ))}
        </div>
      </Card>

      <PipelineTracker items={pipelineItems} />

      <NotionMigrationChecklist />

      <Card>
        <CardHeader>
          <CardTitle>Financial Audit Log</CardTitle>
        </CardHeader>
        {auditLog.length === 0 && <p className="text-sm text-muted-foreground">No changes logged yet.</p>}
        <div className="flex flex-col gap-1">
          {auditLog.slice(0, 20).map((entry) => (
            <p key={entry.id} className="text-xs text-muted-foreground">
              {new Date(entry.changedAt).toLocaleString()} · {entry.summary}
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}
