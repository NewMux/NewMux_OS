"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MinusCircle, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/ui/Page";
import { SheetIconButton } from "@/components/ui/Sheet";
import { FieldRow, ListRow, ListSection, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { useConfirm } from "@/components/ui/Confirm";
import { ClientProjectRows, type Option, type ProjectOption } from "@/components/forms/Fields";
import { centsToDisplay, majorToMinorUnits, minorToMajor, subtotalCents, taxCents } from "@/lib/money";
import { DOC_TYPE, NO_MONEY } from "@/lib/labels";
import type { Currency, DocumentTerms, DocumentType, RecurringExpenseCycle, ScopeItem, TermsTemplate, TermsTemplateClause } from "@/lib/data/types";

type Line = { key: number; description: string; quantity: string; unitPrice: string };
type Clause = { key: number; title: string; body: string };
type Scope = { key: number; deliverable: string; duration: string };

export type SignatoryOption = { id: string; fullName: string; position: string; defaultFor: DocumentType[] };

export type DocumentFormInitial = {
  id?: string;
  type: DocumentType;
  clientId: string;
  projectId: string;
  dealId?: string | null;
  currency: Currency;
  taxRatePercent: string;
  paymentTerms: string;
  notes: string;
  dueAt: string;
  /** YYYY-MM-DD, defaults to today (item 7). Unsigned invoices and credit notes only: signing dates a document itself. */
  issuedAt: string;
  /** Original number from before NEWMUX OS (item 8). */
  externalRef: string;
  /** Credit notes: the invoice being credited. */
  creditFor?: { id: string; documentNumber: string; remainingCreditCents: number } | null;
  lineItems: { description: string; quantity: number; unitPriceCents: number }[];
  title: string;
  overview: string;
  scope: ScopeItem[];
  recipient: string;
  body: string;
  validUntil: string;
  signatoryId: string;
  terms: DocumentTerms | null;
  serverFee: { amountCents: number; cycle: RecurringExpenseCycle; clientChooses: boolean; label: string | null } | null;
  /** The fee is already a hosting subscription (made when a quote was converted). */
  feeSubscribed?: boolean;
};

let nextKey = 0;
const key = () => ++nextKey;

const PAYMENT_TERMS_DEFAULT = "50% on approval, 50% on delivery. Bank transfer to IBAN {iban}.";

/**
 * Create or edit (draft) any official document (PRD addendum 1.2, section 3):
 * type and client, signatory, content (items, scope, the optional server
 * fee, or a letter's body), and Terms & Conditions picked from the library
 * and edited for this document only. Preview, signing and issuing happen on
 * the document's own screen.
 */
export function DocumentForm({
  initial,
  clients,
  projects,
  signatories,
  templates,
  standalone,
}: {
  initial: DocumentFormInitial;
  clients: Option[];
  projects: ProjectOption[];
  signatories: SignatoryOption[];
  templates: TermsTemplate[];
  standalone: TermsTemplateClause[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const editing = !!initial.id;
  const [type, setType] = useState<DocumentType>(initial.type);
  const [clientId, setClientId] = useState(initial.clientId);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [currency, setCurrency] = useState<Currency>(initial.currency);
  const [taxRate, setTaxRate] = useState(initial.taxRatePercent);
  const [paymentTerms, setPaymentTerms] = useState(initial.paymentTerms);
  const [notes, setNotes] = useState(initial.notes);
  const [dueAt, setDueAt] = useState(initial.dueAt);
  const [issuedAt, setIssuedAt] = useState(initial.issuedAt);
  const [externalRef, setExternalRef] = useState(initial.externalRef);
  const [title, setTitle] = useState(initial.title);
  const [overview, setOverview] = useState(initial.overview);
  const [recipient, setRecipient] = useState(initial.recipient);
  const [body, setBody] = useState(initial.body);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [signatoryId, setSignatoryId] = useState(initial.signatoryId);
  const [scope, setScope] = useState<Scope[]>(initial.scope.map((s) => ({ key: key(), ...s })));
  const [termsSource, setTermsSource] = useState<{ templateId: string | null; templateName: string | null; version: number | null } | null>(
    initial.terms ? { templateId: initial.terms.templateId, templateName: initial.terms.templateName, version: initial.terms.version } : null,
  );
  const [clauses, setClauses] = useState<Clause[]>((initial.terms?.clauses ?? []).map((c) => ({ key: key(), ...c })));
  const [fee, setFee] = useState({
    on: !!initial.serverFee,
    amount: initial.serverFee ? String(minorToMajor(initial.serverFee.amountCents, initial.currency)) : "",
    cycle: initial.serverFee?.cycle ?? ("quarterly" as RecurringExpenseCycle),
    clientChooses: initial.serverFee?.clientChooses ?? false,
    label: initial.serverFee?.label ?? "",
  });
  const creditFor = initial.creditFor;
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<Line[]>(
    initial.lineItems.length
      ? initial.lineItems.map((li) => ({ key: key(), description: li.description, quantity: String(li.quantity), unitPrice: String(minorToMajor(li.unitPriceCents, initial.currency)) }))
      : [{ key: key(), description: "", quantity: "1", unitPrice: "" }],
  );

  const money = !NO_MONEY.includes(type);
  const isLetter = type === "letter";
  const isOffer = type === "quote" || type === "proposal";
  const hasProjectContent = isOffer || type === "contract";
  const takesFee = isOffer || type === "contract";
  const takesTerms = type !== "invoice" && type !== "credit_note";
  const unsignedType = type === "invoice" || type === "credit_note";

  const minorLines = useMemo(
    () =>
      lines
        .filter((l) => l.description.trim())
        .map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, unitPriceCents: majorToMinorUnits(Number(l.unitPrice) || 0, currency) })),
    [lines, currency],
  );
  const taxBps = Math.round((Number(taxRate) || 0) * 100);
  const subtotal = subtotalCents(minorLines);
  const tax = taxCents(subtotal, taxBps);
  const overCredit = !!creditFor && subtotal + tax > creditFor.remainingCreditCents;
  const needsItems = money && type !== "proposal";
  const canSave =
    (isLetter || !!clientId) &&
    (!unsignedType || !!issuedAt) &&
    (!needsItems || minorLines.length > 0) &&
    minorLines.every((l) => l.quantity > 0) &&
    !overCredit &&
    (!fee.on || Number(fee.amount) >= 0);

  const update = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  const chooseTemplate = (id: string) => {
    if (!id) {
      setTermsSource(null);
      setClauses([]);
      return;
    }
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTermsSource({ templateId: t.id, templateName: t.name, version: t.version });
    setClauses(t.clauses.filter((c) => c.defaultOn).map((c) => ({ key: key(), title: c.title, body: c.body })));
  };
  const template = termsSource?.templateId ? templates.find((t) => t.id === termsSource.templateId) : undefined;
  const addable = [
    ...(template?.clauses ?? []).filter((c) => !clauses.some((x) => x.title === c.title && x.body === c.body)).map((c) => ({ ...c, from: template!.name })),
    ...standalone.filter((c) => !clauses.some((x) => x.title === c.title && x.body === c.body)).map((c) => ({ ...c, from: "Standalone" })),
  ];
  const moveClause = (i: number, by: number) =>
    setClauses((cs) => {
      const next = [...cs];
      const [c] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, c!);
      return next;
    });

  async function save() {
    if (!canSave || saving) return;
    const feeCents = fee.on ? majorToMinorUnits(Number(fee.amount) || 0, currency) : null;
    const feeChanged = initial.feeSubscribed && (feeCents !== (initial.serverFee?.amountCents ?? null) || (fee.on && fee.cycle !== initial.serverFee?.cycle));
    let applyFeeToSubscription = false;
    if (feeChanged && feeCents !== null) {
      applyFeeToSubscription = await confirm({
        title: "Update the hosting subscription too?",
        message: "This fee is already a hosting subscription. Change its amount and cycle to match, or keep the subscription as it is.",
        confirmLabel: "Update Subscription",
      });
    }
    setSaving(true);
    const payload = {
      ...(editing ? {} : { type, dealId: initial.dealId ?? null, creditForId: creditFor?.id ?? null }),
      clientId: clientId || null,
      projectId,
      currency,
      taxRateBps: money ? taxBps : 0,
      paymentTerms: isLetter ? null : paymentTerms,
      notes: isLetter ? null : notes,
      dueAt: type === "invoice" || type === "contract" ? dueAt : null,
      ...(unsignedType ? { issuedAt } : {}),
      externalRef,
      lineItems: money ? minorLines : [],
      title,
      overview: hasProjectContent ? overview : null,
      scope: hasProjectContent ? scope.filter((s) => s.deliverable.trim()).map((s) => ({ deliverable: s.deliverable.trim(), duration: s.duration.trim() })) : [],
      recipient: isLetter ? recipient : null,
      body: isLetter ? body : null,
      validUntil: isOffer ? validUntil : null,
      signatoryId: signatoryId || null,
      terms:
        takesTerms && clauses.some((c) => c.body.trim())
          ? { templateId: termsSource?.templateId ?? null, templateName: termsSource?.templateName ?? null, version: termsSource?.version ?? null, clauses: clauses.filter((c) => c.body.trim()).map((c) => ({ title: c.title.trim(), body: c.body.trim() })) }
          : null,
      serverFee: takesFee && fee.on ? { amountCents: feeCents ?? 0, cycle: fee.cycle, clientChooses: fee.clientChooses, label: fee.label || null } : null,
      ...(applyFeeToSubscription ? { applyFeeToSubscription } : {}),
    };
    const res = await fetch(editing ? `/api/documents/${initial.id}` : "/api/documents", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { document?: { id: string }; error?: string };
    setSaving(false);
    if (!res.ok || !json.document) {
      toast.error(json.error ?? "Couldn't save the document.");
      return;
    }
    toast.success(editing ? "Saved" : `Draft ${DOC_TYPE[type].toLowerCase()} created`);
    router.push(`/documents/${json.document.id}`);
    router.refresh();
  }

  const signatoriesForType = [...signatories].sort((a, b) => Number(b.defaultFor.includes(type)) - Number(a.defaultFor.includes(type)));

  return (
    <Page
      title={editing ? "Edit Draft" : `New ${DOC_TYPE[type]}`}
      back={editing ? { href: `/documents/${initial.id}`, label: "Cancel" } : { href: "/documents", label: "Documents" }}
      actions={<SheetIconButton kind="confirm" label={editing ? "Save" : "Create"} onClick={save} disabled={!canSave} busy={saving} />}
    >
      <div className="mx-auto max-w-2xl">
        {!editing && !creditFor && (
          <div className="mb-6">
            <SegmentedControl
              value={type}
              onChange={(t) => {
                setType(t);
                const def = signatories.find((s) => s.defaultFor.includes(t));
                if (def) setSignatoryId(def.id);
                if (t === "quote" || t === "proposal" || t === "contract") setPaymentTerms((p) => (p && p !== "Due on receipt" ? p : PAYMENT_TERMS_DEFAULT));
                if (t === "invoice") setPaymentTerms((p) => (p === PAYMENT_TERMS_DEFAULT ? "Due on receipt" : p));
              }}
              options={[
                { value: "quote", label: "Quote" },
                { value: "invoice", label: "Invoice" },
                { value: "contract", label: "Contract" },
                { value: "proposal", label: "Proposal" },
                { value: "letter", label: "Letter" },
              ]}
            />
          </div>
        )}

        {creditFor ? (
          <ListSection
            header="Credit for"
            footer={`Up to ${centsToDisplay(creditFor.remainingCreditCents, currency)} can be credited. Once issued, it reduces what ${creditFor.documentNumber} is owed; a refund can then be recorded on it.`}
          >
            <FieldRow label="Invoice">
              <span className="text-label-2">{creditFor.documentNumber}</span>
            </FieldRow>
            <FieldRow label="Client">
              <span className="truncate text-label-2">{clients.find((c) => c.id === clientId)?.name}</span>
            </FieldRow>
          </ListSection>
        ) : isLetter ? (
          <ListSection header="To" footer="One line each: name, then position and company, then address. Choosing a client files the letter under them.">
            <div className="px-4 py-2.5 hairline-b">
              <Textarea dir="auto" rows={3} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={"Mr. Recipient Name\nPosition, Company Name\nKingdom of Bahrain"} />
            </div>
            <ClientProjectRows clients={clients} projects={projects} clientId={clientId} projectId={projectId} onClient={setClientId} onProject={setProjectId} />
          </ListSection>
        ) : (
          <ListSection header={type === "invoice" ? "Bill to" : "Client"}>
            <ClientProjectRows clients={clients} projects={projects} clientId={clientId} projectId={projectId} onClient={setClientId} onProject={setProjectId} />
            <FieldRow label="Currency">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="BHD">BHD — Bahraini Dinar</option>
                <option value="USD">USD — US Dollar</option>
              </Select>
            </FieldRow>
          </ListSection>
        )}

        <ListSection
          header={isLetter ? "Letter" : "Document"}
          footer={
            unsignedType
              ? "The issue date decides which month it counts in. Use the original number for documents issued before NEWMUX OS."
              : "Signed by the signatory when it's issued: only their own login can sign, with their password."
          }
        >
          <FieldRow label={isLetter ? "Subject" : "Title"}>
            <RowInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isLetter ? "Subject line" : type === "invoice" ? "Optional, e.g. the project" : "Project name"} />
          </FieldRow>
          <FieldRow label="Signatory">
            <Select value={signatoryId} onChange={(e) => setSignatoryId(e.target.value)}>
              <option value="">{unsignedType ? "None (unsigned)" : "Choose…"}</option>
              {signatoriesForType.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} — {s.position}
                </option>
              ))}
            </Select>
          </FieldRow>
          {isOffer && (
            <FieldRow label="Valid until">
              <RowInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </FieldRow>
          )}
          {unsignedType && (
            <FieldRow label="Issue date">
              <RowInput type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </FieldRow>
          )}
          {(type === "invoice" || type === "contract") && (
            <FieldRow label="Due date">
              <RowInput type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </FieldRow>
          )}
          <FieldRow label="Original number">
            <RowInput placeholder="e.g. #00267 (optional)" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
          </FieldRow>
        </ListSection>

        {isLetter && (
          <ListSection header="Body" footer="A blank line starts a new paragraph. Start lines with - for bullets, and wrap words in **two stars** for bold. End with your closing (Kind regards,): the signature goes under it.">
            <div className="px-4 py-2.5">
              <Textarea dir="auto" rows={14} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Dear Mr. Recipient,\n\n…\n\nKind regards,"} />
            </div>
          </ListSection>
        )}

        {hasProjectContent && (
          <>
            <ListSection header="Overview">
              <div className="px-4 py-2.5">
                <Textarea dir="auto" rows={3} value={overview} onChange={(e) => setOverview(e.target.value)} placeholder="The client's need and the solution NewMux will deliver" />
              </div>
            </ListSection>
            <ListSection header="Scope & timeline" footer="Deliverables and how long each takes. Leave it empty to skip the section.">
              {scope.map((it, i) => (
                <div key={it.key} className="flex items-start gap-2 py-2.5 pl-3 pr-4 hairline-b">
                  <button type="button" aria-label="Remove deliverable" onClick={() => setScope((s) => s.filter((x) => x.key !== it.key))} className="mt-0.5">
                    <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
                  </button>
                  <span className="mt-0.5 w-5 text-label-2 tabular">{i + 1}</span>
                  <input
                    value={it.deliverable}
                    onChange={(e) => setScope((s) => s.map((x) => (x.key === it.key ? { ...x, deliverable: e.target.value } : x)))}
                    placeholder="Deliverable"
                    className="min-w-0 flex-1 bg-transparent placeholder:text-label-3 focus:outline-none"
                  />
                  <input
                    value={it.duration}
                    onChange={(e) => setScope((s) => s.map((x) => (x.key === it.key ? { ...x, duration: e.target.value } : x)))}
                    placeholder="Duration"
                    className="w-24 bg-transparent text-right text-label-2 placeholder:text-label-3 focus:outline-none"
                  />
                </div>
              ))}
              <AddRow label="Add Deliverable" onClick={() => setScope((s) => [...s, { key: key(), deliverable: "", duration: "" }])} />
            </ListSection>
          </>
        )}

        {money && (
          <>
            <ListSection header={type === "contract" ? "Fees" : type === "invoice" || type === "credit_note" ? "Items" : "Investment"} footer={type === "proposal" ? "Optional for a proposal." : undefined}>
              {lines.map((l, i) => {
                const lineTotal = Math.round((Number(l.quantity) || 0) * majorToMinorUnits(Number(l.unitPrice) || 0, currency));
                return (
                  <div key={l.key} className="flex items-start gap-2 py-2.5 pl-3 pr-4 hairline-b last:shadow-none">
                    <button type="button" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="mt-0.5 text-ios-red disabled:opacity-30">
                      <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <input value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} placeholder={`Item ${i + 1}`} className="w-full bg-transparent placeholder:text-label-3 focus:outline-none" />
                      <div className="mt-1.5 flex items-center gap-2 text-subhead text-label-2">
                        <input
                          inputMode="decimal"
                          value={l.quantity}
                          onChange={(e) => update(l.key, { quantity: e.target.value.replace(/[^0-9.]/g, "") })}
                          aria-label="Quantity"
                          className="w-12 rounded-md bg-fill/[0.12] px-2 py-1 text-center text-label tabular focus:outline-none"
                        />
                        <span>×</span>
                        <input
                          inputMode="decimal"
                          value={l.unitPrice}
                          onChange={(e) => update(l.key, { unitPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                          placeholder="Price"
                          aria-label="Unit price"
                          className="w-24 rounded-md bg-fill/[0.12] px-2 py-1 text-right text-label tabular placeholder:text-label-3 focus:outline-none"
                        />
                        <span className="ml-auto text-label tabular">{centsToDisplay(lineTotal, currency)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <AddRow label="Add Item" onClick={() => setLines((ls) => [...ls, { key: key(), description: "", quantity: "1", unitPrice: "" }])} />
            </ListSection>

            <ListSection>
              <FieldRow label="VAT rate">
                <RowInput inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value.replace(/[^0-9.]/g, ""))} className="w-16" />
                <span className="ml-1 text-label-2">%</span>
              </FieldRow>
              <div className="space-y-1 px-4 py-3 text-subhead tabular">
                <div className="flex justify-between text-label-2">
                  <span>Subtotal</span>
                  <span>{centsToDisplay(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-label-2">
                  <span>VAT</span>
                  <span>{centsToDisplay(tax, currency)}</span>
                </div>
                <div className="flex justify-between pt-1 text-headline">
                  <span>Total</span>
                  <span className={overCredit ? "text-ios-red" : undefined}>{centsToDisplay(subtotal + tax, currency)}</span>
                </div>
              </div>
            </ListSection>
          </>
        )}

        {takesFee && (
          <ListSection
            header="Server fee"
            footer={
              fee.on
                ? "Printed as its own section, outside the total and the accounts. When the quote becomes a contract or invoice, it becomes a hosting subscription with this amount and cycle."
                : "Off: nothing about hosting appears on the document."
            }
          >
            <ListRow title="Server fee applies" trailing={<Toggle label="Server fee applies" checked={fee.on} onChange={(v) => setFee((f) => ({ ...f, on: v }))} />} />
            {fee.on && (
              <>
                <FieldRow label="Billing cycle">
                  <Select value={fee.cycle} onChange={(e) => setFee((f) => ({ ...f, cycle: e.target.value as RecurringExpenseCycle }))}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </Select>
                </FieldRow>
                <FieldRow label={`Amount (${currency})`}>
                  <RowInput inputMode="decimal" value={fee.amount} onChange={(e) => setFee((f) => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="For the cycle, not per month" />
                </FieldRow>
                <ListRow title="Client chooses the cycle" trailing={<Toggle label="Client chooses the cycle" checked={fee.clientChooses} onChange={(v) => setFee((f) => ({ ...f, clientChooses: v }))} />} />
                <FieldRow label="Description">
                  <RowInput value={fee.label} onChange={(e) => setFee((f) => ({ ...f, label: e.target.value }))} placeholder="Server and hosting, billed separately" />
                </FieldRow>
              </>
            )}
          </ListSection>
        )}

        {!isLetter && (
          <ListSection header="Payment terms" footer="{iban} becomes the company IBAN from Settings.">
            <div className="px-4 py-2.5">
              <Textarea rows={2} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder={type === "invoice" ? "Due on receipt" : PAYMENT_TERMS_DEFAULT} />
            </div>
          </ListSection>
        )}

        {takesTerms && (
          <ListSection
            header={isLetter ? "Attached terms (optional)" : "Terms & conditions"}
            footer="Pick a template, then untick, reorder or edit clauses. Changes here apply to this document only; the template stays as it is."
          >
            <FieldRow label="Template">
              <Select value={termsSource?.templateId ?? ""} onChange={(e) => chooseTemplate(e.target.value)}>
                <option value="">{clauses.length && !termsSource?.templateId ? "Custom" : "None"}</option>
                {templates
                  .filter((t) => t.isActive || t.id === termsSource?.templateId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </FieldRow>
            {clauses.map((c, i) => (
              <div key={c.key} className="py-2.5 pl-3 pr-4 hairline-b">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Remove clause" onClick={() => setClauses((cs) => cs.filter((x) => x.key !== c.key))}>
                    <MinusCircle className="h-5 w-5 fill-ios-red text-white" />
                  </button>
                  <span className="w-6 text-subhead text-accent tabular">{i + 1}</span>
                  <input
                    value={c.title}
                    onChange={(e) => setClauses((cs) => cs.map((x) => (x.key === c.key ? { ...x, title: e.target.value } : x)))}
                    placeholder="Clause title (optional)"
                    className="min-w-0 flex-1 bg-transparent font-medium placeholder:text-label-3 focus:outline-none"
                  />
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveClause(i, -1)} className="text-label-2 disabled:opacity-30">
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Move down" disabled={i === clauses.length - 1} onClick={() => moveClause(i, 1)} className="text-label-2 disabled:opacity-30">
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  value={c.body}
                  onChange={(e) => setClauses((cs) => cs.map((x) => (x.key === c.key ? { ...x, body: e.target.value } : x)))}
                />
              </div>
            ))}
            {addable.length > 0 && (
              <FieldRow label="Add clause">
                <Select
                  value=""
                  onChange={(e) => {
                    const c = addable.find((x) => x.id === e.target.value);
                    if (c) setClauses((cs) => [...cs, { key: key(), title: c.title, body: c.body }]);
                  }}
                >
                  <option value="">Choose…</option>
                  {addable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.from}: {c.title || c.body.slice(0, 40)}
                    </option>
                  ))}
                </Select>
              </FieldRow>
            )}
            <AddRow label="Write a Clause" onClick={() => setClauses((cs) => [...cs, { key: key(), title: "", body: "" }])} />
          </ListSection>
        )}

        {!isLetter && (
          <ListSection header="Notes">
            <div className="px-4 py-2.5">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes shown on the document" rows={3} />
            </div>
          </ListSection>
        )}
      </div>
    </Page>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[44px] w-full items-center gap-2 px-3 text-body text-accent active:bg-fill/20">
      <Plus className="h-5 w-5 rounded-full bg-ios-green p-0.5 text-white" strokeWidth={3} />
      {label}
    </button>
  );
}
