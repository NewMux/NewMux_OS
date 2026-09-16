import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listRecurringExpenses } from "@/lib/data/finance";
import { listClients } from "@/lib/data/documents";
import { listProjects } from "@/lib/data/projects";
import { RecurringExpenseList } from "@/components/finance/RecurringExpenseList";
import { AddExpenseModal } from "@/components/finance/AddExpenseModal";
import { ListToolbar } from "@/components/list/ListToolbar";
import {
  applyListQuery,
  byDate,
  byNumber,
  byText,
  isFiltered,
  parseListParams,
  type SearchParamRecord,
} from "@/lib/list/query";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamRecord>;
}) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const params = parseListParams(await searchParams, {
    filterKeys: ["status", "cycle"],
  });
  const [expenses, clients, projects] = await Promise.all([
    listRecurringExpenses(),
    listClients(),
    listProjects(),
  ]);

  // The run-rate is always the whole book, never the filtered view: a search
  // box must not look like it changed what the company spends.
  const activeExpenses = expenses.filter((e) => e.status === "active");
  const monthlyBhdEquivalent = activeExpenses.reduce((sum, e) => {
    const monthly =
      e.cycle === "annual"
        ? e.amountCents / 12
        : e.cycle === "quarterly"
          ? e.amountCents / 3
          : e.amountCents;
    return sum + convertMinorUnits(Math.round(monthly), e.currency, "BHD");
  }, 0);

  const visibleExpenses = applyListQuery(expenses, params, {
    searchFields: (e) => [e.name, e.category],
    sorters: {
      name: byText((e) => e.name),
      amount: byNumber((e) => e.amountCents),
      due: byDate((e) => e.nextDueDate),
    },
    filters: {
      status: (e, value) => e.status === value,
      cycle: (e, value) => e.cycle === value,
    },
  });
  const narrowed = isFiltered(params);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Finance</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Quotations never enter the accounts — only invoices count toward revenue
        and profit (see the Documents module).
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Chart of Accounts — Operating Expenses</CardTitle>
        </CardHeader>
        <p className="text-2xl font-semibold text-foreground">
          {centsToDisplay(monthlyBhdEquivalent, "BHD")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Monthly run-rate across all active recurring expenses (converted to
          BHD at the fixed peg rate). Per-category revenue rollup (client
          projects / hosting / ventures) arrives with the Hosting Fee module
          (Phase 2).
        </p>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary-foreground">
          Recurring Expenses
        </h2>
        <AddExpenseModal clients={clients} projects={projects} />
      </div>
      <ListToolbar
        searchPlaceholder="Search expense or category…"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
            ],
          },
          {
            key: "cycle",
            label: "Cycle",
            options: [
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "annual", label: "Annual" },
            ],
          },
        ]}
        sorts={[
          { value: "name", label: "Name" },
          { value: "amount", label: "Amount" },
          { value: "due", label: "Next due" },
        ]}
        exportType="expenses"
      />
      <RecurringExpenseList
        expenses={visibleExpenses}
        clients={clients}
        projects={projects}
        narrowed={narrowed}
      />
    </div>
  );
}
