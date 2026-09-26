import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessDocuments } from "@/lib/rbac";
import { getDocumentById, getLineItems, getStatusHistory, listDocuments, quoteInvoicedCents } from "@/lib/data/documents";
import { getClientById } from "@/lib/data/clients";
import { getProjectById } from "@/lib/data/projects";
import { getDealById, listContacts } from "@/lib/data/crm";
import { getInvoiceProfitBreakdown, getRuleForScope, listDeductionTypes, listParties, listPaymentsForDocument, listProfitSplitRules, listVentures } from "@/lib/data/finance";
import { listProjects } from "@/lib/data/projects";
import { one } from "@/lib/data/sql";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { DocumentActions, PaymentRows } from "@/components/documents/DocumentActions";
import { SplitRulePicker, type RuleOption } from "@/components/documents/SplitRulePicker";
import { DOC_STATUS, DOC_TYPE, docStatusLabel } from "@/lib/labels";
import { centsToDisplay } from "@/lib/money";
import { formatDate, todayYmd } from "@/lib/time";
import { cn } from "@/lib/utils";
import { solidBg } from "@/lib/colors";

const PASS = {
  invoice: "linear-gradient(140deg, #4a97ff 0%, #1f5fe0 55%, #1636a8 100%)",
  quote: "linear-gradient(140deg, #a07cff 0%, #6a45e6 55%, #4527b8 100%)",
  contract: "linear-gradient(140deg, #6e7482 0%, #454a55 55%, #2a2d34 100%)",
  credit_note: "linear-gradient(140deg, #ffb340 0%, #f08a00 55%, #b86200 100%)",
  paid: "linear-gradient(140deg, #3fd08a 0%, #1fa463 55%, #117a47 100%)",
  void: "linear-gradient(140deg, #9a9aa0 0%, #6d6d73 55%, #4a4a4f 100%)",
};

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessDocuments(session)) redirect("/home");
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) notFound();
  const isInvoice = doc.type === "invoice";

  const [lineItems, client, contacts, project, deal, history, payments, breakdown, madeFromThis, convertedFrom, creditFor, invoiced] = await Promise.all([
    getLineItems(id),
    getClientById(doc.clientId),
    listContacts({ clientId: doc.clientId }),
    doc.projectId ? getProjectById(doc.projectId) : undefined,
    doc.dealId ? getDealById(doc.dealId) : undefined,
    getStatusHistory(id),
    isInvoice || doc.type === "credit_note" ? listPaymentsForDocument(id) : Promise.resolve([]),
    isInvoice && doc.status !== "void" ? getInvoiceProfitBreakdown(id) : Promise.resolve(null),
    listDocuments({ derivedFrom: id }),
    doc.convertedFromQuotationId
      ? one<{ id: string; documentNumber: string }>("select id, document_number from documents where id = $1", [doc.convertedFromQuotationId])
      : Promise.resolve(undefined),
    doc.creditForId ? one<{ id: string; documentNumber: string }>("select id, document_number from documents where id = $1", [doc.creditForId]) : Promise.resolve(undefined),
    doc.type === "quote" ? quoteInvoicedCents(id) : Promise.resolve(0),
  ]);
  const creditNotes = madeFromThis.filter((d) => d.type === "credit_note");
  const invoicesFromQuote = madeFromThis.filter((d) => d.type === "invoice");
  const creditedCents = creditNotes.filter((c) => !["draft", "void"].includes(c.status)).reduce((s, c) => s + c.totalCents, 0);
  const paid = payments.reduce((s, p) => s + p.amountCents, 0);
  const net = doc.totalCents - creditedCents;
  const remaining = Math.max(net - paid, 0);
  const overdue = isInvoice && doc.status === "sent" && remaining > 0 && !!doc.dueAt && doc.dueAt < todayYmd();
  const partial = isInvoice && doc.status === "sent" && paid > 0 && remaining > 0;
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const statusText = partial ? "Partly paid" : docStatusLabel(doc.type, doc.status);

  // Split rule picker (item 5).
  const splitData =
    isInvoice && doc.status !== "void"
      ? await Promise.all([listProfitSplitRules(), listParties(), listDeductionTypes(), listProjects(), listVentures(), getRuleForScope("document", id)]).then(
          ([rules, parties, deductionTypes, projects, ventures, customRule]) => {
            const name = (r: (typeof rules)[number]) =>
              r.scopeType === "project" ? (projects.find((p) => p.id === r.scopeId)?.name ?? "Project") : r.scopeType === "venture" ? (ventures.find((v) => v.id === r.scopeId)?.name ?? "Venture") : doc.documentNumber;
            const options: RuleOption[] = rules.filter((r) => r.scopeType !== "document").map((r) => ({ id: r.id, name: name(r), scopeType: r.scopeType }));
            const currentRule = breakdown?.ruleId ? rules.find((r) => r.id === breakdown.ruleId) : undefined;
            const projectRule = doc.projectId ? rules.find((r) => r.scopeType === "project" && r.scopeId === doc.projectId) : undefined;
            return {
              parties,
              deductionTypes,
              options,
              customRule,
              currentRule,
              projectRuleId: projectRule?.id ?? null,
              current: currentRule ? { id: currentRule.id, name: name(currentRule), scopeType: currentRule.scopeType } : null,
            };
          },
        )
      : null;

  const ctx = {
    remainingCents: doc.type === "credit_note" ? Math.max(doc.totalCents - paid, 0) : remaining,
    paidCents: paid,
    invoicedCents: invoiced,
    clientName: client?.name ?? "the client",
    contactName: primary?.fullName ?? null,
    email: primary?.email ?? client?.email ?? null,
    whatsapp: primary?.whatsapp ?? primary?.phone ?? client?.phone ?? null,
  };
  const pass = doc.status === "void" ? PASS.void : doc.status === "paid" || (isInvoice && doc.status === "archived") ? PASS.paid : PASS[doc.type];

  return (
    <Page title={doc.documentNumber} back={{ href: "/documents", label: "Documents" }} actions={<DocumentActions doc={doc} ctx={ctx} menuOnly />}>
      <div className="mx-auto max-w-2xl">
        {/* Wallet-style pass: the one colourful surface on the screen. */}
        <div className="relative mb-2 overflow-hidden rounded-card p-5 text-white shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)]" style={{ background: pass }}>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgb(255_255_255/0.32),transparent_55%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-caption1 font-semibold uppercase tracking-[0.06em] text-white/80">
                {DOC_TYPE[doc.type]}
                {doc.externalRef && ` · ${doc.externalRef}`}
              </div>
              <div className="truncate text-headline">{client?.name}</div>
            </div>
            <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-caption1 font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
              {statusText}
              {overdue && " · Overdue"}
            </span>
          </div>
          <div className={cn("relative mt-9 font-rounded text-[40px] font-semibold leading-none tabular", doc.status === "void" && "line-through decoration-2")}>
            {doc.type === "credit_note" && "− "}
            {centsToDisplay(doc.totalCents, doc.currency)}
          </div>
          {isInvoice && ["sent", "paid"].includes(doc.status) ? (
            <div className="relative mt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${net > 0 ? Math.min((paid / net) * 100, 100) : 100}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-caption1 text-white/85 tabular">
                <span>{centsToDisplay(paid, doc.currency)} paid</span>
                <span>{creditedCents > 0 ? `${centsToDisplay(creditedCents, doc.currency)} credited · ` : ""}{centsToDisplay(remaining, doc.currency)} left</span>
              </div>
            </div>
          ) : (
            <div className="relative mt-5 text-caption1 text-white/85">Issued {formatDate(doc.issuedAt)}</div>
          )}
        </div>
        <div className="mb-7">
          <DocumentActions doc={doc} ctx={ctx} />
        </div>

        {doc.status === "void" && (
          <ListSection header="Void" footer={`Voided ${formatDate(doc.voidedAt)}. Left out of every report, balance and total.`}>
            <p className="px-4 py-3 text-body">{doc.voidReason}</p>
          </ListSection>
        )}

        <ListSection header="Details">
          <ListRow title="Client" detail={client?.name} href={client ? `/clients/${client.id}` : undefined} />
          {project && <ListRow title="Project" detail={project.name} href={`/projects/${project.id}`} />}
          {deal && <ListRow title="Deal" detail={deal.title} href={`/crm/deals/${deal.id}`} trailing={<Badge color={deal.stage === "won" ? "green" : deal.stage === "lost" ? "red" : "indigo"}>{deal.stage === "won" ? "Won" : deal.stage === "lost" ? "Lost" : "Open"}</Badge>} />}
          {doc.externalRef && <ListRow title="Original number" detail={doc.externalRef} />}
          {convertedFrom && <ListRow title="From quote" detail={convertedFrom.documentNumber} href={`/documents/${convertedFrom.id}`} />}
          {creditFor && <ListRow title="Credit for" detail={creditFor.documentNumber} href={`/documents/${creditFor.id}`} />}
          <ListRow title="Issued" detail={formatDate(doc.issuedAt)} />
          {(isInvoice || doc.type === "contract") && <ListRow title="Due" detail={<span className={cn(overdue && "text-ios-red")}>{formatDate(doc.dueAt)}</span>} />}
          {doc.paymentTerms && <ListRow title="Terms" detail={doc.paymentTerms} />}
        </ListSection>

        {doc.type === "quote" && invoicesFromQuote.length > 0 && (
          <ListSection header="Invoiced" footer={`${centsToDisplay(invoiced, doc.currency)} of ${centsToDisplay(doc.totalCents, doc.currency)} invoiced.`}>
            {invoicesFromQuote.map((d) => (
              <ListRow key={d.id} href={`/documents/${d.id}`} title={d.documentNumber} subtitle={docStatusLabel(d.type, d.status)} detail={centsToDisplay(d.totalCents, d.currency)} />
            ))}
          </ListSection>
        )}

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

        {isInvoice && creditNotes.length > 0 && (
          <ListSection header="Credit notes">
            {creditNotes.map((c) => (
              <ListRow key={c.id} href={`/documents/${c.id}`} title={c.documentNumber} subtitle={docStatusLabel(c.type, c.status)} detail={`− ${centsToDisplay(c.totalCents, c.currency)}`} />
            ))}
          </ListSection>
        )}

        {(isInvoice || doc.type === "credit_note") && doc.status !== "draft" && (
          <ListSection
            header={doc.type === "credit_note" ? "Refunds" : "Payments"}
            info={doc.type === "credit_note" ? "Money paid back to the client for this credit. Leaves the account balance." : "Recording payments never changes the invoice total. It's marked paid once payments (and credit notes) cover it."}
          >
            <PaymentRows payments={payments} currency={doc.currency} canDelete={!["archived", "void"].includes(doc.status)} refund={doc.type === "credit_note"} />
          </ListSection>
        )}

        {breakdown && splitData && (
          <section id="split" className="scroll-mt-20">
            <ListSection
              header="Profit Split"
              info="Costs charged to this invoice come off first, then this invoice's share of its project's other expenses, then the rule's deductions in order. What remains is split."
            >
              <SplitRulePicker
                documentId={doc.id}
                documentNumber={doc.documentNumber}
                current={splitData.current}
                projectRuleId={splitData.projectRuleId}
                customRule={splitData.customRule}
                currentRule={splitData.currentRule}
                options={splitData.options}
                parties={splitData.parties}
                deductionTypes={splitData.deductionTypes}
              />
              <ListRow title="Invoice total" subtitle={creditedCents ? "after credit notes" : undefined} detail={centsToDisplay(breakdown.invoiceTotalCents, doc.currency)} />
              {breakdown.deductions.map((d, i) => (
                <ListRow
                  key={i}
                  title={d.name}
                  subtitle={[d.source === "rule" ? d.basis : d.source === "invoice_expense" ? "Cost charged to this invoice" : `Project costs${d.basis ? ` · ${d.basis}` : ""}`, d.kind === "allocation" ? "set aside" : null]
                    .filter(Boolean)
                    .join(" · ")}
                  detail={<span className={d.kind === "allocation" ? "text-ios-purple" : undefined}>− {centsToDisplay(d.amountCents, doc.currency)}</span>}
                />
              ))}
              <ListRow title={<span className="font-semibold">To split</span>} detail={<span className={cn("font-semibold", breakdown.netProfitCents < 0 ? "text-ios-red" : "text-label")}>{centsToDisplay(breakdown.netProfitCents, doc.currency)}</span>} />
              {breakdown.splits.map((s) => (
                <ListRow key={s.partyId} href={`/finance/partners/${s.partyId}`} title={s.partyName} subtitle={`${s.percentageBps / 100}%`} detail={centsToDisplay(s.amountCents, doc.currency)} />
              ))}
              {!breakdown.ruleId && <ListRow title="No split rule yet" subtitle="Choose one with Change, or add one for the project in Settings." multiline />}
            </ListSection>
          </section>
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
              title={h.fromStatus ? `${docStatusLabel(doc.type, h.fromStatus)} → ${docStatusLabel(doc.type, h.toStatus)}` : "Created"}
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
