import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listHostingSubscriptions } from "@/lib/data/hosting";
import { getHostingFeeReport } from "@/lib/data/reports";
import { listClients } from "@/lib/data/clients";
import { listProjects } from "@/lib/data/projects";
import { listRecurringExpenses } from "@/lib/data/finance";
import { listBankAccounts } from "@/lib/data/ledger";
import { HostingScreen } from "./HostingScreen";

export const metadata = { title: "Hosting Fees" };

export default async function HostingPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const [subs, report, clients, projects, recurring, accounts] = await Promise.all([
    listHostingSubscriptions(),
    getHostingFeeReport(),
    listClients(),
    listProjects(),
    listRecurringExpenses(),
    listBankAccounts({ activeOnly: true }),
  ]);
  return (
    <HostingScreen
      subscriptions={subs}
      report={report}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
      recurring={recurring.map((r) => ({ id: r.id, name: r.name, cycle: r.cycle, amountCents: r.amountCents, currency: r.currency }))}
      accounts={accounts}
    />
  );
}
