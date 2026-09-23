"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, Pencil, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { useConfirm } from "@/components/ui/Confirm";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListRow, ListSection, RowInput } from "@/components/ui/List";
import { Select } from "@/components/ui/Input";
import { useMutation } from "@/lib/useMutation";
import { centsToDisplay, minorToMajor } from "@/lib/money";
import { formatDate, todayYmd } from "@/lib/time";
import type { DocumentRecord, DocumentStatus, Payment, PaymentMethod } from "@/lib/data/types";

/**
 * The document's next steps. `menuOnly` renders the nav-bar "…" menu;
 * otherwise the primary buttons for the current status.
 */
export function DocumentActions({ doc, remainingCents, hasConversion, menuOnly }: { doc: DocumentRecord; remainingCents: number; hasConversion: boolean; menuOnly?: boolean }) {
  const router = useRouter();
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const [paying, setPaying] = useState(false);

  const transition = async (to: DocumentStatus, message: string) => {
    await run(`/api/documents/${doc.id}/transition`, { body: { to }, success: message });
  };

  if (menuOnly) {
    const items: MenuItem[] = [];
    if (doc.status === "draft") items.push({ label: "Edit", icon: Pencil, onSelect: () => router.push(`/documents/${doc.id}/edit`) });
    items.push({ label: "Download PDF", icon: Download, onSelect: () => (window.location.href = `/api/documents/generate-pdf?id=${doc.id}`) });
    if (doc.status === "sent") items.push({ label: "Back to Draft", icon: Undo2, onSelect: () => transition("draft", "Moved back to draft") });
    if (doc.status === "paid")
      items.push({
        label: "Archive",
        icon: Archive,
        onSelect: async () => {
          if (await confirm({ title: `Archive ${doc.documentNumber}?`, message: "Archived documents are read-only and hidden from open lists.", confirmLabel: "Archive" }))
            await transition("archived", "Archived");
        },
      });
    if (doc.status === "draft")
      items.push("separator", {
        label: "Delete Draft",
        icon: Trash2,
        destructive: true,
        onSelect: async () => {
          if (await confirm({ title: `Delete ${doc.documentNumber}?`, message: "This draft will be permanently deleted.", destructive: true })) {
            if (await run(`/api/documents/${doc.id}`, { method: "DELETE", success: "Draft deleted", refresh: false })) {
              router.push("/documents");
              router.refresh();
            }
          }
        },
      });
    return <Menu items={items} />;
  }

  const buttons: React.ReactNode[] = [];
  const primary = (label: string, onClick: () => void) =>
    buttons.push(
      <Button key={label} onClick={onClick} disabled={pending} className="flex-1">
        {label}
      </Button>,
    );
  const secondary = (label: string, onClick: () => void) =>
    buttons.push(
      <Button key={label} variant="secondary" onClick={onClick} disabled={pending} className="flex-1">
        {label}
      </Button>,
    );

  if (doc.status === "draft") {
    primary(doc.type === "invoice" ? "Send Invoice" : doc.type === "quote" ? "Send Quote" : "Send Contract", async () => {
      if (await confirm({ title: `Mark ${doc.documentNumber} as sent?`, message: "Line items and totals lock once it's sent.", confirmLabel: "Mark Sent" })) await transition("sent", "Marked as sent");
    });
    secondary("Edit", () => router.push(`/documents/${doc.id}/edit`));
  } else if (doc.type === "invoice" && ["sent", "accepted", "signed"].includes(doc.status) && remainingCents > 0) {
    primary("Record Payment", () => setPaying(true));
  } else if (doc.type === "quote" && doc.status === "sent") {
    primary("Mark Accepted", () => transition("accepted", "Quote accepted"));
  } else if (doc.type === "quote" && doc.status === "accepted" && !hasConversion) {
    primary("Convert to Invoice", async () => {
      if (!(await confirm({ title: "Create an invoice from this quote?", message: "Client, project and line items carry over. The quote stays as it is.", confirmLabel: "Convert" }))) return;
      const res = await run<{ invoice: { id: string; documentNumber: string } }>(`/api/documents/${doc.id}/convert-to-invoice`, { refresh: false });
      if (res) {
        router.push(`/documents/${res.invoice.id}`);
        router.refresh();
      }
    });
  } else if (doc.type === "contract" && doc.status === "sent") {
    primary("Mark Accepted", () => transition("accepted", "Accepted"));
  } else if (doc.type === "contract" && doc.status === "accepted") {
    primary("Mark Signed", () => transition("signed", "Signed"));
  }

  if (buttons.length === 0) return null;
  return (
    <>
      <div className="mt-5 flex gap-3">{buttons}</div>
      <PaymentSheet open={paying} onOpenChange={setPaying} doc={doc} remainingCents={remainingCents} />
    </>
  );
}

function PaymentSheet({ open, onOpenChange, doc, remainingCents }: { open: boolean; onOpenChange: (o: boolean) => void; doc: DocumentRecord; remainingCents: number }) {
  const { run } = useMutation();
  const [amount, setAmount] = useState(String(minorToMajor(remainingCents, doc.currency)));
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [paidOn, setPaidOn] = useState(todayYmd());
  const [reference, setReference] = useState("");

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setAmount(String(minorToMajor(remainingCents, doc.currency)));
      }}
      title="Record Payment"
      submitLabel="Record"
      size="auto"
      canSubmit={Number(amount) > 0}
      onSubmit={async () =>
        !!(await run(`/api/documents/${doc.id}/payments`, {
          body: { amount: Number(amount), method, paidOn, reference },
          success: "Payment recorded",
        }))
      }
    >
      <ListSection footer={`${centsToDisplay(remainingCents, doc.currency)} still owed on ${doc.documentNumber}.`}>
        <FieldRow label={`Amount (${doc.currency})`}>
          <RowInput inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="tabular" />
        </FieldRow>
        <FieldRow label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </Select>
        </FieldRow>
        <FieldRow label="Date">
          <RowInput type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </FieldRow>
        <FieldRow label="Reference">
          <RowInput placeholder="Optional" value={reference} onChange={(e) => setReference(e.target.value)} />
        </FieldRow>
      </ListSection>
    </FormSheet>
  );
}

const METHOD_LABEL: Record<PaymentMethod, string> = { transfer: "Bank transfer", cash: "Cash", card: "Card", cheque: "Cheque" };

export function PaymentRows({ payments, currency, canDelete }: { payments: Payment[]; currency: string; canDelete: boolean }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  if (payments.length === 0) return <ListRow title="No payments yet" />;
  return (
    <>
      {payments.map((p) => (
        <ListRow
          key={p.id}
          title={centsToDisplay(p.amountCents, currency)}
          subtitle={[formatDate(p.paidOn), METHOD_LABEL[p.method], p.reference].filter(Boolean).join(" · ")}
          onClick={
            canDelete
              ? async () => {
                  if (await confirm({ title: `Remove this ${centsToDisplay(p.amountCents, currency)} payment?`, message: "The invoice reopens if it was paid in full.", destructive: true, confirmLabel: "Remove Payment" }))
                    await run(`/api/payments/${p.id}`, { method: "DELETE", success: "Payment removed" });
                }
              : undefined
          }
        />
      ))}
    </>
  );
}
