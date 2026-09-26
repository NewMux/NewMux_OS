"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { ClientProjectRows, DeleteRow, MoneyRow, type Option, type ProjectOption } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { centsToDisplay, convertMinorUnits, majorToMinorUnits, minorToMajor } from "@/lib/money";
import { todayYmd } from "@/lib/time";
import { titleCase } from "@/lib/labels";
import { EXPENSE_CATEGORIES, type BankAccount, type Currency, type Party, type RecurringExpense, type RecurringExpenseCycle } from "@/lib/data/types";
import type { ExpenseListItem, ReimbursementStatus } from "@/lib/data/expenses";

export type { Option, ProjectOption };
export type InvoicePick = Option & { clientId: string; projectId: string | null };

/** Everything the expense forms can link to. */
export type ExpenseLinks = {
  clients: Option[];
  projects: ProjectOption[];
  ventures: Option[];
  parties: Party[];
  accounts: BankAccount[];
  invoices: InvoicePick[];
};

function CategoryRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = EXPENSE_CATEGORIES.includes(value as (typeof EXPENSE_CATEGORIES)[number]) || !value ? EXPENSE_CATEGORIES : [value, ...EXPENSE_CATEGORIES];
  return (
    <FieldRow label="Category">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((c) => (
          <option key={c} value={c}>
            {titleCase(c)}
          </option>
        ))}
      </Select>
    </FieldRow>
  );
}

