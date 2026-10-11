import type { UserRole } from "@/lib/data/types";
import { getAttentionItems } from "@/lib/data/attention";
import { getClientById, listClientsWithStats } from "@/lib/data/clients";
import { getPipelineSummary, listActivities, listContacts, listDeals, listOpenFollowUps, openPipelineTotals } from "@/lib/data/crm";
import { listDocuments, type DocumentListItem } from "@/lib/data/documents";
import { listExpenses } from "@/lib/data/expenses";
import { getErpDashboardSummary, listRecurringExpenses } from "@/lib/data/finance";
import { listHostingSubscriptions, listHostingSubscriptionsForClient, type HostingListItem } from "@/lib/data/hosting";
import { getPageById, searchPages } from "@/lib/data/kb";
import { getCompanyBalanceBhd, getPartyBalances } from "@/lib/data/ledger";
import { listUpcomingMeetings } from "@/lib/data/meetings";
import { getProjectById, listProjectsWithStats, listTasks, listTasksByProject } from "@/lib/data/projects";
import { getArAging, getCashFlowForecast, getHostingFeeReport, getInvoiceStatusReport, getMonthlyCashFlow, getProfitByProjectReport } from "@/lib/data/reports";
import { globalSearch } from "@/lib/data/search";
import { DOC_TYPE, docStatusLabel } from "@/lib/labels";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { daysUntil, formatDate, formatTime, todayYmd, toYmd } from "@/lib/time";

/**
 * What Haman can look up. Every tool is read-only and wraps the same
 * lib/data functions the screens use, so his answers match the app.
 *
 * Three rules hold for every tool here:
 * - Access follows lib/rbac.ts: `partner` tools (CRM, finance, company) are
 *   neither offered to nor runnable by a team member.
 * - Money leaves here already formatted ("BHD 1,172.951"), with the totals
 *   worked out by the finance code. Amounts are stored in minor units with
 *   three decimals for BHD and two for USD, so a model must never be handed
 *   raw integers to add up or convert.
 * - Nothing reads the Vault. Credentials are never sent to the model.
 */

export type HamanContext = { userId: string; userName: string; role: UserRole };

type Input = Record<string, unknown>;

export type HamanTool = {
  name: string;
  /** Shown in the chat while the tool runs. */
  status: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  access: "everyone" | "partner";
  run(input: Input, ctx: HamanContext): Promise<unknown>;
};

// --- Small helpers ---

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A tool input that failed validation: returned to the model as the tool's error. */
export class ToolInputError extends Error {}

function text(input: Input, key: string, max = 200): string {
  const v = input[key];
  if (typeof v !== "string" || !v.trim()) throw new ToolInputError(`"${key}" is required.`);
  return v.trim().slice(0, max);
}

