"use client";

import { useEffect, useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, RowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { useMutation } from "@/lib/useMutation";
import { centsToDisplay, minorToMajor } from "@/lib/money";
import { PAYMENT_METHOD } from "@/lib/labels";
import { todayYmd } from "@/lib/time";
import type { BankAccount, Currency, PaymentMethod } from "@/lib/data/types";

export type PayableDoc = { id: string; documentNumber: string; currency: Currency; type: "invoice" | "credit_note" | string };

/** Accounts for the "Into account" picker, fetched once per page. */
let accountsCache: Promise<BankAccount[]> | null = null;
function useAccounts(open: boolean) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  useEffect(() => {
    if (!open) return;
    accountsCache ??= fetch("/api/finance/accounts")
      .then((r) => r.json())
      .then((d: { accounts?: { account: BankAccount }[] }) => (d.accounts ?? []).map((a) => a.account).filter((a) => a.isActive))
      .catch(() => []);
    void accountsCache.then(setAccounts);
  }, [open]);
  return accounts;
}

/**
 * Record a payment on an invoice, or a refund paid on a credit note.
 * Used on the document, from list rows (item 35) and from the global + (item 24).
 */
export function PaymentSheet({
  open,
  onOpenChange,
  doc,
  remainingCents,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: PayableDoc;
  remainingCents: number;
  onDone?: () => void;
}) {
  const { run } = useMutation();
  const accounts = useAccounts(open);
  const refund = doc.type === "credit_note";
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [paidOn, setPaidOn] = useState(todayYmd());
  const [reference, setReference] = useState("");
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(String(minorToMajor(remainingCents, doc.currency)));
    setPaidOn(todayYmd());
    setReference("");
  }, [open, remainingCents, doc.currency]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={refund ? "Record Refund" : "Record Payment"}
      submitLabel="Record"
      size="auto"
      canSubmit={Number(amount) > 0}
      onSubmit={async () => {
        const ok = !!(await run(`/api/documents/${doc.id}/payments`, {
          body: { amount: Number(amount), method, paidOn, reference, accountId },
          success: refund ? "Refund recorded" : "Payment recorded",
        }));
        if (ok) onDone?.();
        return ok;
      }}
    >
      <ListSection footer={refund ? `${centsToDisplay(remainingCents, doc.currency)} left to refund on ${doc.documentNumber}.` : `${centsToDisplay(remainingCents, doc.currency)} still owed on ${doc.documentNumber}.`}>
        <FieldRow label={`Amount (${doc.currency})`}>
          <RowInput inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="tabular" />
        </FieldRow>
        <FieldRow label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD[m]}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Date">
          <RowInput type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </FieldRow>
        {accounts.length > 1 && (
          <FieldRow label={refund ? "From account" : "Into account"}>
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
      </ListSection>
    </FormSheet>
  );
}
