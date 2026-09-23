import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { listClients } from "@/lib/data/clients";
import { listProjects } from "@/lib/data/projects";
import { getDealById } from "@/lib/data/crm";
import { DocumentForm } from "@/components/documents/DocumentForm";
import type { DocumentType } from "@/lib/data/types";
import { addDaysYmd, todayYmd } from "@/lib/time";

export const metadata = { title: "New Document" };

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  const sp = await searchParams;
  const [clients, projects, deal] = await Promise.all([listClients(), listProjects(), sp.dealId ? getDealById(sp.dealId) : undefined]);
  const type = (["quote", "invoice", "contract"].includes(sp.type ?? "") ? sp.type : "quote") as DocumentType;

  return (
    <DocumentForm
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
      initial={{
        type,
        clientId: sp.clientId ?? deal?.clientId ?? "",
        projectId: sp.projectId ?? deal?.projectId ?? "",
        dealId: deal?.id ?? null,
        currency: deal?.currency ?? "BHD",
        taxRatePercent: "0",
        paymentTerms: type === "invoice" ? "Due on receipt" : "50% upfront, 50% on delivery",
        notes: "",
        dueAt: type === "invoice" ? addDaysYmd(todayYmd(), 14) : "",
        lineItems: deal ? [{ description: deal.title, quantity: 1, unitPriceCents: deal.valueCents }] : [],
      }}
    />
  );
}