function optionalText(input: Input, key: string, max = 200): string | undefined {
  const v = input[key];
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function id(input: Input, key: string): string {
  const v = text(input, key);
  if (!UUID.test(v)) throw new ToolInputError(`"${key}" must be an id returned by another tool, not a name. Use search_os to find it.`);
  return v;
}

function optionalId(input: Input, key: string): string | undefined {
  return input[key] === undefined || input[key] === null || input[key] === "" ? undefined : id(input, key);
}

function int(input: Input, key: string, fallback: number, min: number, max: number): number {
  const v = Number(input[key]);
  return Number.isFinite(v) ? Math.min(Math.max(Math.round(v), min), max) : fallback;
}

function oneOf<T extends string>(input: Input, key: string, allowed: readonly T[]): T | undefined {
  const v = input[key];
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function ymd(input: Input, key: string): string | undefined {
  const v = input[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ToolInputError(`"${key}" must be a date like 2026-10-01.`);
  return v;
}

const bhd = (cents: number) => centsToDisplay(cents, "BHD");
const money = (cents: number, currency: string) => centsToDisplay(cents, currency);
const day = (value: string | null | undefined) => (value ? formatDate(value) : null);

/** First `max` rows, plus how many were left out so Haman can say the list is partial. */
function cap<T>(rows: T[], max: number): { rows: T[]; notShown: number } {
  return { rows: rows.slice(0, max), notShown: Math.max(rows.length - max, 0) };
}

/** What a client still owes on an invoice (0 for anything that isn't an issued, unpaid invoice). */
function outstandingCents(d: DocumentListItem): number {
  if (d.type !== "invoice" || d.status !== "sent") return 0;
  return Math.max(d.totalCents - d.creditedCents - d.paidCents, 0);
}

function documentRow(d: DocumentListItem) {
  const open = outstandingCents(d);
  const overdueDays = open > 0 && d.dueAt ? -daysUntil(toYmd(d.dueAt)) : 0;
  return {
    number: d.documentNumber,
    originalNumber: d.externalRef,
    type: DOC_TYPE[d.type],
    status: docStatusLabel(d.type, d.status),
    client: d.clientShortName ?? d.clientName,
    project: d.projectName,
    total: money(d.totalCents, d.currency),
    paid: money(d.paidCents, d.currency),
    outstanding: money(open, d.currency),
    issued: day(d.issuedAt),
    due: day(d.dueAt),
    overdueDays: overdueDays > 0 ? overdueDays : 0,
    href: `/documents/${d.id}`,
  };
}

function hostingRow(h: HostingListItem) {
  return {
    client: h.clientName,
    item: h.label ?? h.item,
    fee: h.amountCents === null ? "Amount to be decided" : money(h.amountCents, h.currency),
    cycle: h.cycle,
    status: h.status,
    nextDue: day(h.nextDueDate),
    daysUntilDue: h.nextDueDate ? daysUntil(h.nextDueDate) : null,
    lastCollected: day(h.lastCollectedDate),
    yearlyFee: h.annualFeeBhdCents === null ? null : bhd(h.annualFeeBhdCents),
    yearlyCost: h.annualCostBhdCents === null ? null : bhd(h.annualCostBhdCents),
    href: "/hosting",
  };
}

const NO_INPUT = { type: "object" as const, properties: {} };

// --- The tools ---

export const HAMAN_TOOLS: HamanTool[] = [
  {
    name: "search_os",
    status: "Searching NEWMUX OS",
    description:
      "Find records by name across the whole app: clients, contacts, deals, invoices and other documents, projects, tasks and wiki pages. Use it first whenever the user names something, to get its id and link. Returns kind, id, title, subtitle and href.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "A name or part of one, at least 2 characters." } }, required: ["query"] },
    access: "everyone",
    run: async (input, ctx) => {
      const results = await globalSearch(text(input, "query", 80), ctx.role, 8);
      return { results };
    },
  },
  {
    name: "list_tasks",
    status: "Checking tasks",
    description: "Open tasks with project, status, priority, assignee and due date. scope 'mine' (default) is the signed-in user's tasks; 'everyone' is the whole team's.",
    input_schema: { type: "object", properties: { scope: { type: "string", enum: ["mine", "everyone"] } } },
    access: "everyone",
    run: async (input, ctx) => {
      const scope = oneOf(input, "scope", ["mine", "everyone"] as const) ?? "mine";
      const tasks = await listTasks({ assigneeId: scope === "mine" ? ctx.userId : undefined, openOnly: true });
      const today = todayYmd();
      const { rows, notShown } = cap(tasks, 60);
      return {
        scope,
        openCount: tasks.length,
        overdueCount: tasks.filter((t) => t.dueAt && toYmd(t.dueAt) < today).length,
        dueTodayCount: tasks.filter((t) => t.dueAt && toYmd(t.dueAt) === today).length,
        tasks: rows.map((t) => ({
          title: t.title,
          project: t.projectName,
          status: t.status,
          priority: t.priority,
          assignee: t.assigneeName,
          due: day(t.dueAt),
          daysUntilDue: t.dueAt ? daysUntil(toYmd(t.dueAt)) : null,
          href: `/projects/${t.projectId}?task=${t.id}`,
        })),
        notShown,
      };
    },
  },
  {
    name: "list_projects",
    status: "Checking projects",
    description: "Every project that isn't archived, with its client, status, target end date and task counts (open, overdue, done).",
    input_schema: NO_INPUT,
    access: "everyone",
    run: async () => {
      const projects = await listProjectsWithStats();
      return {
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          client: p.clientName,
          status: p.status,
          started: day(p.startedAt),
          targetEnd: day(p.targetEndAt),
          tasks: { total: p.taskCount, open: p.openCount, overdue: p.overdueCount, done: p.doneCount },
          href: `/projects/${p.id}`,
        })),
      };
    },
  },
  {
    name: "get_project",
    status: "Reading the project",
    description: "One project in detail: description, dates, tech stack, hosting, domain and its renewal date, and all of its tasks. Needs the project's id (from list_projects or search_os).",
    input_schema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] },
    access: "everyone",
    run: async (input) => {
      const projectId = id(input, "project_id");
      const [project, tasks] = await Promise.all([getProjectById(projectId), listTasksByProject(projectId)]);
      if (!project) return { error: "No project has that id." };
      const { rows, notShown } = cap(tasks, 80);
      return {
        name: project.name,
        status: project.status,
        description: project.description,
        started: day(project.startedAt),
        targetEnd: day(project.targetEndAt),
        techStack: project.techStack,
        hostingProvider: project.hostingProvider,
        domain: project.domain,
        domainRenewal: day(project.domainRenewalDate),
        github: project.githubUrl,
        href: `/projects/${project.id}`,
        tasks: rows.map((t) => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignee: t.assigneeName,
          due: day(t.dueAt),
          daysUntilDue: t.dueAt && t.status !== "done" ? daysUntil(toYmd(t.dueAt)) : null,
          href: `/projects/${project.id}?task=${t.id}`,
        })),
        notShown,
      };
    },
  },
  {
    name: "upcoming_meetings",
    status: "Checking the calendar",
    description: "Meetings from now through the next N days (default 7, at most 60), with time, place and the client or project they belong to.",
    input_schema: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 60 } } },
    access: "everyone",
    run: async (input) => {
      const meetings = await listUpcomingMeetings(int(input, "days", 7, 1, 60));
      return {
        meetings: meetings.map((m) => ({
          title: m.title,
          date: formatDate(m.startsAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
          time: formatTime(m.startsAt),
          durationMinutes: m.durationMinutes,
          location: m.location,
          client: m.clientName,
          project: m.projectName,
          notesPage: m.kbPageId ? `/wiki/${m.kbPageId}` : null,
          href: "/meetings",
        })),
      };
    },
  },
  {
    name: "search_wiki",
    status: "Searching the wiki",
    description: "Full-text search over the wiki (processes, meeting notes, client notes). Returns page ids, titles and a short snippet. Follow with read_wiki_page for the content.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    access: "everyone",
    run: async (input) => {
      const pages = await searchPages(text(input, "query", 120), 8);
      return {
        pages: pages.map((p) => ({ id: p.id, title: `${p.emoji ? `${p.emoji} ` : ""}${p.title || "Untitled"}`, space: p.spaceName ?? null, snippet: p.snippet ?? null, updated: day(p.updatedAt), href: `/wiki/${p.id}` })),
      };
    },
  },
  {
    name: "read_wiki_page",
    status: "Reading the wiki",
    description: "The text of one wiki page, by id (from search_wiki or search_os). Long pages are cut off.",
    input_schema: { type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"] },
    access: "everyone",
    run: async (input) => {
      const page = await getPageById(id(input, "page_id"));
      if (!page) return { error: "No wiki page has that id." };
      const body = page.contentText ?? "";
      return {
        title: page.title || "Untitled",
        updated: day(page.updatedAt),
        updatedBy: page.updatedByName ?? null,
        text: body.slice(0, 6000),
        cutOff: body.length > 6000,
        href: `/wiki/${page.id}`,
      };
    },
  },
  {
    name: "needs_attention",
    status: "Checking what needs attention",
    description:
      "The Today screen's Needs Attention list: hosting fees to collect, renewals (commercial registration, domains, certifications), expiring files and follow-ups that are due. A team member only gets the renewals they can see.",
    input_schema: NO_INPUT,
    access: "everyone",
    run: async (_input, ctx) => {
      const partner = ctx.role === "partner_admin";
      const items = await getAttentionItems({ includeFinance: partner, includeCrm: partner });
      return {
        items: items.map((i) => ({ kind: i.kind, title: i.title, about: i.detail ?? null, date: day(i.date), daysUntil: daysUntil(i.date), overdue: i.overdue, href: i.href })),
      };
    },
  },

  // --- Partners only: CRM, finance, company ---

  {
    name: "finance_overview",
    status: "Checking the finances",
    description:
      "The headline figures: bank balance (total and per account), what clients owe, invoice counts by status, receivables aging, this month's collected, spent and net profit, what each partner is entitled to, has been paid and is still owed, and the reserve fund. Start here for any money question.",
    input_schema: NO_INPUT,
    access: "partner",
    run: async () => {
      const [summary, balance, parties, invoices, aging] = await Promise.all([getErpDashboardSummary(), getCompanyBalanceBhd(), getPartyBalances(), getInvoiceStatusReport(), getArAging()]);
      return {
        bankBalance: balance
          ? {
              total: bhd(balance.balanceBhdCents),
              accounts: balance.accounts.map((a) => ({
                name: a.account.name,
                balance: money(a.balanceCents, a.account.currency),
                lastReconciled: day(a.lastReconciliation?.statementDate),
              })),
            }
          : "No bank account has been set up yet.",
        owedByClients: {
          total: bhd(summary.totalOutstandingBhdCents),
          unpaidInvoices: summary.unpaidInvoiceCount,
          partlyPaidInvoices: summary.partiallyPaidInvoiceCount,
          overdue: { invoices: invoices.overdueCount, amount: bhd(invoices.overdueBhdCents) },
          byAge: aging.map((b) => ({ age: b.label, invoices: b.count, amount: bhd(b.bhdCents) })),
        },
        thisMonth: {
          collected: bhd(summary.collectedThisMonthBhdCents),
          spent: bhd(summary.spentThisMonthBhdCents),
          netProfitOnInvoicesIssued: bhd(summary.netProfitThisMonthBhdCents),
        },
        partners: parties.partners.map((p) => ({
          name: p.party.name,
          entitled: bhd(p.entitledBhdCents),
          ofWhichNotYetCollectedFromClients: bhd(p.uncollectedBhdCents),
          paidOut: bhd(p.paidBhdCents),
          reimbursementsDue: bhd(p.reimbursementDueBhdCents),
          stillOwed: bhd(p.remainingBhdCents),
          href: `/finance/partners/${p.party.id}`,
        })),
        funds: parties.funds.map((f) => ({ name: f.party.name, setAside: bhd(f.accruedBhdCents), spent: bhd(f.spentBhdCents), balance: bhd(f.balanceBhdCents), href: `/finance/partners/${f.party.id}` })),
        href: "/finance",
      };
    },
  },
  {
    name: "list_documents",
    status: "Checking invoices and documents",
    description:
      "Invoices, quotes, contracts and credit notes, newest first, each with client, total, paid, outstanding, due date and days overdue. Set unpaid_only to get just the invoices clients still owe on, with the total owed. Filter by type, status or client_id.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["invoice", "quote", "contract", "credit_note"] },
        status: { type: "string", enum: ["draft", "sent", "accepted", "declined", "signed", "paid", "archived", "void"] },
        client_id: { type: "string" },
        unpaid_only: { type: "boolean" },
      },
    },
    access: "partner",
    run: async (input) => {
      const unpaidOnly = input.unpaid_only === true;
      const docs = await listDocuments({
        type: unpaidOnly ? "invoice" : oneOf(input, "type", ["invoice", "quote", "contract", "credit_note"] as const),
        status: unpaidOnly ? "sent" : oneOf(input, "status", ["draft", "sent", "accepted", "declined", "signed", "paid", "archived", "void"] as const),
        clientId: optionalId(input, "client_id"),
      });
      const matching = unpaidOnly ? docs.filter((d) => outstandingCents(d) > 0) : docs;
      const { rows, notShown } = cap(matching, 40);
      return {
        count: matching.length,
        totalOutstanding: bhd(matching.reduce((sum, d) => sum + convertMinorUnits(outstandingCents(d), d.currency, "BHD"), 0)),
        documents: rows.map(documentRow),
        notShown,
      };
    },
  },
  {
    name: "cash_flow",
    status: "Checking cash flow",
    description:
      "Cash in and out per month for the last N months (default 6), and the forecast for the next 3 months: invoices falling due, hosting fees to collect and recurring expenses, with what makes up each month.",
    input_schema: { type: "object", properties: { months_back: { type: "integer", minimum: 1, maximum: 12 } } },
    access: "partner",
    run: async (input) => {
      const [past, forecast] = await Promise.all([getMonthlyCashFlow(int(input, "months_back", 6, 1, 12)), getCashFlowForecast(3)]);
      return {
        past: past.map((m) => ({ month: m.month, cashIn: bhd(m.inBhdCents), cashOut: bhd(m.outBhdCents), net: bhd(m.inBhdCents - m.outBhdCents) })),
        forecast: forecast.map((m) => ({
          month: m.label,
          expectedIn: bhd(m.expectedBhdCents),
          expectedOut: bhd(m.expectedOutBhdCents),
          items: m.items.slice(0, 25).map((i) => ({ direction: i.direction, what: i.label, detail: i.detail, date: day(i.date), amount: bhd(i.bhdCents), href: i.href })),
        })),
        href: "/finance/forecast",
      };
    },
  },
  {
    name: "profit_by_project",
    status: "Working out project profit",
    description: "Revenue, costs, reserve, net profit and each partner's share for every project that has invoices.",
    input_schema: NO_INPUT,
    access: "partner",
    run: async () => {
      const rows = await getProfitByProjectReport();
      return {
        projects: rows.map((r) => ({
          project: r.projectName,
          invoices: r.invoiceCount,
          revenue: bhd(r.revenueBhdCents),
          costs: bhd(r.costsBhdCents),
          reserve: bhd(r.reserveBhdCents),
          netProfit: bhd(r.netProfitBhdCents),
          shares: r.shares.map((s) => ({ partner: s.partyName, amount: bhd(s.bhdCents) })),
        })),
        href: "/reports",
      };
    },
  },
  {
    name: "list_expenses",
    status: "Checking expenses",
    description:
      "Expenses between two dates (default: this month so far), newest first, with the total, plus the active recurring expenses. Dates are YYYY-MM-DD; 'to' is exclusive.",
    input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD, exclusive" } } },
    access: "partner",
    run: async (input) => {
      const from = ymd(input, "from") ?? `${todayYmd().slice(0, 7)}-01`;
      const to = ymd(input, "to");
      const [expenses, recurring] = await Promise.all([listExpenses({ from, to }), listRecurringExpenses()]);
      const inBhd = (e: (typeof expenses)[number]) => e.amountBhdCents ?? convertMinorUnits(e.amountCents, e.currency, "BHD");
      const { rows, notShown } = cap(expenses, 40);
      return {
        from: day(from),
        to: to ? day(to) : "today",
        count: expenses.length,
        total: bhd(expenses.reduce((sum, e) => sum + inBhd(e), 0)),
        expenses: rows.map((e) => ({
          date: day(e.spentOn),
          description: e.description,
          category: e.category,
          vendor: e.vendor,
          amount: money(e.amountCents, e.currency),
          amountInBhd: bhd(inBhd(e)),
          for: e.clientName ?? e.projectName ?? e.ventureName ?? null,
          paidBy: e.paidByName ?? e.accountName ?? "Company account",
        })),
        notShown,
        recurring: recurring
          .filter((r) => r.status === "active")
          .map((r) => ({ name: r.name, amount: money(r.amountCents, r.currency), cycle: r.cycle, nextDue: day(r.nextDueDate) })),
        href: "/finance/expenses",
      };
    },
  },
  {
    name: "hosting_fees",
    status: "Checking hosting fees",
    description: "Every hosting, server and domain fee billed to clients: amount, cycle, next due date, last collected, yearly fee against yearly cost, plus the year's totals.",
    input_schema: NO_INPUT,
    access: "partner",
    run: async () => {
      const [subs, report] = await Promise.all([listHostingSubscriptions(), getHostingFeeReport()]);
      return {
        collectedThisYear: bhd(report.collectedBhdCents),
        dueThisCycle: bhd(report.dueBhdCents),
        yearlyFees: bhd(report.annualizedBhdCents),
        yearlyCost: bhd(report.annualCostBhdCents),
        feesWithNoAmountYet: report.tbdCount,
        fees: subs.map(hostingRow),
      };
    },
  },
  {
    name: "list_clients",
    status: "Checking clients",
    description: "Every client with its primary contact and counts of contacts, open deals, active projects and outstanding invoices.",
    input_schema: NO_INPUT,
    access: "partner",
    run: async () => {
      const clients = await listClientsWithStats();
      return {
        clients: clients.map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.shortName,
          code: c.clientCode,
          industry: c.industry,
          primaryContact: c.primaryContactName,
          contacts: c.contactCount,
          openDeals: c.openDealCount,
          activeProjects: c.activeProjectCount,
          outstandingInvoices: c.outstandingInvoiceCount,
          href: `/clients/${c.id}`,
        })),
      };
    },
  },
  {
    name: "get_client",
    status: "Reading the client",
    description:
      "Everything about one client: details and notes, contacts, deals, projects, what they owe, their latest documents, hosting fees and recent activity. Needs the client's id (from list_clients or search_os).",
    input_schema: { type: "object", properties: { client_id: { type: "string" } }, required: ["client_id"] },
    access: "partner",
    run: async (input) => {
      const clientId = id(input, "client_id");
      const client = await getClientById(clientId);
      if (!client) return { error: "No client has that id." };
      const [contacts, deals, projects, documents, hosting, activities] = await Promise.all([
        listContacts({ clientId }),
        listDeals({ clientId }),
        listProjectsWithStats({ clientId, includeArchived: true }),
        listDocuments({ clientId }),
        listHostingSubscriptionsForClient(clientId),
        listActivities({ clientId, limit: 10 }),
      ]);
      return {
        name: client.name,
        shortName: client.shortName,
        code: client.clientCode,
        industry: client.industry,
        website: client.website,
        email: client.email,
        phone: client.phone,
        notes: client.notes?.slice(0, 1500) ?? null,
        href: `/clients/${client.id}`,
        contacts: contacts.map((c) => ({ name: c.fullName, title: c.title, email: c.email, phone: c.phone, primary: c.isPrimary, href: `/contacts/${c.id}` })),
        deals: deals.map((d) => ({ title: d.title, stage: d.stage, value: money(d.valueCents, d.currency), probability: `${d.probability}%`, expectedClose: day(d.expectedClose), href: `/crm/deals/${d.id}` })),
        projects: projects.map((p) => ({ id: p.id, name: p.name, status: p.status, openTasks: p.openCount, overdueTasks: p.overdueCount, href: `/projects/${p.id}` })),
        owes: bhd(documents.reduce((sum, d) => sum + convertMinorUnits(outstandingCents(d), d.currency, "BHD"), 0)),
        documents: documents.slice(0, 12).map(documentRow),
        documentsNotShown: Math.max(documents.length - 12, 0),
        hostingFees: hosting.map(hostingRow),
        recentActivity: activities.map((a) => ({
          kind: a.kind,
          subject: a.subject,
          note: a.body?.slice(0, 300) ?? null,
          date: day(a.createdAt),
          followUpDue: day(a.dueAt),
          done: !!a.completedAt,
          by: a.createdByName,
        })),
      };
    },
  },
  {
    name: "pipeline",
    status: "Checking the pipeline",
    description: "The sales pipeline: every open deal with stage, value, probability and expected close, and totals per stage (plain and weighted by probability).",
    input_schema: NO_INPUT,
    access: "partner",
    run: async () => {
      const [deals, summary] = await Promise.all([listDeals({ open: true }), getPipelineSummary()]);
      const open = openPipelineTotals(summary);
      return {
        open: { deals: open.count, total: bhd(open.totalBhdCents), weighted: bhd(open.weightedBhdCents) },
        byStage: summary.map((s) => ({ stage: s.stage, deals: s.count, total: bhd(s.totalBhdCents), weighted: bhd(s.weightedBhdCents) })),
        deals: deals.map((d) => ({
          title: d.title,
          client: d.clientName,
          contact: d.contactName,
          stage: d.stage,
          value: money(d.valueCents, d.currency),
          probability: `${d.probability}%`,
          expectedClose: day(d.expectedClose),
          owner: d.ownerName,
          href: `/crm/deals/${d.id}`,
        })),
        href: "/crm/pipeline",
      };
    },
  },
  {
    name: "follow_ups",
    status: "Checking follow-ups",
    description: "Open CRM follow-ups (calls to return, emails to send), soonest first, with who they are about and when they are due.",
    input_schema: NO_INPUT,
    access: "partner",
    run: async () => {
      const items = await listOpenFollowUps();
      const { rows, notShown } = cap(items, 40);
      return {
        count: items.length,
        followUps: rows.map((a) => {
          const due = a.dueAt ? toYmd(a.dueAt) : null;
          return {
            subject: a.subject,
            kind: a.kind,
            about: a.dealTitle ?? a.clientName ?? a.contactName,
            due: day(due),
            daysUntilDue: due ? daysUntil(due) : null,
            href: a.dealId ? `/crm/deals/${a.dealId}` : a.clientId ? `/clients/${a.clientId}` : "/crm/activities",
          };
        }),
        notShown,
      };
    },
  },
];

