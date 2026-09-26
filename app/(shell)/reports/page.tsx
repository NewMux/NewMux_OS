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
import { listDocuments } from "@/lib/data/documents";
import { listPipelineItems } from "@/lib/data/pipeline";
import { getSetting } from "@/lib/data/settings";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { plural } from "@/lib/utils";

export const metadata = { title: "Reports" };

const EXPORTS = [
  { type: "project-profit", label: "Profit & loss by project", pdf: true },
  { type: "partner-profit", label: "Profit by partner", pdf: true },
  { type: "invoice-status", label: "Invoice status", pdf: true },
  { type: "cash-flow", label: "Cash flow — 12 months", pdf: false },
  { type: "expenses", label: "All expenses", pdf: false },
  { type: "payouts", label: "Partner payouts", pdf: false },
];

export default async function ReportsPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const [projects, partners, invoices, hosting, audit, pipeline, checklist, unpaidPaid] = await Promise.all([
    getProfitByProjectReport(),
    getProfitByPartnerReport(),
    getInvoiceStatusReport(),
    getHostingFeeReport(),
    listAuditLog(25),
    listPipelineItems(),
    getSetting<string[]>("notion_migration_checklist", []),
    listDocuments({ type: "invoice" }).then((docs) => docs.filter((d) => (d.status === "paid" || d.status === "archived") && d.paidCents < d.totalCents - d.creditedCents)),
  ]);

  return (
    <Page title="Reports" back={{ href: "/finance", label: "Finance" }} subtitle="All amounts in BHD">
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Widget title="Paid">
          <Metric value={compactMoney(invoices.paidBhdCents)} caption={plural(invoices.paidCount, "invoice")} />
        </Widget>
        <Widget title="Partly paid">
          <Metric value={compactMoney(invoices.partialOutstandingBhdCents)} caption={`${invoices.partialCount} outstanding`} />
        </Widget>
        <Widget title="Unpaid">
          <Metric value={compactMoney(invoices.unpaidBhdCents)} caption={plural(invoices.unpaidCount, "invoice")} />
        </Widget>
        <Widget title="Overdue">
          <Metric value={compactMoney(invoices.overdueBhdCents)} caption={plural(invoices.overdueCount, "invoice")} />
        </Widget>
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          {unpaidPaid.length > 0 && (
            <ListSection
              header="Check these invoices"
              info="Marked paid before payments were required to cover the total. Record the missing payments (dated when the money arrived), or void the invoice if it wasn't real."
            >
              {unpaidPaid.map((d) => (
                <ListRow
                  key={d.id}
                  href={`/documents/${d.id}`}
                  title={`${d.documentNumber}${d.externalRef ? ` (${d.externalRef})` : ""}`}
                  subtitle={`${d.clientName} · ${centsToDisplay(d.paidCents, d.currency)} of ${centsToDisplay(d.totalCents - d.creditedCents, d.currency)} recorded`}
                  detail={<span className="text-ios-orange">Paid without payments</span>}
                />
              ))}
            </ListSection>
          )}
          <ListSection
            header="Profit & Loss by Project"
            info="Revenue is invoiced (less credit notes). Costs are expenses linked to the project or its invoices, counted once, plus split-rule deductions that are costs. Money set aside for the reserve is part of profit."
          >
            {projects.map((p) => (
              <ListRow
                key={p.projectId}
                href={`/projects/${p.projectId}`}
                title={p.projectName}
                subtitle={`Revenue ${centsToDisplay(p.revenueBhdCents, "BHD")} · Costs ${centsToDisplay(p.costsBhdCents, "BHD")}${p.reserveBhdCents ? ` · Reserve ${centsToDisplay(p.reserveBhdCents, "BHD")}` : ""}`}
                multiline
                detail={<span className={p.netProfitBhdCents < 0 ? "text-ios-red" : "text-label"}>{centsToDisplay(p.netProfitBhdCents, "BHD")}</span>}
              />
            ))}
            {projects.length === 0 && <ListRow title="No invoiced projects yet" />}
          </ListSection>
          <ListSection header="Profit by Partner" info="Entitled on every issued invoice, what's been paid, and what remains. Funds show what was set aside, spent and left.">
            {partners.map((p) => (
              <ListRow
                key={p.partyId}
                href={`/finance/partners/${p.partyId}`}
                title={p.partyName}
                subtitle={`${p.kind === "fund" ? "Set aside" : "Entitled"} ${centsToDisplay(p.totalBhdCents, "BHD")} · ${p.kind === "fund" ? "Spent" : "Paid"} ${centsToDisplay(p.paidBhdCents, "BHD")}`}
                detail={centsToDisplay(p.remainingBhdCents, "BHD")}
              />
            ))}
          </ListSection>
          <ListSection header="Hosting Fees" info="Collected: payments this year on invoices billed for a hosting fee.">
            <ListRow title="Collected this year" detail={centsToDisplay(hosting.collectedBhdCents, "BHD")} />
            <ListRow title="Due this cycle" detail={centsToDisplay(hosting.dueBhdCents, "BHD")} />
            <ListRow title="Annualized" detail={centsToDisplay(hosting.annualizedBhdCents, "BHD")} />
          </ListSection>
          <ListSection header="Export" info="CSV opens in Numbers or Excel. PDF is formatted for sharing with the accountant.">
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
          <ListSection header="Audit Log" info="Every change to invoices, payments, payouts, accounts, expenses, deals and split rules.">
            {audit.map((a) => (
              <ListRow key={a.id} title={a.summary} subtitle={`${a.changedByName ?? "System"} · ${timeAgo(a.changedAt)}`} multiline />
            ))}
          </ListSection>
        </div>
      </div>
    </Page>
  );
}
