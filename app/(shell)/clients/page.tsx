import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listClients } from "@/lib/data/documents";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { ClientRowActions } from "@/components/clients/ClientRowActions";
import { ListToolbar } from "@/components/list/ListToolbar";
import {
  applyListQuery,
  byText,
  isFiltered,
  parseListParams,
  type SearchParamRecord,
} from "@/lib/list/query";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users, SearchX } from "lucide-react";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamRecord>;
}) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const params = parseListParams(await searchParams);
  const all = await listClients({ includeArchived: true });
  const archivedCount = all.filter((c) => c.archivedAt).length;

  const clients = applyListQuery(all, params, {
    searchFields: (c) => [
      c.name,
      c.nameArabic,
      c.clientCode,
      c.contactPerson,
      c.contactEmail,
      c.contactPhone,
    ],
    sorters: { name: byText((c) => c.name), code: byText((c) => c.clientCode) },
    isArchived: (c) => c.archivedAt !== null,
  });

  const narrowed = isFiltered(params);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          Client Directory
        </h1>
        <AddClientModal />
      </div>

      <ListToolbar
        searchPlaceholder="Search name, code, contact…"
        sorts={[
          { value: "name", label: "Name" },
          { value: "code", label: "Client code" },
        ]}
        archivedCount={archivedCount}
        exportType="clients"
      />

      {clients.length === 0 && (
        <Card>
          {narrowed ? (
            <EmptyState
              icon={SearchX}
              title="No matching clients"
              description="Try a different search, or clear the filters to see everyone."
            />
          ) : (
            <EmptyState
              icon={Users}
              title={params.archived ? "Nothing archived" : "No clients yet"}
              description={
                params.archived
                  ? "Archived clients keep their invoices and totals, and can be restored at any time."
                  : "Add your first client, or win a deal on the pipeline — that creates the client record for you."
              }
              action={params.archived ? undefined : <AddClientModal />}
            />
          )}
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {clients.map((c) => (
          <Card
            key={c.id}
            className="transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-3">
              <Link href={`/clients/${c.id}`} className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {c.name}
                  {c.nameArabic && (
                    <span
                      dir="rtl"
                      className="ml-2 font-normal text-muted-foreground"
                    >
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
                {c.billingAddress && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.billingAddress}
                  </p>
                )}
              </Link>
              <ClientRowActions client={c} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
