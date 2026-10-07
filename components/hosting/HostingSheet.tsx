"use client";

import { useEffect, useState } from "react";
import { Link2, Unlink } from "lucide-react";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { ClientProjectRows, DeleteRow, MoneyRow, type Option, type ProjectOption } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { amountOrTbd, centsToDisplay, minorToMajor } from "@/lib/money";
import { PAYMENT_METHOD, docStatusLabel } from "@/lib/labels";
import { formatDate, todayYmd } from "@/lib/time";
import type { HostingListItem } from "@/lib/data/hosting";
import type { DocumentListItem } from "@/lib/data/documents";
import type { BankAccount, Currency, HostingItemType, HostingSubscriptionStatus, PaymentMethod, RecurringExpenseCycle } from "@/lib/data/types";

export type RecurringOption = Option & { cycle: RecurringExpenseCycle; amountCents: number; currency: Currency };

type LinkedInvoice = { id: string; documentNumber: string; externalRef: string | null; status: string; totalCents: number; currency: Currency; issuedAt: string | null };

export function HostingSheet({
  sub,
  onClose,
  clients,
  projects,
  recurring,
}: {
  sub: HostingListItem | null | "new";
  onClose: () => void;
  clients: Option[];
  projects: ProjectOption[];
  recurring: RecurringOption[];
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const editing = sub && sub !== "new" ? sub : null;
  const blank = {
    clientId: "",
    projectId: "",
    item: "server" as HostingItemType,
    label: "",
    tbd: false,
    amount: "",
    currency: "BHD" as Currency,
    cycle: "quarterly" as RecurringExpenseCycle,
    nextDueDate: "",
    status: "active" as HostingSubscriptionStatus,
    costMode: "none" as "none" | "recurring" | "typed",
    recurringExpenseId: "",
    costPerYear: "",
    costCurrency: "BHD" as Currency,
  };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!sub) return;
    setF(
      editing
        ? {
            clientId: editing.clientId,
            projectId: editing.projectId ?? "",
            item: editing.item,
            label: editing.label ?? "",
            tbd: editing.amountCents === null,
            amount: editing.amountCents === null ? "" : String(minorToMajor(editing.amountCents, editing.currency)),
            currency: editing.currency,
            cycle: editing.cycle,
            nextDueDate: editing.nextDueDate ?? "",
            status: editing.status,
            costMode: editing.recurringExpenseId ? "recurring" : editing.costPerYearCents !== null ? "typed" : "none",
            recurringExpenseId: editing.recurringExpenseId ?? "",
            costPerYear: editing.costPerYearCents !== null ? String(minorToMajor(editing.costPerYearCents, editing.costCurrency ?? "BHD")) : "",
            costCurrency: editing.costCurrency ?? "BHD",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, editing]);

  const submit = async () => {
    const payload = {
      clientId: f.clientId,
      projectId: f.projectId,
      item: f.item,
      label: f.label,
      amount: f.tbd ? null : Number(f.amount),
      currency: f.currency,
      cycle: f.cycle,
      nextDueDate: f.nextDueDate,
      status: f.status,
      recurringExpenseId: f.costMode === "recurring" ? f.recurringExpenseId : null,
      costPerYear: f.costMode === "typed" && f.costPerYear ? Number(f.costPerYear) : null,
      costCurrency: f.costMode === "typed" ? f.costCurrency : null,
    };
    return !!(editing
      ? await run(`/api/hosting/${editing.id}`, { method: "PATCH", body: payload, success: "Saved" })
      : await run("/api/hosting", { body: payload, success: "Hosting fee added" }));
  };

  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: `Stop tracking this fee for ${editing.clientName}?`, message: "Invoices already issued are kept.", destructive: true })) {
      if (await run(`/api/hosting/${editing.id}`, { method: "DELETE", success: "Deleted" })) onClose();
    }
  };

  return (
    <FormSheet
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Hosting Fee" : "New Hosting Fee"}
      submitLabel={editing ? "Save" : "Add"}
      canSubmit={!!f.clientId && (f.tbd || Number(f.amount) > 0) && (f.costMode !== "recurring" || !!f.recurringExpenseId)}
      onSubmit={submit}
    >
      <ListSection>
        <ClientProjectRows clients={clients} projects={projects} clientId={f.clientId} projectId={f.projectId} onClient={(v) => set("clientId", v)} onProject={(v) => set("projectId", v)} />
      </ListSection>
      <ListSection footer={f.tbd ? "Collecting asks for the amount; it's saved as the price from then on." : undefined}>
        <FieldRow label="Item">
          <Select value={f.item} onChange={(e) => set("item", e.target.value as HostingItemType)}>
            <option value="server">Server / hosting</option>
            <option value="domain">Domain</option>
            <option value="other">Other</option>
          </Select>
        </FieldRow>
        <PlainRowInput placeholder="Label (e.g. example.com domain)" value={f.label} onChange={(e) => set("label", e.target.value)} />
        <FieldRow label="Price to be agreed">
          <Toggle checked={f.tbd} onChange={(v) => set("tbd", v)} label="Price to be agreed" />
        </FieldRow>
        {!f.tbd && <MoneyRow label="Client pays" amount={f.amount} currency={f.currency} onAmount={(v) => set("amount", v)} onCurrency={(v) => set("currency", v)} />}
        <FieldRow label="Billed">
          <Select value={f.cycle} onChange={(e) => set("cycle", e.target.value as RecurringExpenseCycle)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Yearly</option>
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection footer="Leave the due date empty for a paused service or one that hasn't started.">
        <FieldRow label="Next due">
          <RowInput type="date" value={f.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
          {f.nextDueDate && (
            <button type="button" onClick={() => set("nextDueDate", "")} className="ml-2 shrink-0 text-subhead text-accent">
              Clear
            </button>
          )}
        </FieldRow>
        <FieldRow label="Status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value as HostingSubscriptionStatus)}>
            <option value="active">Active</option>
            <option value="not_started">Not started</option>
            <option value="paused">Paused</option>
            {editing && <option value="overdue">Overdue</option>}
          </Select>
        </FieldRow>
      </ListSection>

      <ListSection header="What it costs NEWMUX" footer="Used for the margin column on the Hosting page.">
        <FieldRow label="Vendor cost">
          <Select value={f.costMode} onChange={(e) => set("costMode", e.target.value as typeof f.costMode)}>
            <option value="none">Not set</option>
            <option value="recurring">A recurring expense</option>
            <option value="typed">Amount per year</option>
          </Select>
        </FieldRow>
        {f.costMode === "recurring" && (
          <FieldRow label="Expense">
            <Select value={f.recurringExpenseId} onChange={(e) => set("recurringExpenseId", e.target.value)}>
              <option value="">Choose…</option>
              {recurring.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({centsToDisplay(r.amountCents, r.currency)} {r.cycle})
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
        {f.costMode === "typed" && <MoneyRow label="Per year" amount={f.costPerYear} currency={f.costCurrency} onAmount={(v) => set("costPerYear", v)} onCurrency={(v) => set("costCurrency", v)} />}
      </ListSection>

      {editing && <LinkedInvoices sub={editing} />}
      {editing && <DeleteRow label="Delete Hosting Fee" onClick={remove} />}
    </FormSheet>
  );
}

/** Invoices billed for this fee, and linking ones issued outside "Collect" (item 12). */
function LinkedInvoices({ sub }: { sub: HostingListItem }) {
  const { run, pending } = useMutation();
  const [linked, setLinked] = useState<LinkedInvoice[] | null>(null);
  const [candidates, setCandidates] = useState<DocumentListItem[]>([]);
  const [pick, setPick] = useState("");
  const [advance, setAdvance] = useState(false);

  const load = () => {
    fetch(`/api/hosting/${sub.id}/invoices`)
      .then((r) => r.json())
      .then((d: { invoices?: LinkedInvoice[] }) => setLinked(d.invoices ?? []))
      .catch(() => setLinked([]));
    fetch("/api/documents?type=invoice")
      .then((r) => r.json())
      .then((d: { documents?: DocumentListItem[] }) =>
        setCandidates((d.documents ?? []).filter((x) => x.clientId === sub.clientId && !x.hostingSubscriptionId && !["draft", "void"].includes(x.status))),
      )
      .catch(() => {});
  };
  useEffect(load, [sub.id, sub.clientId]);

  const link = async () => {
    if (pick && (await run(`/api/hosting/${sub.id}/invoices`, { body: { documentId: pick, advance }, success: "Invoice linked" }))) {
      setPick("");
      setAdvance(false);
      load();
    }
  };

  return (
    <ListSection header="Invoices" footer="Payments on linked invoices count as collections, and paying one in full updates “last collected”.">
      {linked?.map((i) => (
        <ListRow
          key={i.id}
          href={`/documents/${i.id}`}
          title={`${i.documentNumber}${i.externalRef ? ` (${i.externalRef})` : ""}`}
          subtitle={`${formatDate(i.issuedAt)} · ${docStatusLabel("invoice", i.status as never)}`}
          detail={centsToDisplay(i.totalCents, i.currency)}
          trailing={
            <button
              type="button"
              aria-label="Unlink"
              className="p-1.5 text-label-3 hover:text-ios-red"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (await run(`/api/hosting/${sub.id}/invoices?documentId=${i.id}`, { method: "DELETE", success: "Unlinked" })) load();
              }}
            >
              <Unlink className="h-4 w-4" />
            </button>
          }
        />
      ))}
      {linked?.length === 0 && <ListRow title="No invoices yet" />}
      {candidates.length > 0 && (
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-accent" />
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Invoice to link" className="min-w-0 flex-1 truncate bg-transparent text-accent focus:outline-none">
              <option value="">Link an existing invoice…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.documentNumber}
                  {c.externalRef ? ` (${c.externalRef})` : ""} · {centsToDisplay(c.totalCents, c.currency)} · {formatDate(c.issuedAt, { day: "numeric", month: "short", year: "numeric" })}
                </option>
              ))}
            </select>
          </div>
          {pick && (
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-subhead">
                <Toggle checked={advance} onChange={setAdvance} label="Also move the next due date on one cycle" />
                Move next due on one cycle
              </label>
              <Button size="sm" disabled={pending} onClick={link}>
                Link
              </Button>
            </div>
          )}
        </div>
      )}
    </ListSection>
  );
}

