import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listRecurringExpenses } from "@/lib/data/finance";
import { listClients } from "@/lib/data/documents";
import { listProjects } from "@/lib/data/projects";
import { RecurringExpenseList } from "@/components/finance/RecurringExpenseList";
import { AddExpenseModal } from "@/components/finance/AddExpenseModal";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";

export default async function FinancePage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const [expenses, clients, projects] = await Promise.all([listRecurringExpenses(), listClients(), listProjects()]);

  const activeExpenses = expenses.filter((e) => e.status === "active");
  const monthlyBhdEquivalent = activeExpenses.reduce((sum, e) => {
    const monthly = e.cycle === "annual" ? e.amountCents / 12 : e.cycle === "quarterly" ? e.amountCents / 3 : e.amountCents;
    return sum + convertMinorUnits(Math.round(monthly), e.currency, "BHD");
  }, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Finance</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Quotations never enter the accounts — only invoices count toward revenue and profit (see the Documents module).
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Chart of Accounts — Operating Expenses</CardTitle>
        </CardHeader>
        <p className="text-2xl font-semibold text-foreground">{centsToDisplay(monthlyBhdEquivalent, "BHD")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Monthly run-rate across all active recurring expenses (converted to BHD at the fixed peg rate). Per-category
          revenue rollup (client projects / hosting / ventures) arrives with the Hosting Fee module (Phase 2).
        </p>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary-foreground">Recurring Expenses</h2>
        <AddExpenseModal clients={clients} projects={projects} />
      </div>
      <RecurringExpenseList expenses={expenses} clients={clients} projects={projects} />
    </div>
  );
}
