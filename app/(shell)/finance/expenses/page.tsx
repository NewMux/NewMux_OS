import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listExpenses } from "@/lib/data/expenses";
import { listParties, listRecurringExpenses, listVentures } from "@/lib/data/finance";
import { listClients } from "@/lib/data/clients";
import { listProjects } from "@/lib/data/projects";
import { listDocuments } from "@/lib/data/documents";
import { listBankAccounts } from "@/lib/data/ledger";
import { ExpensesScreen } from "./ExpensesScreen";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const [expenses, recurring, clients, projects, ventures, parties, accounts, invoices] = await Promise.all([
    listExpenses(),
    listRecurringExpenses(),
    listClients(),
    listProjects(),
    listVentures(),
    listParties(),
    listBankAccounts({ activeOnly: true }),
    listDocuments({ type: "invoice" }),
  ]);
  return (
    <ExpensesScreen
      expenses={expenses}
      recurring={recurring}
      links={{
        clients: clients.map((c) => ({ id: c.id, name: c.name })),
        projects: projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId })),
        ventures: ventures.map((v) => ({ id: v.id, name: v.name })),
        parties,
        accounts,
        invoices: invoices
          .filter((d) => d.status !== "void")
          .map((d) => ({ id: d.id, name: `${d.documentNumber}${d.externalRef ? ` (${d.externalRef})` : ""} · ${d.clientShortName ?? d.clientName}`, clientId: d.clientId, projectId: d.projectId })),
      }}
    />
  );
}