function VentureRow({ value, onChange, ventures }: { value: string; onChange: (v: string) => void; ventures: Option[] }) {
  if (!ventures.length) return null;
  return (
    <FieldRow label="Venture">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {ventures.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </Select>
    </FieldRow>
  );
}

/** Receipt photo: the camera on iPhone, a file picker elsewhere (item 38). */
function ReceiptRow({ fileId, onChange }: { fileId: string; onChange: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("name", `Receipt ${todayYmd()}`);
    form.set("category", "receipt");
    const res = await fetch("/api/files", { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as { file?: { id: string }; error?: string };
    setBusy(false);
    if (!res.ok || !json.file) toast.error(json.error ?? "Couldn't save the receipt.");
    else onChange(json.file.id);
  };
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {fileId ? (
        <ListRow
          leading={<ExternalLink className="h-5 w-5 text-accent" />}
          title="Receipt"
          onClick={() => window.open(`/api/files/${fileId}/content`, "_blank", "noopener")}
          trailing={
            <button
              type="button"
              aria-label="Remove receipt"
              className="p-1.5 text-label-3 hover:text-ios-red"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <X className="h-4 w-4" />
            </button>
          }
        />
      ) : (
        <ListRow leading={<Camera className="h-5 w-5 text-accent" />} title={<span className="text-accent">{busy ? "Saving…" : "Add Receipt Photo"}</span>} onClick={() => !busy && input.current?.click()} />
      )}
    </>
  );
}

const blankExpense = (fundId = "") => ({
  description: "",
  vendor: "",
  amount: "",
  currency: "BHD" as Currency,
  amountBhd: "",
  spentOn: todayYmd(),
  category: fundId ? "marketing" : "software subscription",
  clientId: "",
  projectId: "",
  ventureId: "",
  documentId: "",
  paidBy: "company",
  accountId: "",
  reimbursement: "pending" as ReimbursementStatus,
  fundPartyId: fundId,
  receiptFileId: "",
  notes: "",
});

export function ExpenseSheet({ expense, onClose, links, defaultFundId }: { expense: ExpenseListItem | null | "new"; onClose: () => void; links: ExpenseLinks; defaultFundId?: string }) {
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const editing = expense && expense !== "new" ? expense : null;
  const [f, setF] = useState(blankExpense());
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const partners = links.parties.filter((p) => p.kind === "partner");
  const funds = links.parties.filter((p) => p.kind === "fund");

  useEffect(() => {
    if (!expense) return;
    setF(
      editing
        ? {
            description: editing.description,
            vendor: editing.vendor ?? "",
            amount: String(minorToMajor(editing.amountCents, editing.currency)),
            currency: editing.currency,
            amountBhd: editing.currency !== "BHD" && editing.amountBhdCents !== null ? String(minorToMajor(editing.amountBhdCents, "BHD")) : "",
            spentOn: editing.spentOn,
            category: editing.category,
            clientId: editing.linkedClientId ?? "",
            projectId: editing.linkedProjectId ?? "",
            ventureId: editing.linkedVentureId ?? "",
            documentId: editing.documentId ?? "",
            paidBy: editing.paidByPartyId ?? "company",
            accountId: editing.accountId ?? "",
            reimbursement: editing.reimbursementStatus === "not_required" ? "pending" : editing.reimbursementStatus,
            fundPartyId: editing.fundPartyId ?? "",
            receiptFileId: editing.receiptFileId ?? "",
            notes: editing.notes ?? "",
          }
        : blankExpense(defaultFundId),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, editing]);

  const byPartner = f.paidBy !== "company";
  const pegBhd = f.currency !== "BHD" && Number(f.amount) > 0 ? convertMinorUnits(majorToMinorUnits(Number(f.amount), f.currency), f.currency, "BHD") : null;
  const invoiceOptions = links.invoices.filter((i) => (f.projectId ? i.projectId === f.projectId : f.clientId ? i.clientId === f.clientId : true));

  const submit = async () => {
    const payload = {
      description: f.description,
      vendor: f.vendor,
      amount: Number(f.amount),
      currency: f.currency,
      amountBhd: f.currency !== "BHD" && f.amountBhd ? Number(f.amountBhd) : null,
      spentOn: f.spentOn,
      category: f.category,
      linkedClientId: f.clientId,
      linkedProjectId: f.projectId,
      linkedVentureId: f.ventureId,
      documentId: f.documentId,
      accountId: byPartner ? "" : f.accountId,
      paidByPartyId: byPartner ? f.paidBy : "",
      reimbursementStatus: byPartner ? (f.reimbursement === "reimbursed" ? "reimbursed" : f.reimbursement) : "not_required",
      fundPartyId: f.fundPartyId,
      receiptFileId: f.receiptFileId,
      notes: f.notes,
    };
    const res = editing
      ? await run(`/api/expenses/${editing.id}`, { method: "PATCH", body: payload, success: "Expense updated" })
      : await run("/api/expenses", { body: payload, success: "Expense added" });
    return !!res;
  };

  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: "Delete this expense?", destructive: true, confirmLabel: "Delete Expense" })) {
      if (await run(`/api/expenses/${editing.id}`, { method: "DELETE", success: "Expense deleted" })) onClose();
    }
  };

  const reimburse = async () => {
    if (!editing?.paidByPartyId) return;
    if (await confirm({ title: `Pay ${editing.paidByName} back?`, message: `Records a reimbursement payout of ${centsToDisplay(editing.amountBhdCents ?? 0, "BHD")} from the company account.`, confirmLabel: "Reimburse" }))
      if (await run(`/api/expenses/${editing.id}/reimburse`, { body: {}, success: "Reimbursed" })) onClose();
  };

  return (
    <FormSheet
      open={!!expense}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit Expense" : "New Expense"}
      submitLabel={editing ? "Save" : "Add"}
      canSubmit={!!f.description.trim() && Number(f.amount) > 0 && !!f.spentOn}
      onSubmit={submit}
    >
      {editing?.reimbursementStatus === "pending" && (
        <div className="mb-6">
          <Button variant="tinted" className="w-full" disabled={pending} onClick={reimburse}>
            Reimburse {editing.paidByName}
          </Button>
        </div>
      )}
      <ListSection>
        <PlainRowInput placeholder="What was it for?" value={f.description} onChange={(e) => set("description", e.target.value)} autoFocus={!editing} />
        <PlainRowInput placeholder="Vendor (optional)" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} />
        <ReceiptRow fileId={f.receiptFileId} onChange={(v) => set("receiptFileId", v)} />
      </ListSection>
      <ListSection
        footer={
          f.currency !== "BHD"
            ? `Enter what the card or bank actually charged in BHD. Left blank, the official peg is used${pegBhd !== null ? ` (${centsToDisplay(pegBhd, "BHD")})` : ""}.`
            : undefined
        }
      >
        <MoneyRow amount={f.amount} currency={f.currency} onAmount={(v) => set("amount", v)} onCurrency={(v) => set("currency", v)} />
        {f.currency !== "BHD" && (
          <FieldRow label="Charged in BHD">
            <RowInput inputMode="decimal" placeholder={pegBhd !== null ? String(minorToMajor(pegBhd, "BHD")) : "0.000"} value={f.amountBhd} onChange={(e) => set("amountBhd", e.target.value.replace(/[^0-9.]/g, ""))} className="w-28 tabular" />
          </FieldRow>
        )}
        <FieldRow label="Date">
          <RowInput type="date" value={f.spentOn} onChange={(e) => set("spentOn", e.target.value)} />
        </FieldRow>
        <CategoryRow value={f.category} onChange={(v) => set("category", v)} />
      </ListSection>

      <ListSection
        header="Paid by"
        footer={byPartner ? "It doesn't leave the company account now; it's added to what the company owes this partner until reimbursed." : undefined}
      >
        <FieldRow label="Paid from">
          <Select value={f.paidBy} onChange={(e) => set("paidBy", e.target.value)} disabled={editing?.reimbursementStatus === "reimbursed"}>
            <option value="company">Company account</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (personally)
              </option>
            ))}
          </Select>
        </FieldRow>
        {!byPartner && links.accounts.length > 1 && (
          <FieldRow label="Account">
            <Select value={f.accountId} onChange={(e) => set("accountId", e.target.value)}>
              <option value="">Default account</option>
              {links.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
        {byPartner && editing?.reimbursementStatus !== "reimbursed" && (
          <FieldRow label="Pay them back">
            <Select value={f.reimbursement} onChange={(e) => set("reimbursement", e.target.value as ReimbursementStatus)}>
              <option value="pending">Yes — owed to them</option>
              <option value="not_required">No — their contribution</option>
            </Select>
          </FieldRow>
        )}
        {editing?.reimbursementStatus === "reimbursed" && <ListRow title="Reimbursed" subtitle="Delete the reimbursement payout to change this." />}
      </ListSection>

      <ListSection header="Link to" footer="Costs linked to a project come off its profit. Charged to an invoice, they come off that invoice first — before any percentage deduction.">
        <ClientProjectRows clients={links.clients} projects={links.projects} clientId={f.clientId} projectId={f.projectId} onClient={(v) => set("clientId", v)} onProject={(v) => set("projectId", v)} />
        {invoiceOptions.length > 0 && (
          <FieldRow label="Invoice">
            <Select value={f.documentId} onChange={(e) => set("documentId", e.target.value)}>
              <option value="">None</option>
              {invoiceOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
        <VentureRow value={f.ventureId} onChange={(v) => set("ventureId", v)} ventures={links.ventures} />
      </ListSection>

      {funds.length > 0 && (
        <ListSection footer="Charging it to a fund spends from that fund's balance (e.g. marketing paid from the Newmux reserve).">
          <FieldRow label="Charge to fund">
            <Select value={f.fundPartyId} onChange={(e) => set("fundPartyId", e.target.value)}>
              <option value="">None</option>
              {funds.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        </ListSection>
      )}
      <ListSection>
        <div className="px-4 py-3">
          <Textarea placeholder="Notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {editing && <DeleteRow label="Delete Expense" onClick={remove} />}
    </FormSheet>
  );
}

export function RecurringExpenseSheet({ expense, onClose, links }: { expense: RecurringExpense | null | "new"; onClose: () => void; links: ExpenseLinks }) {
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const editing = expense && expense !== "new" ? expense : null;
  const blank = {
    name: "",
    amount: "",
    currency: "USD" as Currency,
    cycle: "monthly" as RecurringExpenseCycle,
    nextDueDate: "",
    category: "software subscription",
    clientId: "",
    projectId: "",
    ventureId: "",
    paidBy: "company",
  };
  const [f, setF] = useState(blank);
  const partners = links.parties.filter((p) => p.kind === "partner");

  useEffect(() => {
    if (!expense) return;
    setF(
      editing
        ? {
            name: editing.name,
            amount: String(minorToMajor(editing.amountCents, editing.currency)),
            currency: editing.currency,
            cycle: editing.cycle,
            nextDueDate: editing.nextDueDate ?? "",
            category: editing.category,
            clientId: editing.linkedClientId ?? "",
            projectId: editing.linkedProjectId ?? "",
            ventureId: editing.linkedVentureId ?? "",
            paidBy: editing.paidByPartyId ?? "company",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, editing]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    const payload = {
      name: f.name,
      amount: Number(f.amount),
      currency: f.currency,
      cycle: f.cycle,
      nextDueDate: f.nextDueDate,
      category: f.category,
      linkedClientId: f.clientId,
      linkedProjectId: f.projectId,
      linkedVentureId: f.ventureId,
      paidByPartyId: f.paidBy === "company" ? "" : f.paidBy,
    };
    const res = editing
      ? await run(`/api/finance/recurring-expenses/${editing.id}`, { method: "PATCH", body: payload, success: "Saved" })
      : await run("/api/finance/recurring-expenses", { body: payload, success: "Recurring expense added" });
    return !!res;
  };

  const action = async (path: string, success: string) => {
    if (editing && (await run(`/api/finance/recurring-expenses/${editing.id}/${path}`, { success }))) onClose();
  };

  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: `Delete “${editing.name}”?`, message: "Expenses already logged from it are kept.", destructive: true })) {
      if (await run(`/api/finance/recurring-expenses/${editing.id}`, { method: "DELETE", success: "Deleted" })) onClose();
    }
  };

  return (
    <FormSheet
      open={!!expense}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? editing.name : "New Recurring Expense"}
      submitLabel={editing ? "Save" : "Add"}
      canSubmit={!!f.name.trim() && Number(f.amount) > 0}
      onSubmit={submit}
    >
      {editing && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Button variant="tinted" disabled={pending || editing.status === "paused"} onClick={() => action("paid", "Logged as spent")}>
            Mark Paid
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => action("toggle", editing.status === "active" ? "Paused" : "Resumed")}>
            {editing.status === "active" ? "Pause" : "Resume"}
          </Button>
        </div>
      )}
      <ListSection>
        <PlainRowInput placeholder="Name (e.g. Microsoft 365)" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!editing} />
      </ListSection>
      <ListSection>
        <MoneyRow amount={f.amount} currency={f.currency} onAmount={(v) => set("amount", v)} onCurrency={(v) => set("currency", v)} />
        <FieldRow label="Repeats">
          <Select value={f.cycle} onChange={(e) => set("cycle", e.target.value as RecurringExpenseCycle)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Yearly</option>
          </Select>
        </FieldRow>
        <FieldRow label="Next due">
          <RowInput type="date" value={f.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
        </FieldRow>
        <CategoryRow value={f.category} onChange={(v) => set("category", v)} />
        <FieldRow label="Paid from">
          <Select value={f.paidBy} onChange={(e) => set("paidBy", e.target.value)}>
            <option value="company">Company account</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}&apos;s card
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection header="Link to" footer="Mark Paid logs each payment as an expense with these links; a partner's card makes it owed back to them.">
        <ClientProjectRows clients={links.clients} projects={links.projects} clientId={f.clientId} projectId={f.projectId} onClient={(v) => set("clientId", v)} onProject={(v) => set("projectId", v)} />
        <VentureRow value={f.ventureId} onChange={(v) => set("ventureId", v)} ventures={links.ventures} />
      </ListSection>
      {editing && <DeleteRow label="Delete Recurring Expense" onClick={remove} />}
    </FormSheet>
  );
}
