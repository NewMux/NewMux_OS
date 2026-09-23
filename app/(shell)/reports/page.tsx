import { redirect } from "next/navigation";
import { Download, FileDown } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Widget, Metric } from "@/components/ui/Widget";
import { MigrationChecklist, PipelineTracker } from "@/components/reports/ReportWidgets";
import { getHostingFeeReport, getInvoiceStatusReport, getProfitByPartnerReport, getProfitByProjectReport } from "@/lib/data/reports";
import { listAuditLog } from "@/lib/data/audit";
import { listPipelineItems } from "@/lib/data/pipeline";
import { getSetting } from "@/lib/data/settings";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Reports" };

const EXPORTS = [
  { type: "project-profit", label: "Profit & loss by project", pdf: true },
  { type: "partner-profit", label: "Profit by partner", pdf: true },
  { type: "invoice-status", label: "Invoice status", pdf: true },
  { type: "cash-flow", label: "Cash flow — 12 months", pdf: false },
  { type: "expenses", label: "All expenses", pdf: false },
];

export default async function ReportsPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const [projects, partners, invoices, hosting, audit, pipeline, checklist] = await Promise.all([
    getProfitByProjectReport(),
    getProfitByPartnerReport(),
    getInvoiceStatusReport(),
    getHostingFeeReport(),
    listAuditLog(25),
    listPipelineItems(),
    getSetting<string[]>("notion_migration_checklist", []),
  ]);

  return (
    <Page title="Reports" back={{ href: "/finance", label: "Finance" }} subtitle="All amounts in BHD">
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Widget title="Paid">
          <Metric value={compactMoney(invoices.paidBhdCents)} caption={`${invoices.paidCount} invoices`} />
        </Widget>
        <Widget title="Partly paid">
          <Metric value={compactMoney(invoices.partialOutstandingBhdCents)} caption={`${invoices.partialCount} outstanding`} />
        </Widget>
        <Widget title="Unpaid">
          <Metric value={compactMoney(invoices.unpaidBhdCents)} caption={`${invoices.unpaidCount} invoices`} />
        </Widget>
        <Widget title="Overdue">
          <Metric value={compactMoney(invoices.overdueBhdCents)} caption={`${invoices.overdueCount} invoices`} />
        </Widget>
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection header="Profit & Loss by Project">
            {projects.map((p) => (
              <ListRow
                key={p.projectId}
                href={`/projects/${p.projectId}`}
                title={p.projectName}
                subtitle={`Revenue ${centsToDisplay(p.revenueBhdCents, "BHD")} · Costs ${centsToDisplay(p.deductionsBhdCents, "BHD")}`}
                detail={<span className={p.netProfitBhdCents < 0 ? "text-ios-red" : "text-label"}>{centsToDisplay(p.netProfitBhdCents, "BHD")}</span>}
              />
            ))}
            {projects.length === 0 && <ListRow title="No invoiced projects yet" />}
          </ListSection>
          <ListSection header="Profit by Partner">
            {partners.map((p) => (
              <ListRow key={p.partyId} title={p.partyName} detail={centsToDisplay(p.totalBhdCents, "BHD")} />
            ))}
          </ListSection>
          <ListSection header="Hosting Fees">
            <ListRow title="Collected this year" detail={centsToDisplay(hosting.collectedBhdCents, "BHD")} />
            <ListRow title="Due this cycle" detail={centsToDisplay(hosting.dueBhdCents, "BHD")} />
            <ListRow title="Annualized" detail={centsToDisplay(hosting.annualizedBhdCents, "BHD")} />
          </ListSection>
          <ListSection header="Export" footer="CSV opens in Numbers or Excel. PDF is formatted for sharing with the accountant.">
            {EXPORTS.map((e) => (
              <ListRow
                key={e.type}
                leading={<IconTile icon={FileDown} color="indigo" />}
                title={e.label}
                trailing={
                  <span className="flex gap-3 text-subhead">
                    <a href={`/api/reports/export?type=${e.type}`} download className="flex items-center gap-1 text-accent">
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </a>
                    {e.pdf && (
                      <a href={`/api/reports/pdf?type=${e.type}`} download className="flex items-center gap-1 text-accent">
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    )}
                  </span>
                }
              />
            ))}
          </ListSection>
        </div>
        <div>
          <PipelineTracker items={pipeline} />
          <MigrationChecklist initial={checklist} />
          <ListSection header="Audit Log" footer="Every change to invoices, payments, expenses, deals and split rules.">
            {audit.map((a) => (
              <ListRow key={a.id} title={a.summary} subtitle={`${a.changedByName ?? "System"} · ${timeAgo(a.changedAt)}`} multiline />
            ))}
          </ListSection>
        </div>
      </div>
    </Page>
  );
}
