"use client";

import { useEffect, useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow, MoneyRow } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { centsToDisplay, majorToMinorUnits, minorToMajor } from "@/lib/money";
import { formatDate, todayYmd } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { BankAccount, Currency, Party, Payout, PayoutType } from "@/lib/data/types";

/** Signed amount input ("−12.5" allowed). */
function SignedMoneyRow({ label, value, currency, onChange }: { label: string; value: string; currency: Currency; onChange: (v: string) => void }) {
  return (
    <FieldRow label={label}>
      <RowInput inputMode="decimal" placeholder={currency === "BHD" ? "0.000" : "0.00"} value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.-]/g, ""))} className="w-32 tabular" />
      <span className="ml-2 text-label-2">{currency}</span>
    </FieldRow>
  );
}

/** Add or edit a bank account and its opening balance (item 1). */
export function AccountSheet({ account, open, onOpenChange }: { account?: BankAccount; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const [f, setF] = useState({ name: "", currency: "BHD" as Currency, opening: "", date: todayYmd(), isDefault: false, isActive: true });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      account
        ? {
            name: account.name,
            currency: account.currency,
            opening: String(minorToMajor(account.openingBalanceCents, account.currency)),
            date: account.openingBalanceDate,
            isDefault: account.isDefault,
            isActive: account.isActive,
          }
        : { name: "Newmux account", currency: "BHD", opening: "", date: `${todayYmd().slice(0, 7)}-01`, isDefault: false, isActive: true },
    );
  }, [open, account]);

  const submit = async () => {
    const body = { name: f.name, currency: f.currency, openingBalance: Number(f.opening) || 0, openingBalanceDate: f.date, isDefault: f.isDefault, isActive: f.isActive };
    return !!(account
      ? await run(`/api/finance/accounts/${account.id}`, { method: "PATCH", body, success: "Account saved" })
      : await run("/api/finance/accounts", { body, success: "Account added" }));
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={account ? "Account" : "New Account"} submitLabel={account ? "Save" : "Add"} canSubmit={!!f.name.trim() && !!f.date && f.opening !== "" && !Number.isNaN(Number(f.opening))} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="Name (e.g. BBK current account)" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!account} />
        <FieldRow label="Currency">
          <Select value={f.currency} onChange={(e) => set("currency", e.target.value as Currency)}>
            <option value="BHD">BHD</option>
            <option value="USD">USD</option>
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection footer="The balance on the morning of this date, from the bank statement. Every payment, expense and payout dated on or after it is added to it.">
        <SignedMoneyRow label="Opening balance" value={f.opening} currency={f.currency} onChange={(v) => set("opening", v)} />
        <FieldRow label="As of">
          <RowInput type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </FieldRow>
      </ListSection>
      <ListSection footer="Payments, expenses and payouts that don't name an account use the default one.">
        <FieldRow label="Default account">
          <Toggle checked={f.isDefault} onChange={(v) => set("isDefault", v)} label="Default account" disabled={account?.isDefault} />
        </FieldRow>
        {account && (
          <FieldRow label="Active">
            <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Active" />
          </FieldRow>
        )}
      </ListSection>
      {account && !account.isDefault && (
        <DeleteRow
          label="Delete Account"
          onClick={async () => {
            if (await confirm({ title: `Delete “${account.name}”?`, message: "Only possible while no money has moved through it.", destructive: true }))
              if (await run(`/api/finance/accounts/${account.id}`, { method: "DELETE", success: "Account deleted" })) onOpenChange(false);
          }}
        />
      )}
    </FormSheet>
  );
}

