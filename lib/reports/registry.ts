import type { Session } from "next-auth";
import type { SearchParamRecord } from "@/lib/list/query";
import { applyListQuery, byDate, byNumber, byText, parseListParams } from "@/lib/list/query";
import { canAccessDocuments, canAccessFinance } from "@/lib/rbac";
import { centsToDisplay } from "@/lib/money";
import {
  getInvoiceStatusReport,
  getProfitByPartnerReport,
  getProfitByProjectReport,
} from "@/lib/data/reports";
import { listClients, listDocuments } from "@/lib/data/documents";
import { listProjects } from "@/lib/data/projects";
import { listHostingSubscriptions } from "@/lib/data/hosting";
import { listRecurringExpenses } from "@/lib/data/finance";
import type { DocumentType } from "@/lib/data/types";

/**
 * One definition per exportable table, shared by the CSV and PDF routes.
 *
 * Both used to carry the same if/else over report types, so adding a table
 * meant editing two files and keeping the column lists in step by hand. They
 * now each render whatever this returns.
 *
 * List exports take the page's own search params, so "Export CSV" gives you
 * the rows you are actually looking at, not the whole table.
 */
export type ReportTable = {
  title: string;
  /** Without extension; the route appends .csv or .pdf. */
  filename: string;
  headers: string[];
  rows: (string | number)[][];
};

type ReportDefinition = {
  can: (session: Session | null) => boolean;
  build: (searchParams: SearchParamRecord) => Promise<ReportTable>;
};

const BHD = (cents: number) => centsToDisplay(cents, "BHD");
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "—");

