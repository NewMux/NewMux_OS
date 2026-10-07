import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { getDocumentById, getLineItems } from "@/lib/data/documents";
import { listClients } from "@/lib/data/clients";
import { listProjects } from "@/lib/data/projects";
import { DocumentForm } from "@/components/documents/DocumentForm";
import { todayYmd, toYmd } from "@/lib/time";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) notFound();
  if (doc.status !== "draft") redirect(`/documents/${id}`);
  const [lineItems, clients, projects, credited] = await Promise.all([
    getLineItems(id),
    listClients(),
    listProjects(),
    doc.creditForId ? getDocumentById(doc.creditForId) : undefined,
  ]);

  return (
    <DocumentForm
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
      initial={{
        id: doc.id,
        type: doc.type,
        clientId: doc.clientId,
        projectId: doc.projectId ?? "",
        currency: doc.currency,
        taxRatePercent: String(doc.taxRateBps / 100),
        paymentTerms: doc.paymentTerms ?? "",
        notes: doc.notes ?? "",
        dueAt: doc.dueAt ?? "",
        issuedAt: doc.issuedAt ? toYmd(doc.issuedAt) : todayYmd(),
        externalRef: doc.externalRef ?? "",
        // The server re-checks the credit limit on save.
        creditFor: credited ? { id: credited.id, documentNumber: credited.documentNumber, remainingCreditCents: credited.totalCents } : null,
        lineItems: lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPriceCents: li.unitPriceCents })),
      }}
    />
  );
}