/** "Collect": invoice, payment and next due date in one step (item 12). */
export function CollectSheet({ sub, open, onOpenChange, accounts }: { sub: HostingListItem; open: boolean; onOpenChange: (o: boolean) => void; accounts: BankAccount[] }) {
  const { run } = useMutation();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayYmd());
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [accountId, setAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [paid, setPaid] = useState(true);

  useEffect(() => {
    if (!open) return;
    setAmount(sub.amountCents === null ? "" : String(minorToMajor(sub.amountCents, sub.currency)));
    setPaidOn(todayYmd());
    setReference("");
    setPaid(true);
  }, [open, sub]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Collect Fee"
      submitLabel={paid ? "Collect" : "Invoice"}
      size="auto"
      canSubmit={Number(amount) > 0}
      onSubmit={async () =>
        !!(await run(`/api/hosting/${sub.id}/collect`, {
          body: { amount: Number(amount), paidOn, method, accountId, reference, invoiceOnly: !paid },
          success: paid ? "Collected — invoice and payment recorded" : "Invoice created",
        }))
      }
    >
      <ListSection
        footer={`Creates the invoice for ${sub.clientName}${paid ? ", records the payment" : ""} and moves the next due date on one cycle${sub.nextDueDate ? ` from ${formatDate(sub.nextDueDate)}` : ""}.${sub.amountCents === null ? " The amount becomes this fee's price." : ""}`}
      >
        <FieldRow label={`Amount (${sub.currency})`}>
          <RowInput inputMode="decimal" autoFocus value={amount} placeholder={amountOrTbd(null)} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="tabular" />
        </FieldRow>
        <FieldRow label="Date">
          <RowInput type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </FieldRow>
        <FieldRow label="Paid now">
          <Toggle checked={paid} onChange={setPaid} label="Record the payment now" />
        </FieldRow>
        {paid && (
          <>
            <FieldRow label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD[m]}
                  </option>
                ))}
              </Select>
            </FieldRow>
            {accounts.length > 1 && (
              <FieldRow label="Into account">
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Default account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FieldRow>
            )}
            <FieldRow label="Reference">
              <RowInput placeholder="Optional" value={reference} onChange={(e) => setReference(e.target.value)} />
            </FieldRow>
          </>
        )}
      </ListSection>
    </FormSheet>
  );
}
