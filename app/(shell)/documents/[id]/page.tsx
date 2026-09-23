import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { getDocumentById, getLineItems, getStatusHistory } from "@/lib/data/documents";
import { getClientById } from "@/lib/data/clients";
import { getProjectById } from "@/lib/data/projects";
import { getDealById } from "@/lib/data/crm";
import { getInvoiceProfitBreakdown, listPaymentsForDocument, remainingBalanceCents } from "@/lib/data/finance";
import { one } from "@/lib/data/sql";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { DocumentActions, PaymentRows } from "@/components/documents/DocumentActions";
import { DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import { centsToDisplay } from "@/lib/money";
import { formatDate, daysUntil } from "@/lib/time";
import { cn } from "@/lib/utils";
import { solidBg } from "@/lib/colors";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) notFound();

  const [lineItems, client, project, deal, history, payments, breakdown, convertedTo, convertedFrom] = await Promise.all([
    getLineItems(id),
    getClientById(doc.clientId),
    doc.projectId ? getProjectById(doc.projectId) : undefined,
    doc.dealId ? getDealById(doc.dealId) : undefined,
    getStatusHistory(id),
    doc.type === "invoice" ? listPaymentsForDocument(id) : Promise.resolve([]),
    doc.type === "invoice" ? getInvoiceProfitBreakdown(id) : Promise.resolve(null),
    one<{ id: string; documentNumber: string }>("select id, document_number from documents where converted_from_quotation_id = $1 limit 1", [id]),
    doc.convertedFromQuotationId
      ? one<{ id: string; documentNumber: string }>("select id, document_number from documents where id = $1", [doc.convertedFromQuotationId])
      : Promise.resolve(undefined),
  ]);
  const remaining = remainingBalanceCents(doc, payments);
  const paid = doc.totalCents - remaining;
  const status = DOC_STATUS[doc.status];
  const overdue = doc.type === "invoice" && doc.dueAt && !["paid", "archived", "draft"].includes(doc.status) && daysUntil(doc.dueAt) < 0;

  return (
    <Page
      title={doc.documentNumber}
      back={{ href: "/documents", label: "Documents" }}
      actions={<DocumentActions doc={doc} remainingCents={remaining} hasConversion={!!convertedTo} menuOnly />}
    >
      <div className="mx-auto max-w-2xl">
        {/* Summary card */}
        <div className="mb-6 rounded-[20px] bg-bg-elevated p-5 text-center shadow-widget dark:shadow-none">
          <div className="text-footnote text-label-2">
            {DOC_TYPE[doc.type]} for {client?.name}
          </div>
          <div className="my-1 font-rounded text-[40px] font-semibold leading-tight tabular">{centsToDisplay(doc.totalCents, doc.currency)}</div>
          <div className="flex items-center justify-center gap-2">
            <Badge color={status.color}>{status.label}</Badge>
            {overdue && <Badge color="red">Overdue</Badge>}
          </div>
          {doc.type === "invoice" && doc.status !== "draft" && (
            <div className="mx-auto mt-4 max-w-xs">
              <div className="h-1.5 overflow-hidden rounded-full bg-fill/20">
                <div className="h-full rounded-full bg-ios-green transition-all" style={{ width: `${doc.totalCents ? (paid / doc.totalCents) * 100 : 0}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-caption1 text-label-2 tabular">
                <span>{centsToDisplay(paid, doc.currency)} paid</span>
                <span>{centsToDisplay(remaining, doc.currency)} left</span>
              </div>
            </div>
          )}
          <DocumentActions doc={doc} remainingCents={remaining} hasConversion={!!convertedTo} />
        </div>

        <ListSection header="Details">
          <ListRow title="Client" detail={client?.name} href={client ? `/clients/${client.id}` : undefined} />
          {project && <ListRow title="Project" detail={project.name} href={`/projects/${project.id}`} />}
          {deal && <ListRow title="Deal" detail={deal.title} href={`/crm/deals/${deal.id}`} />}
          {convertedFrom && <ListRow title="From quote" detail={convertedFrom.documentNumber} href={`/documents/${convertedFrom.id}`} />}
          {convertedTo && <ListRow title="Invoice" detail={convertedTo.documentNumber} href={`/documents/${convertedTo.id}`} />}
          <ListRow title="Issued" detail={formatDate(doc.issuedAt)} />
          {doc.type !== "quote" && <ListRow title="Due" detail={<span className={cn(overdue && "text-ios-red")}>{formatDate(doc.dueAt)}</span>} />}
          {doc.paymentTerms && <ListRow title="Terms" detail={doc.paymentTerms} />}
        </ListSection>

        <ListSection header="Items">
          {lineItems.map((li) => (
            <ListRow
              key={li.id}
              title={li.description}
              subtitle={`${li.quantity} × ${centsToDisplay(li.unitPriceCents, doc.currency)}`}
              detail={centsToDisplay(Math.round(li.quantity * li.unitPriceCents), doc.currency)}
              multiline
            />
          ))}
          <div className="space-y-1 px-4 py-3 text-subhead tabular">
            <div className="flex justify-between text-label-2">
              <span>Subtotal</span>
              <span>{centsToDisplay(doc.subtotalCents, doc.currency)}</span>
            </div>
            <div className="flex justify-between text-label-2">
              <span>Tax ({doc.taxRateBps / 100}%)</span>
              <span>{centsToDisplay(doc.taxCents, doc.currency)}</span>
            </div>
            <div className="flex justify-between pt-1 text-headline">
              <span>Total</span>
              <span>{centsToDisplay(doc.totalCents, doc.currency)}</span>
            </div>
          </div>
        </ListSection>

        {doc.type === "invoice" && doc.status !== "draft" && (
          <ListSection header="Payments" footer="Recording payments never changes the invoice total — it's marked paid automatically once covered.">
            <PaymentRows payments={payments} currency={doc.currency} canDelete={doc.status !== "archived"} />
          </ListSection>
        )}

        {breakdown && (
          <ListSection header="Profit Split" footer="Linked project costs are prorated per quarter and converted at the fixed BHD peg.">
            <ListRow title="Invoice total" detail={centsToDisplay(breakdown.invoiceTotalCents, doc.currency)} />
            {breakdown.deductions.map((d, i) => (
              <ListRow key={i} title={d.name} subtitle="Deduction" detail={`− ${centsToDisplay(d.amountCents, doc.currency)}`} />
            ))}
            <ListRow title={<span className="font-semibold">Net profit</span>} detail={<span className="font-semibold text-label">{centsToDisplay(breakdown.netProfitCents, doc.currency)}</span>} />
            {breakdown.splits.map((s) => (
              <ListRow key={s.partyId} title={s.partyName} subtitle={`${s.percentageBps / 100}%`} detail={centsToDisplay(s.amountCents, doc.currency)} />
            ))}
          </ListSection>
        )}
        {doc.type === "invoice" && !breakdown && (
          <ListSection footer="Add a profit-split rule for this invoice's project in Settings to see the partner split.">
            <ListRow title="No profit-split rule" href="/settings#splits" />
          </ListSection>
        )}

        {doc.notes && (
          <ListSection header="Notes">
            <p className="whitespace-pre-wrap px-4 py-3 text-body">{doc.notes}</p>
          </ListSection>
        )}

        <ListSection header="History">
          {history.map((h) => (
            <ListRow
              key={h.id}
              leading={<span className={cn("h-2.5 w-2.5 rounded-full", solidBg[DOC_STATUS[h.toStatus].color])} />}
              title={h.fromStatus ? `${DOC_STATUS[h.fromStatus].label} → ${DOC_STATUS[h.toStatus].label}` : "Created"}
              subtitle={h.changedByName ?? undefined}
              detail={<span className="text-subhead">{formatDate(h.changedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
            />
          ))}
        </ListSection>
        <p className="text-center text-footnote text-label-2">
          <a href={`/api/documents/generate-pdf?id=${doc.id}`} download className="text-accent">
            Download PDF
          </a>
        </p>
      </div>
    </Page>
  );
}
