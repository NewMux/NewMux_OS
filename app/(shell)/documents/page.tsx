import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listDocuments, listClients } from "@/lib/data/documents";
import { TypeFilter } from "@/components/documents/TypeFilter";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { Card } from "@/components/ui/Card";
import { centsToDisplay } from "@/lib/money";
import type { DocumentType } from "@/lib/data/types";
import { Plus } from "lucide-react";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/dashboard");

  const { type } = await searchParams;
  const [documents, clients] = await Promise.all([
    listDocuments(type ? { type: type as DocumentType } : undefined),
    listClients(),
  ]);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Unknown client";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Documents</h1>
        <Link
          href="/documents/new"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-success"
        >
          <Plus className="h-4 w-4" /> New document
        </Link>
      </div>

      <div className="mb-4">
        <TypeFilter />
      </div>

      <div className="flex flex-col gap-2">
        {documents.length === 0 && (
          <Card className="text-center text-sm text-muted-foreground">No documents yet.</Card>
        )}
        {documents.map((doc) => (
          <Link key={doc.id} href={`/documents/${doc.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{doc.documentNumber}</p>
                  <p className="text-xs text-muted-foreground">{clientName(doc.clientId)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {centsToDisplay(doc.totalCents, doc.currency)}
                  </span>
                  <StatusBadge status={doc.status} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
