import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listClients } from "@/lib/data/clients";
import { listProjects } from "@/lib/data/projects";
import { getDealById } from "@/lib/data/crm";
import { getDocumentById, listDocuments } from "@/lib/data/documents";
import { DocumentForm } from "@/components/documents/DocumentForm";
import type { DocumentType } from "@/lib/data/types";
import { addDaysYmd, todayYmd } from "@/lib/time";

export const metadata = { title: "New Document" };

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  const sp = await searchParams;
  const [clients, projects, deal, credited] = await Promise.all([
    listClients(),
    listProjects(),
    sp.dealId ? getDealById(sp.dealId) : undefined,
    sp.creditFor ? getDocumentById(sp.creditFor) : undefined,
  ]);
  const creditFor = credited?.type === "invoice" && !["draft", "void"].includes(credited.status) ? credited : undefined;
  const type = (creditFor ? "credit_note" : ["quote", "invoice", "contract"].includes(sp.type ?? "") ? sp.type : "quote") as DocumentType;
  const alreadyCredited = creditFor
    ? (await listDocuments({ derivedFrom: creditFor.id })).filter((d) => d.type === "credit_note" && d.status !== "void").reduce((s, d) => s + d.totalCents, 0)
    : 0;

  return (
    <DocumentForm
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
      initial={{
        type,
        clientId: creditFor?.clientId ?? sp.clientId ?? deal?.clientId ?? "",
        projectId: creditFor?.projectId ?? sp.projectId ?? deal?.projectId ?? "",
        dealId: deal?.id ?? null,
        currency: creditFor?.currency ?? deal?.currency ?? "BHD",
        taxRatePercent: "0",
        paymentTerms: type === "invoice" ? "Due on receipt" : type === "credit_note" ? "" : "50% upfront, 50% on delivery",
        notes: "",
        dueAt: type === "invoice" ? addDaysYmd(todayYmd(), 14) : "",
        issuedAt: todayYmd(),
        externalRef: "",
        creditFor: creditFor ? { id: creditFor.id, documentNumber: creditFor.documentNumber, remainingCreditCents: creditFor.totalCents - alreadyCredited } : null,
        lineItems: creditFor
          ? [{ description: `Credit for ${creditFor.documentNumber}`, quantity: 1, unitPriceCents: 0 }]
          : deal
            ? [{ description: deal.title, quantity: 1, unitPriceCents: deal.valueCents }]
            : [],
      }}
    />
  );
}
