import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listDocuments, listClients } from "@/lib/data/documents";
import { listProjects } from "@/lib/data/projects";
import { StatusBadge } from "@/components/documents/StatusBadge";
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
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText, SearchX, Plus } from "lucide-react";
import { centsToDisplay } from "@/lib/money";
import type { DocumentStatus, DocumentType } from "@/lib/data/types";

const TYPES: DocumentType[] = ["quote", "contract", "invoice"];
const STATUSES: DocumentStatus[] = [
  "draft",
  "sent",
  "accepted",
  "signed",
  "paid",
  "archived",
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamRecord>;
}) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/dashboard");

  const params = parseListParams(await searchParams, {
    filterKeys: ["type", "status"],
  });
  const [all, clients, projects] = await Promise.all([
    listDocuments(),
    listClients({ includeArchived: true }),
    listProjects({ includeArchived: true }),
  ]);
  const clientName = (id: string) =>
    clients.find((c) => c.id === id)?.name ?? "Unknown client";
  const projectName = (id: string | null) =>
    projects.find((p) => p.id === id)?.name ?? null;
  const documentNumber = (id: string | null) =>
    all.find((d) => d.id === id)?.documentNumber ?? null;

  const documents = applyListQuery(all, params, {
    searchFields: (d) => [
      d.documentNumber,
      clientName(d.clientId),
      d.notes,
      projectName(d.projectId),
    ],
    sorters: {
      number: byText((d) => d.documentNumber),
      total: byNumber((d) => d.totalCents),
      issued: byDate((d) => d.issuedAt ?? d.createdAt),
      due: byDate((d) => d.dueAt),
    },
    filters: {
      type: (d, value) => d.type === value,
      status: (d, value) => d.status === value,
    },
  });

  const narrowed = isFiltered(params);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Documents</h1>
        <Button asChild size="sm">
          <Link href="/documents/new">
            <Plus className="h-4 w-4" /> New document
          </Link>
        </Button>
      </div>

      <ListToolbar
        searchPlaceholder="Search number, client, project…"
        filters={[
          {
            key: "type",
            label: "Type",
            options: TYPES.map((t) => ({ value: t, label: t })),
          },
          {
            key: "status",
            label: "Status",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
        ]}
        sorts={[
          { value: "issued", label: "Issue date" },
          { value: "due", label: "Due date" },
          { value: "total", label: "Total" },
          { value: "number", label: "Number" },
        ]}
        exportType="documents"
      />

      <div className="flex flex-col gap-2">
        {documents.length === 0 && (
          <Card>
            {narrowed ? (
              <EmptyState
                icon={SearchX}
                title="No matching documents"
                description="Try a different search, or clear the filters to see them all."
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Quotations, contracts and invoices you create will appear here."
                action={
                  <Button asChild size="sm">
                    <Link href="/documents/new">New document</Link>
                  </Button>
                }
              />
            )}
          </Card>
        )}
        {documents.map((doc) => {
          const project = projectName(doc.projectId);
          const convertedFrom = documentNumber(doc.convertedFromQuotationId);
          return (
            <Link key={doc.id} href={`/documents/${doc.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {doc.documentNumber}
                      {convertedFrom && (
                        <Badge tone="info" className="ml-2">
                          From {convertedFrom}
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {clientName(doc.clientId)}
                      {project ? ` · ${project}` : ""}
                      {doc.dueAt
                        ? ` · due ${new Date(doc.dueAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {centsToDisplay(doc.totalCents, doc.currency)}
                    </span>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
