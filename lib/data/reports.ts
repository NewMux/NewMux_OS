import { store } from "./store";
import { getInvoiceProfitBreakdown } from "./finance";
import { convertMinorUnits } from "@/lib/money";

export type ProjectProfitRow = {
  projectId: string;
  projectName: string;
  revenueBhdCents: number;
  deductionsBhdCents: number;
  netProfitBhdCents: number;
};

export async function getProfitByProjectReport(): Promise<ProjectProfitRow[]> {
  const invoices = store.documents.filter((d) => d.type === "invoice" && d.status !== "archived" && d.projectId);
  const rows = new Map<string, ProjectProfitRow>();

  for (const doc of invoices) {
    const project = store.projects.find((p) => p.id === doc.projectId);
    if (!project) continue;
    const breakdown = await getInvoiceProfitBreakdown(doc.id);
    const revenue = convertMinorUnits(doc.totalCents, doc.currency, "BHD");
    const deductions = breakdown ? convertMinorUnits(breakdown.totalDeductionsCents, doc.currency, "BHD") : 0;
    const net = breakdown ? convertMinorUnits(breakdown.netProfitCents, doc.currency, "BHD") : revenue;

    const existing = rows.get(project.id);
    if (existing) {
      existing.revenueBhdCents += revenue;
      existing.deductionsBhdCents += deductions;
      existing.netProfitBhdCents += net;
    } else {
      rows.set(project.id, {
        projectId: project.id,
        projectName: project.name,
        revenueBhdCents: revenue,
        deductionsBhdCents: deductions,
        netProfitBhdCents: net,
      });
    }
  }

  return Array.from(rows.values());
}

export type PartnerProfitRow = { partyId: string; partyName: string; totalBhdCents: number };

export async function getProfitByPartnerReport(): Promise<PartnerProfitRow[]> {
  const invoices = store.documents.filter((d) => d.type === "invoice" && d.status !== "archived");
  const rows = new Map<string, PartnerProfitRow>();

  for (const doc of invoices) {
    const breakdown = await getInvoiceProfitBreakdown(doc.id);
    if (!breakdown) continue;
    for (const split of breakdown.splits) {
      const amountBhd = convertMinorUnits(split.amountCents, doc.currency, "BHD");
      const existing = rows.get(split.partyId);
      if (existing) {
        existing.totalBhdCents += amountBhd;
      } else {
        rows.set(split.partyId, { partyId: split.partyId, partyName: split.partyName, totalBhdCents: amountBhd });
      }
    }
  }

  return Array.from(rows.values());
}

export type InvoiceStatusReport = {
  paidCount: number;
  paidBhdCents: number;
  partialCount: number;
  partialOutstandingBhdCents: number;
  unpaidCount: number;
  unpaidBhdCents: number;
  overdueCount: number;
  overdueBhdCents: number;
};

export async function getInvoiceStatusReport(): Promise<InvoiceStatusReport> {
  const invoices = store.documents.filter((d) => d.type === "invoice" && d.status !== "archived");
  const report: InvoiceStatusReport = {
    paidCount: 0,
    paidBhdCents: 0,
    partialCount: 0,
    partialOutstandingBhdCents: 0,
    unpaidCount: 0,
    unpaidBhdCents: 0,
    overdueCount: 0,
    overdueBhdCents: 0,
  };

  const now = Date.now();
  for (const doc of invoices) {
    const paid = store.payments.filter((p) => p.documentId === doc.id).reduce((sum, p) => sum + p.amountCents, 0);
    const outstanding = Math.max(doc.totalCents - paid, 0);
    const outstandingBhd = convertMinorUnits(outstanding, doc.currency, "BHD");

    if (doc.status === "paid" || outstanding <= 0) {
      report.paidCount += 1;
      report.paidBhdCents += convertMinorUnits(doc.totalCents, doc.currency, "BHD");
      continue;
    }
    if (paid > 0) {
      report.partialCount += 1;
      report.partialOutstandingBhdCents += outstandingBhd;
    } else {
      report.unpaidCount += 1;
      report.unpaidBhdCents += outstandingBhd;
    }
    if (doc.dueAt && new Date(doc.dueAt).getTime() < now) {
      report.overdueCount += 1;
      report.overdueBhdCents += outstandingBhd;
    }
  }

  return report;
}

export type HostingFeeReport = { collectedBhdCents: number; dueBhdCents: number };

export async function getHostingFeeReport(): Promise<HostingFeeReport> {
  let collected = 0;
  let due = 0;
  for (const sub of store.hostingSubscriptions) {
    const amountBhd = convertMinorUnits(sub.amountCents, sub.currency, "BHD");
    if (sub.lastCollectedDate) collected += amountBhd;
    if (sub.status !== "paused") due += amountBhd;
  }
  return { collectedBhdCents: collected, dueBhdCents: due };
}

// --- Cash Flow Forecast (suggested addition, PRD 15.2) ---

export type CashFlowForecastMonth = { label: string; expectedBhdCents: number };

/** Confirmed revenue for the next 3 months: outstanding invoice balances due
 * in-month, plus scheduled hosting subscription collections in-month. */
export async function getCashFlowForecast(): Promise<CashFlowForecastMonth[]> {
  const months: CashFlowForecastMonth[] = [];
  const now = new Date();

  for (let i = 0; i < 3; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    let expected = 0;

    for (const doc of store.documents) {
      if (doc.type !== "invoice" || doc.status === "archived" || doc.status === "paid" || !doc.dueAt) continue;
      const due = new Date(doc.dueAt);
      if (due >= monthStart && due < monthEnd) {
        const paid = store.payments.filter((p) => p.documentId === doc.id).reduce((sum, p) => sum + p.amountCents, 0);
        expected += convertMinorUnits(Math.max(doc.totalCents - paid, 0), doc.currency, "BHD");
      }
    }

    for (const sub of store.hostingSubscriptions) {
      if (sub.status === "paused" || !sub.nextDueDate) continue;
      const due = new Date(sub.nextDueDate);
      if (due >= monthStart && due < monthEnd) {
        expected += convertMinorUnits(sub.amountCents, sub.currency, "BHD");
      }
    }

    months.push({ label: monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" }), expectedBhdCents: expected });
  }

  return months;
}