const REPORTS: Record<string, ReportDefinition> = {
  // --- Finance reports (the three that already existed) ---
  "project-profit": {
    can: canAccessFinance,
    build: async () => ({
      title: "Profit & Loss by Project",
      filename: "profit-by-project",
      headers: ["Project", "Revenue (BHD)", "Deductions (BHD)", "Net Profit (BHD)"],
      rows: (await getProfitByProjectReport()).map((r) => [
        r.projectName,
        BHD(r.revenueBhdCents),
        BHD(r.deductionsBhdCents),
        BHD(r.netProfitBhdCents),
      ]),
    }),
  },

  "partner-profit": {
    can: canAccessFinance,
    build: async () => ({
      title: "Profit Distribution by Partner",
      filename: "profit-by-partner",
      headers: ["Partner", "Total Profit Share (BHD)"],
      rows: (await getProfitByPartnerReport()).map((r) => [r.partyName, BHD(r.totalBhdCents)]),
    }),
  },

  "invoice-status": {
    can: canAccessFinance,
    build: async () => {
      const r = await getInvoiceStatusReport();
      return {
        title: "Invoice Status",
        filename: "invoice-status",
        headers: ["Status", "Count", "Amount (BHD)"],
        rows: [
          ["Paid", r.paidCount, BHD(r.paidBhdCents)],
          ["Partially Paid", r.partialCount, BHD(r.partialOutstandingBhdCents)],
          ["Unpaid", r.unpaidCount, BHD(r.unpaidBhdCents)],
          ["Overdue", r.overdueCount, BHD(r.overdueBhdCents)],
        ],
      };
    },
  },

  // --- List exports, filtered by the same params as the page ---
  clients: {
    can: canAccessFinance,
    build: async (searchParams) => {
      const params = parseListParams(searchParams);
      const rows = applyListQuery(await listClients({ includeArchived: true }), params, {
        searchFields: (c) => [c.name, c.nameArabic, c.clientCode, c.contactPerson, c.contactEmail, c.contactPhone],
        sorters: { name: byText((c) => c.name), code: byText((c) => c.clientCode) },
        isArchived: (c) => c.archivedAt !== null,
      });
      return {
        title: params.archived ? "Archived Clients" : "Client Directory",
        filename: "clients",
        headers: ["Code", "Name", "Arabic name", "Contact", "Email", "Phone", "Billing address"],
        rows: rows.map((c) => [
          c.clientCode,
          c.name,
          c.nameArabic ?? "",
          c.contactPerson ?? "",
          c.contactEmail ?? "",
          c.contactPhone ?? "",
          c.billingAddress ?? "",
        ]),
      };
    },
  },

  projects: {
    can: canAccessFinance,
    build: async (searchParams) => {
      const params = parseListParams(searchParams, { filterKeys: ["status"] });
      const [all, clients] = await Promise.all([listProjects({ includeArchived: true }), listClients({ includeArchived: true })]);
      const rows = applyListQuery(all, params, {
        searchFields: (p) => [p.name, p.techStack, p.domain, p.hostingProvider],
        sorters: { name: byText((p) => p.name), target: byDate((p) => p.targetEndAt), started: byDate((p) => p.startedAt) },
        filters: { status: (p, value) => p.status === value },
        isArchived: (p) => p.archivedAt !== null,
      });
      return {
        title: params.archived ? "Archived Projects" : "Projects",
        filename: "projects",
        headers: ["Project", "Client", "Status", "Started", "Target end", "Tech stack", "Domain"],
        rows: rows.map((p) => [
          p.name,
          clients.find((c) => c.id === p.clientId)?.name ?? "",
          p.status.replace("_", " "),
          date(p.startedAt),
          date(p.targetEndAt),
          p.techStack ?? "",
          p.domain ?? "",
        ]),
      };
    },
  },

  documents: {
    can: canAccessDocuments,
    build: async (searchParams) => {
      const params = parseListParams(searchParams, { filterKeys: ["type", "status"] });
      const [all, clients] = await Promise.all([listDocuments(), listClients({ includeArchived: true })]);
      const rows = applyListQuery(all, params, {
        searchFields: (d) => [d.documentNumber, clients.find((c) => c.id === d.clientId)?.name, d.notes],
        sorters: { number: byText((d) => d.documentNumber), total: byNumber((d) => d.totalCents), issued: byDate((d) => d.createdAt) },
        filters: {
          type: (d, value) => d.type === (value as DocumentType),
          status: (d, value) => d.status === value,
        },
      });
      return {
        title: "Documents",
        filename: "documents",
        headers: ["Number", "Type", "Client", "Status", "Issued", "Currency", "Total"],
        rows: rows.map((d) => [
          d.documentNumber,
          d.type,
          clients.find((c) => c.id === d.clientId)?.name ?? "",
          d.status,
          date(d.createdAt),
          d.currency,
          centsToDisplay(d.totalCents, d.currency),
        ]),
      };
    },
  },

  hosting: {
    can: canAccessFinance,
    build: async (searchParams) => {
      const params = parseListParams(searchParams, { filterKeys: ["status", "item"] });
      const [all, clients] = await Promise.all([listHostingSubscriptions(), listClients({ includeArchived: true })]);
      const rows = applyListQuery(all, params, {
        searchFields: (h) => [clients.find((c) => c.id === h.clientId)?.name, h.item],
        sorters: { due: byDate((h) => h.nextDueDate), amount: byNumber((h) => h.amountCents) },
        filters: { status: (h, value) => h.status === value, item: (h, value) => h.item === value },
      });
      return {
        title: "Hosting Subscriptions",
        filename: "hosting",
        headers: ["Client", "Item", "Amount", "Cycle", "Next due", "Last collected", "Status"],
        rows: rows.map((h) => [
          clients.find((c) => c.id === h.clientId)?.name ?? "",
          h.item,
          centsToDisplay(h.amountCents, h.currency),
          h.cycle,
          date(h.nextDueDate),
          date(h.lastCollectedDate),
          h.status,
        ]),
      };
    },
  },

  expenses: {
    can: canAccessFinance,
    build: async (searchParams) => {
      const params = parseListParams(searchParams, { filterKeys: ["status", "cycle"] });
      const rows = applyListQuery(await listRecurringExpenses(), params, {
        searchFields: (e) => [e.name, e.category],
        sorters: { name: byText((e) => e.name), amount: byNumber((e) => e.amountCents), due: byDate((e) => e.nextDueDate) },
        filters: { status: (e, value) => e.status === value, cycle: (e, value) => e.cycle === value },
      });
      return {
        title: "Recurring Expenses",
        filename: "recurring-expenses",
        headers: ["Expense", "Category", "Amount", "Cycle", "Next due", "Last paid", "Status"],
        rows: rows.map((e) => [
          e.name,
          e.category,
          centsToDisplay(e.amountCents, e.currency),
          e.cycle,
          date(e.nextDueDate),
          date(e.lastPaymentDate),
          e.status,
        ]),
      };
    },
  },
};

export function getReportDefinition(type: string | null): ReportDefinition | undefined {
  // hasOwn, not a bare lookup: `?type=toString` would otherwise return a
  // function off the prototype and blow up as an unhandled 500.
  return type && Object.hasOwn(REPORTS, type) ? REPORTS[type] : undefined;
}