/** The tools a role may use. */
export function toolsFor(role: UserRole): HamanTool[] {
  return HAMAN_TOOLS.filter((t) => t.access === "everyone" || role === "partner_admin");
}

const MAX_RESULT_CHARS = 16_000;

/**
 * Runs one tool call for the model and returns the text of its result.
 * Access is checked again here, so a tool a role wasn't offered can't be run
 * by naming it. Failures come back as text for the model to explain.
 */
export async function runTool(name: string, input: unknown, ctx: HamanContext): Promise<{ content: string; isError: boolean }> {
  const tool = toolsFor(ctx.role).find((t) => t.name === name);
  if (!tool) return { content: "That isn't available to this user.", isError: true };
  try {
    const result = await tool.run(input && typeof input === "object" ? (input as Input) : {}, ctx);
    const json = JSON.stringify(result);
    return { content: json.length > MAX_RESULT_CHARS ? `${json.slice(0, MAX_RESULT_CHARS)}… [cut off: too long]` : json, isError: false };
  } catch (error) {
    if (error instanceof ToolInputError) return { content: error.message, isError: true };
    // eslint-disable-next-line no-console
    console.error(`[haman] ${name} failed`, error);
    return { content: "That lookup failed inside NEWMUX OS. Tell the user it couldn't be read right now.", isError: true };
  }
}
