import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getClientById, listDocuments } from "@/lib/data/documents";
import { listProjects } from "@/lib/data/projects";
import { listHostingSubscriptionsForClient } from "@/lib/data/hosting";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { centsToDisplay } from "@/lib/money";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const [allProjects, allDocuments, hostingSubs] = await Promise.all([
    listProjects(),
    listDocuments(),
    listHostingSubscriptionsForClient(id),
  ]);
  const projects = allProjects.filter((p) => p.clientId === id);
  const documents = allDocuments.filter((d) => d.clientId === id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">
          {client.name}
          {client.nameArabic && (
            <span dir="rtl" className="ml-2 font-normal text-muted-foreground">
              {client.nameArabic}
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">{client.clientCode}</p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <p className="text-secondary-foreground">
            Contact person: {client.contactPerson ?? "—"}
          </p>
          <p className="text-secondary-foreground">
            Email: {client.contactEmail ?? "—"}
          </p>
          <p className="text-secondary-foreground">
            Phone: {client.contactPhone ?? "—"}
          </p>
          <p className="text-secondary-foreground">
            Address: {client.billingAddress ?? "—"}
          </p>
        </div>
        {client.notes && (
          <p className="mt-3 text-xs text-muted-foreground">{client.notes}</p>
        )}
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="text-sm text-brand hover:underline"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        {documents.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {documents.map((d) => (
            <Link key={d.id} href={`/documents/${d.id}`}>
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm hover:border-primary/40">
                <span className="text-foreground">{d.documentNumber}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {centsToDisplay(d.totalCents, d.currency)}
                  </span>
                  <StatusBadge status={d.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hosting Subscriptions</CardTitle>
        </CardHeader>
        {hostingSubs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hosting subscriptions yet.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {hostingSubs.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span className="capitalize text-foreground">{h.item}</span>
              <span className="text-muted-foreground">
                {centsToDisplay(h.amountCents, h.currency)} / {h.cycle}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
