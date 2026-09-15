import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { listClients } from "@/lib/data/documents";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";

export default async function ClientsPage() {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const clients = await listClients();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          Client Directory
        </h1>
        <AddClientModal />
      </div>
      {clients.length === 0 && (
        <Card>
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client, or win a deal on the pipeline — that creates the client record for you."
            action={<AddClientModal />}
          />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {clients.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between">
                <div>
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
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.clientCode}
                    {c.contactPerson ? ` · ${c.contactPerson}` : ""}
                  </p>
                </div>
                {c.contactEmail && (
                  <p className="text-xs text-muted-foreground">
                    {c.contactEmail}
                  </p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
