import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments, canAccessFinance } from "@/lib/rbac";
import {
  getDocumentById,
  getLineItems,
  getClientById,
  getStatusHistory,
  listDocuments,
} from "@/lib/data/documents";
import { getProjectById } from "@/lib/data/projects";
import {
  listPaymentsForDocument,
  getInvoiceProfitBreakdown,
} from "@/lib/data/finance";
import { DocumentEditor } from "./DocumentEditor";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/dashboard");

  const { id } = await params;
  const document = await getDocumentById(id);
  if (!document) notFound();

  const [
    lineItems,
    client,
    history,
    payments,
    profitBreakdown,
    project,
    allDocuments,
  ] = await Promise.all([
    getLineItems(id),
    getClientById(document.clientId),
    getStatusHistory(id),
    document.type === "invoice"
      ? listPaymentsForDocument(id)
      : Promise.resolve([]),
    document.type === "invoice" && canAccessFinance(session)
      ? getInvoiceProfitBreakdown(id)
      : Promise.resolve(null),
    document.projectId
      ? getProjectById(document.projectId)
      : Promise.resolve(undefined),
    listDocuments(),
  ]);
  if (!client) notFound();

  const convertedFrom = allDocuments.find(
    (d) => d.id === document.convertedFromQuotationId,
  );
  const convertedTo = allDocuments.find(
    (d) => d.convertedFromQuotationId === document.id,
  );

  return (
    <DocumentEditor
      document={document}
      lineItems={lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
      }))}
      client={client}
      history={history}
      payments={payments}
      profitBreakdown={profitBreakdown}
      backlinks={{
        project: project ? { id: project.id, name: project.name } : null,
        convertedFrom: convertedFrom
          ? {
              id: convertedFrom.id,
              documentNumber: convertedFrom.documentNumber,
            }
          : null,
        convertedTo: convertedTo
          ? { id: convertedTo.id, documentNumber: convertedTo.documentNumber }
          : null,
      }}
    />
  );
}
