import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listHostingSubscriptions } from "@/lib/data/hosting";
import { listClients } from "@/lib/data/documents";
import { HostingList } from "@/components/hosting/HostingList";
import { AddHostingModal } from "@/components/hosting/AddHostingModal";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { centsToDisplay } from "@/lib/money";

export default async function HostingPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const [subscriptions, clients] = await Promise.all([listHostingSubscriptions(), listClients()]);

  const now = new Date();
  const dueThisMonth = subscriptions.filter((s) => {
    if (!s.nextDueDate) return false;
    const due = new Date(s.nextDueDate);
    return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
  });
  const dueThisMonthByCurrency = dueThisMonth.reduce<Record<string, number>>((acc, s) => {
    acc[s.currency] = (acc[s.currency] ?? 0) + s.amountCents;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Hosting Fees</h1>
        <AddHostingModal clients={clients} />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        14-day and 3-day due alerts, then overdue once the date passes. &quot;Collected&quot; creates a paid invoice
        automatically and advances the next due date by the billing cycle.
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Hosting fees due this month</CardTitle>
        </CardHeader>
        {Object.keys(dueThisMonthByCurrency).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due this month.</p>
        ) : (
          <div className="flex gap-4">
            {Object.entries(dueThisMonthByCurrency).map(([currency, amount]) => (
              <p key={currency} className="text-lg font-semibold text-foreground">
                {centsToDisplay(amount, currency)}
              </p>
            ))}
          </div>
        )}
      </Card>

      <HostingList subscriptions={subscriptions} clients={clients} />
    </div>
  );
}