/** Compare the balance with a bank statement and, if asked, post the difference (item 1). */
export function ReconcileSheet({ account, open, onOpenChange }: { account: BankAccount; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const [date, setDate] = useState(todayYmd());
  const [statement, setStatement] = useState("");
  const [note, setNote] = useState("");
  const [adjust, setAdjust] = useState(false);
  const [computed, setComputed] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDate(todayYmd());
      setStatement("");
      setNote("");
      setAdjust(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const ctrl = new AbortController();
    setComputed(null);
    fetch(`/api/finance/accounts/${account.id}?to=${date}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { balanceCents?: number }) => setComputed(typeof d.balanceCents === "number" ? d.balanceCents : null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [open, date, account.id]);

  const statementCents = statement !== "" && !Number.isNaN(Number(statement)) ? majorToMinorUnits(Number(statement), account.currency) : null;
  const diff = statementCents !== null && computed !== null ? statementCents - computed : null;

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Reconcile"
      submitLabel="Save"
      size="auto"
      canSubmit={statementCents !== null && date >= account.openingBalanceDate}
      onSubmit={async () =>
        !!(await run(`/api/finance/accounts/${account.id}/reconcile`, {
          body: { statementDate: date, statementBalance: Number(statement), adjust: adjust && diff !== 0, note },
          success: diff === 0 ? "Matches the bank" : adjust ? "Adjustment posted" : "Reconciliation saved",
        }))
      }
    >
      <ListSection footer={date < account.openingBalanceDate ? `Pick a date on or after ${formatDate(account.openingBalanceDate)}.` : undefined}>
        <FieldRow label="Statement date">
          <RowInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldRow>
        <SignedMoneyRow label="Bank says" value={statement} currency={account.currency} onChange={setStatement} />
        <FieldRow label="NEWMUX says">
          <span className="tabular text-label-2">{computed === null ? "…" : centsToDisplay(computed, account.currency)}</span>
        </FieldRow>
        {diff !== null && (
          <FieldRow label="Difference">
            <span className={cn("tabular font-semibold", diff === 0 ? "text-ios-green" : "text-ios-orange")}>{diff === 0 ? "Matches" : centsToDisplay(diff, account.currency)}</span>
          </FieldRow>
        )}
      </ListSection>
      {diff !== null && diff !== 0 && (
        <ListSection footer="Look for a missing payment or expense first. Post an adjustment only for bank fees or rounding you won't record separately.">
          <FieldRow label="Post the difference">
            <Toggle checked={adjust} onChange={setAdjust} label="Post the difference as an adjustment" />
          </FieldRow>
        </ListSection>
      )}
      <ListSection>
        <div className="px-4 py-3">
          <Textarea placeholder="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </ListSection>
    </FormSheet>
  );
}

export const PAYOUT_TYPE: Record<PayoutType, string> = { share: "Profit share", advance: "Advance", withdrawal: "Withdrawal", reimbursement: "Reimbursement" };

export type InvoiceOption = { id: string; label: string };

/** Record money paid to a partner (item 2). */
export function PayoutSheet({
  payout,
  open,
  onOpenChange,
  parties,
  accounts,
  invoices,
  defaultPartyId,
}: {
  payout?: Payout;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parties: Party[];
  accounts: BankAccount[];
  invoices: InvoiceOption[];
  defaultPartyId?: string;
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const blank = { partyId: defaultPartyId ?? "", type: "share" as PayoutType, amount: "", currency: "BHD" as Currency, paidOn: todayYmd(), documentId: "", accountId: "", reference: "", notes: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      payout
        ? {
            partyId: payout.partyId,
            type: payout.type,
            amount: String(minorToMajor(payout.amountCents, payout.currency)),
            currency: payout.currency,
            paidOn: payout.paidOn,
            documentId: payout.documentId ?? "",
            accountId: payout.accountId ?? "",
            reference: payout.reference ?? "",
            notes: payout.notes ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payout]);

  const submit = async () => {
    const body = { ...f, amount: Number(f.amount) };
    return !!(payout
      ? await run(`/api/finance/payouts/${payout.id}`, { method: "PATCH", body, success: "Payout saved" })
      : await run("/api/finance/payouts", { body, success: "Payout recorded" }));
  };

  const partners = parties.filter((p) => p.kind === "partner");
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={payout ? "Payout" : "New Payout"} submitLabel={payout ? "Save" : "Record"} canSubmit={!!f.partyId && Number(f.amount) > 0 && !!f.paidOn} onSubmit={submit}>
      <ListSection>
        <FieldRow label="Paid to">
          <Select value={f.partyId} onChange={(e) => set("partyId", e.target.value)}>
            <option value="">Choose…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Type">
          <Select value={f.type} onChange={(e) => set("type", e.target.value as PayoutType)}>
            {(Object.keys(PAYOUT_TYPE) as PayoutType[]).map((t) => (
              <option key={t} value={t}>
                {PAYOUT_TYPE[t]}
              </option>
            ))}
          </Select>
        </FieldRow>
        <MoneyRow amount={f.amount} currency={f.currency} onAmount={(v) => set("amount", v)} onCurrency={(v) => set("currency", v)} />
        <FieldRow label="Date">
          <RowInput type="date" value={f.paidOn} onChange={(e) => set("paidOn", e.target.value)} />
        </FieldRow>
        {accounts.length > 1 && (
          <FieldRow label="From account">
            <Select value={f.accountId} onChange={(e) => set("accountId", e.target.value)}>
              <option value="">Default account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
      </ListSection>
      <ListSection footer="Shares and advances count against what the partner is entitled to. Reimbursements pay back costs they covered personally.">
        <FieldRow label="For invoice">
          <Select value={f.documentId} onChange={(e) => set("documentId", e.target.value)}>
            <option value="">None</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <PlainRowInput placeholder="Reference (optional)" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
        <div className="px-4 py-3">
          <Textarea placeholder="Notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {payout && (
        <DeleteRow
          label="Delete Payout"
          onClick={async () => {
            if (await confirm({ title: "Delete this payout?", message: "The partner's balance and the account balance go back to before it.", destructive: true }))
              if (await run(`/api/finance/payouts/${payout.id}`, { method: "DELETE", success: "Payout deleted" })) onOpenChange(false);
          }}
        />
      )}
    </FormSheet>
  );
}
