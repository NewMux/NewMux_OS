import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments, canAccessFinance } from "@/lib/rbac";
import {
  getDocumentById,
  getLineItems,
  getClientById,
  getStatusHistory,
} from "@/lib/data/documents";
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

  const [lineItems, client, history, payments, profitBreakdown] =
    await Promise.all([
      getLineItems(id),
      getClientById(document.clientId),
      getStatusHistory(id),
      document.type === "invoice"
        ? listPaymentsForDocument(id)
        : Promise.resolve([]),
      document.type === "invoice" && canAccessFinance(session)
        ? getInvoiceProfitBreakdown(id)
        : Promise.resolve(null),
    ]);
  if (!client) notFound();

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
    />
  );
}
