import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listClients } from "@/lib/data/documents";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { ClientRowActions } from "@/components/clients/ClientRowActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const all = await listClients({ includeArchived: true });
  const clients = all.filter((c) => (showArchived ? c.archivedAt : !c.archivedAt));
  const archivedCount = all.filter((c) => c.archivedAt).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Client Directory</h1>
        <AddClientModal />
      </div>

      {(archivedCount > 0 || showArchived) && (
        <div className="mb-3 flex gap-2 text-xs">
          <Link
            href="/clients"
            className={showArchived ? "text-muted-foreground hover:text-foreground" : "font-medium text-brand"}
          >
            Active
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/clients?archived=1"
            className={showArchived ? "font-medium text-brand" : "text-muted-foreground hover:text-foreground"}
          >
            Archived ({archivedCount})
          </Link>
        </div>
      )}

      {clients.length === 0 && (
        <Card>
          <EmptyState
            icon={Users}
            title={showArchived ? "Nothing archived" : "No clients yet"}
            description={
              showArchived
                ? "Archived clients keep their invoices and totals, and can be restored at any time."
                : "Add your first client, or win a deal on the pipeline — that creates the client record for you."
            }
            action={showArchived ? undefined : <AddClientModal />}
          />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {clients.map((c) => (
          <Card key={c.id} className="transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/clients/${c.id}`} className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {c.name}
                  {c.nameArabic && (
                    <span dir="rtl" className="ml-2 font-normal text-muted-foreground">
                      {c.nameArabic}
                    </span>
                  )}
                  {c.archivedAt && (
                    <Badge tone="muted" className="ml-2">
                      Archived
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.clientCode}
                  {c.contactPerson ? ` · ${c.contactPerson}` : ""}
                  {c.contactEmail ? ` · ${c.contactEmail}` : ""}
                </p>
              </Link>
              <ClientRowActions client={c} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
