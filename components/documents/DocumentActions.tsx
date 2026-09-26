"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Ban, Copy, Download, FileMinus, Mail, MessageCircle, Pencil, PieChart, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { useConfirm } from "@/components/ui/Confirm";
import { FormSheet } from "@/components/ui/FormSheet";
import { Sheet, SheetIconButton } from "@/components/ui/Sheet";
import { FieldRow, ListRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Textarea } from "@/components/ui/Input";
import { PaymentSheet } from "./PaymentSheet";
import { useMutation } from "@/lib/useMutation";
import { centsToDisplay } from "@/lib/money";
import { DOC_TYPE, PAYMENT_METHOD } from "@/lib/labels";
import { formatDate, todayYmd, toYmd } from "@/lib/time";
import type { DocumentRecord, DocumentStatus, Payment } from "@/lib/data/types";

export type DocumentContext = {
  /** Still owed on an invoice (after credit notes), or left to refund on a credit note. */
  remainingCents: number;
  paidCents: number;
  /** Quotes: how much is already invoiced. */
  invoicedCents: number;
  /** For reminders. */
  clientName: string;
  contactName?: string | null;
  email?: string | null;
  whatsapp?: string | null;
};

/**
 * Each status offers its logical next step (item 34). `menuOnly` renders
 * the nav-bar "…" menu; otherwise the primary buttons for the current status.
 */
export function DocumentActions({ doc, ctx, menuOnly }: { doc: DocumentRecord; ctx: DocumentContext; menuOnly?: boolean }) {
  const router = useRouter();
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [depositing, setDepositing] = useState(false);

  const transition = async (to: DocumentStatus, message: string) => {
    await run(`/api/documents/${doc.id}/transition`, { body: { to }, success: message });
  };
  const convert = async (mode: "full" | "deposit" | "balance", depositPercent?: number) => {
    const res = await run<{ invoice: { id: string; documentNumber: string } }>(`/api/documents/${doc.id}/convert-to-invoice`, {
      body: { mode, depositPercent },
      refresh: false,
      success: "Invoice created",
    });
    if (res) {
      router.push(`/documents/${res.invoice.id}`);
      router.refresh();
    }
  };

  const isInvoice = doc.type === "invoice";
  const isQuote = doc.type === "quote";
  const open = isInvoice && doc.status === "sent" && ctx.remainingCents > 0;
  const overdue = open && !!doc.dueAt && doc.dueAt < todayYmd();

  const sheets = (
    <>
      <PaymentSheet open={paying} onOpenChange={setPaying} doc={doc} remainingCents={ctx.remainingCents} />
      <VoidSheet open={voiding} onOpenChange={setVoiding} doc={doc} paidCents={ctx.paidCents} />
      <DetailsSheet open={editingDetails} onOpenChange={setEditingDetails} doc={doc} />
      <ReminderSheet open={reminding} onOpenChange={setReminding} doc={doc} ctx={ctx} />
      <DepositSheet open={depositing} onOpenChange={setDepositing} doc={doc} onCreate={(pct) => convert("deposit", pct)} />
    </>
  );

  if (menuOnly) {
    const items: MenuItem[] = [];
    if (doc.status === "draft") items.push({ label: "Edit", icon: Pencil, onSelect: () => router.push(`/documents/${doc.id}/edit`) });
    else if (doc.status !== "void") items.push({ label: "Edit Details", icon: Pencil, onSelect: () => setEditingDetails(true) });
    items.push({ label: "Download PDF", icon: Download, onSelect: () => (window.location.href = `/api/documents/generate-pdf?id=${doc.id}`) });
    if (isInvoice && doc.status !== "draft" && doc.status !== "void") {
      items.push({ label: "Profit Split", icon: PieChart, onSelect: () => document.getElementById("split")?.scrollIntoView({ behavior: "smooth" }) });
      items.push({ label: "Issue Credit Note", icon: FileMinus, onSelect: () => router.push(`/documents/new?type=credit_note&creditFor=${doc.id}`) });
    }
    if (doc.type === "credit_note" && doc.status === "sent" && ctx.remainingCents > 0) items.push({ label: "Record Refund", icon: Undo2, onSelect: () => setPaying(true) });
    if (doc.status === "sent" && !(isInvoice && ctx.paidCents > 0)) items.push({ label: "Back to Draft", icon: Undo2, onSelect: () => transition("draft", "Moved back to draft") });
    if (isQuote && doc.status === "declined") items.push({ label: "Reopen", icon: Undo2, onSelect: () => transition("sent", "Reopened") });
    if (["paid", "signed", "accepted", "declined"].includes(doc.status))
      items.push({
        label: "Archive",
        icon: Archive,
        onSelect: async () => {
          if (await confirm({ title: `Archive ${doc.documentNumber}?`, message: "Archived documents are filed away but still count in reports.", confirmLabel: "Archive" }))
            await transition("archived", "Archived");
        },
      });
    if (["sent", "paid", "accepted", "signed"].includes(doc.status)) items.push("separator", { label: "Void…", icon: Ban, destructive: true, onSelect: () => setVoiding(true) });
    if (doc.status === "draft" || doc.status === "void")
      items.push("separator", {
        label: doc.status === "draft" ? "Delete Draft" : "Purge",
        icon: Trash2,
        destructive: true,
        onSelect: async () => {
          const ok = await confirm({
            title: doc.status === "draft" ? `Delete ${doc.documentNumber}?` : `Purge ${doc.documentNumber}?`,
            message:
              doc.status === "draft"
                ? "This draft will be permanently deleted."
                : "For test data only: the document, its payments and history are permanently removed. The audit log keeps a note.",
            destructive: true,
            confirmLabel: doc.status === "draft" ? "Delete" : "Purge",
          });
          if (ok && (await run(`/api/documents/${doc.id}`, { method: "DELETE", success: doc.status === "draft" ? "Draft deleted" : "Purged", refresh: false }))) {
            router.push("/documents");
            router.refresh();
          }
        },
      });
    return (
      <>
        <Menu items={items} />
        {sheets}
      </>
    );
  }

  const buttons: React.ReactNode[] = [];
  const add = (label: string, onClick: () => void, variant: "default" | "secondary" | "tinted" = "default") =>
    buttons.push(
      <Button key={label} variant={variant} onClick={onClick} disabled={pending} className="flex-1">
        {label}
      </Button>,
    );

  if (doc.status === "draft") {
    add(`Send ${DOC_TYPE[doc.type]}`, async () => {
      if (await confirm({ title: `Mark ${doc.documentNumber} as ${doc.type === "credit_note" ? "issued" : "sent"}?`, message: "Line items and totals lock once it's sent.", confirmLabel: "Mark Sent" }))
        await transition("sent", doc.type === "credit_note" ? "Credit note issued" : "Marked as sent");
    });
    add("Edit", () => router.push(`/documents/${doc.id}/edit`), "secondary");
  } else if (open) {
    add("Record Payment", () => setPaying(true));
    add(overdue ? "Send Reminder" : "Remind", () => setReminding(true), overdue ? "tinted" : "secondary");
  } else if (isQuote && doc.status === "sent") {
    add("Mark Accepted", () => transition("accepted", "Quote accepted — deal won"));
    add("Declined", () => transition("declined", "Quote declined — deal lost"), "secondary");
  } else if (isQuote && doc.status === "accepted") {
    const left = doc.totalCents - ctx.invoicedCents;
    if (ctx.invoicedCents === 0) {
      add("Create 50% Deposit Invoice", () => setDepositing(true));
      add("Invoice in Full", () => convert("full"), "secondary");
    } else if (left > 0) {
      add(`Invoice Remaining ${centsToDisplay(left, doc.currency)}`, () => convert("balance"));
    }
  } else if (doc.type === "contract" && (doc.status === "sent" || doc.status === "accepted")) {
    add("Mark Signed", () => transition("signed", "Signed"));
  }

  return (
    <>
      {buttons.length > 0 && <div className="mt-5 flex gap-3">{buttons}</div>}
      {sheets}
    </>
  );
}

/** Void with a reason (item 9). */
function VoidSheet({ open, onOpenChange, doc, paidCents }: { open: boolean; onOpenChange: (o: boolean) => void; doc: DocumentRecord; paidCents: number }) {
  const { run } = useMutation();
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Void ${doc.documentNumber}`}
      submitLabel="Void"
      size="auto"
      canSubmit={!!reason.trim()}
      onSubmit={async () => !!(await run(`/api/documents/${doc.id}/transition`, { body: { to: "void", reason }, success: "Voided" }))}
    >
      <ListSection
        footer={
          paidCents > 0
            ? `The ${centsToDisplay(paidCents, doc.currency)} recorded on it stops counting too. To give back part of a real invoice, issue a credit note instead.`
            : "A void document stays on record but is left out of every report, balance and total."
        }
      >
        <div className="px-4 py-3">
          <Textarea autoFocus placeholder="Reason (e.g. Demo data, Sent to the wrong client)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </ListSection>
    </FormSheet>
  );
}

/** Issue date, due date, external reference, terms and notes of a sent document (items 7, 8). */
function DetailsSheet({ open, onOpenChange, doc }: { open: boolean; onOpenChange: (o: boolean) => void; doc: DocumentRecord }) {
  const { run } = useMutation();
  const archived = doc.status === "archived";
  const blank = () => ({
    issuedAt: doc.issuedAt ? toYmd(doc.issuedAt) : todayYmd(),
    dueAt: doc.dueAt ?? "",
    externalRef: doc.externalRef ?? "",
    paymentTerms: doc.paymentTerms ?? "",
    notes: doc.notes ?? "",
  });
  const [f, setF] = useState(blank);
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (open) setF(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Details"
      canSubmit={!!f.issuedAt}
      onSubmit={async () =>
        !!(await run(`/api/documents/${doc.id}`, {
          method: "PATCH",
          body: archived ? { issuedAt: f.issuedAt, externalRef: f.externalRef, notes: f.notes } : f,
          success: "Saved",
        }))
      }
    >
      <ListSection footer="The issue date decides which month the document counts in.">
        <FieldRow label="Issued">
          <RowInput type="date" value={f.issuedAt} onChange={(e) => set("issuedAt", e.target.value)} />
        </FieldRow>
        {!archived && doc.type !== "quote" && (
          <FieldRow label="Due">
            <RowInput type="date" value={f.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
          </FieldRow>
        )}
        <FieldRow label="Original number">
          <RowInput placeholder="e.g. #00267" value={f.externalRef} onChange={(e) => set("externalRef", e.target.value)} />
        </FieldRow>
      </ListSection>
      <ListSection>
        {!archived && <PlainRowInput placeholder="Payment terms" value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />}
        <div className="px-4 py-3">
          <Textarea placeholder="Notes shown on the document" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
    </FormSheet>
  );
}

/** Deposit invoice from an accepted quote (item 34). */
function DepositSheet({ open, onOpenChange, doc, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; doc: DocumentRecord; onCreate: (pct: number) => Promise<void> }) {
  const [pct, setPct] = useState("50");
  useEffect(() => {
    if (open) setPct("50");
  }, [open]);
  const n = Number(pct);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Deposit Invoice"
      submitLabel="Create"
      size="auto"
      canSubmit={n >= 1 && n <= 100}
      onSubmit={async () => {
        await onCreate(n);
        return true;
      }}
    >
      <ListSection footer={n >= 1 && n <= 100 ? `${centsToDisplay(Math.round((doc.totalCents * n) / 100), doc.currency)} of ${centsToDisplay(doc.totalCents, doc.currency)}. Invoice the balance from the quote later.` : "Between 1% and 100%."}>
        <FieldRow label="Deposit">
          <RowInput inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ""))} className="w-16 tabular" />
          <span className="ml-1 text-label-2">%</span>
        </FieldRow>
      </ListSection>
    </FormSheet>
  );
}

/** A prefilled payment or quote reminder by email or WhatsApp, logged on the client's timeline (item 34). */
function ReminderSheet({ open, onOpenChange, doc, ctx }: { open: boolean; onOpenChange: (o: boolean) => void; doc: DocumentRecord; ctx: DocumentContext }) {
  const { run } = useMutation();
  const ref = doc.externalRef ? `${doc.documentNumber} (${doc.externalRef})` : doc.documentNumber;
  const greeting = ctx.contactName ? `Dear ${ctx.contactName.split(/[\s—-]/)[0]},` : "Hello,";
  const initial =
    doc.type === "invoice"
      ? `${greeting}\n\nA friendly reminder that invoice ${ref} has ${centsToDisplay(ctx.remainingCents, doc.currency)} outstanding${doc.dueAt ? `, due ${formatDate(doc.dueAt)}` : ""}.\n\nThank you,\nNEWMUX`
      : `${greeting}\n\nFollowing up on quote ${ref} for ${centsToDisplay(doc.totalCents, doc.currency)}. Let us know if you have any questions.\n\nThank you,\nNEWMUX`;
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (open) setText(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const subject = doc.type === "invoice" ? `Payment reminder: ${ref}` : `Quote ${ref}`;
  const log = (kind: "email" | "whatsapp") =>
    run("/api/activities", { body: { kind, subject: `Reminder sent: ${ref}`, body: text, clientId: doc.clientId, dealId: doc.dealId }, refresh: false });
  const phone = ctx.whatsapp?.replace(/[^\d]/g, "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reminder" size="auto" left={<SheetIconButton label="Close" onClick={() => onOpenChange(false)} />}>
      <ListSection header={`To ${ctx.clientName}`}>
        <div className="px-4 py-3">
          <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </ListSection>
      <ListSection footer="Sending opens your mail or WhatsApp app with this text, and notes the reminder on the client's timeline.">
        <ListRow
          leading={<Mail className="h-5 w-5 text-accent" />}
          title="Email"
          subtitle={ctx.email ?? "No email on file"}
          onClick={() => {
            window.location.href = `mailto:${ctx.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
            void log("email");
            onOpenChange(false);
          }}
          chevron
        />
        <ListRow
          leading={<MessageCircle className="h-5 w-5 text-ios-green" />}
          title="WhatsApp"
          subtitle={phone ? ctx.whatsapp : "No WhatsApp number on file"}
          onClick={() => {
            window.open(`https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
            void log("whatsapp");
            onOpenChange(false);
          }}
          chevron
        />
        <ListRow
          leading={<Copy className="h-5 w-5 text-label-2" />}
          title="Copy text"
          onClick={async () => {
            await navigator.clipboard?.writeText(text);
            toast.success("Copied");
            void log("email");
          }}
        />
        <ListRow
          leading={<Send className="h-5 w-5 text-label-2" />}
          title="Mark as reminded"
          onClick={async () => {
            if (await log("email")) {
              toast.success("Noted on the timeline");
              onOpenChange(false);
            }
          }}
        />
      </ListSection>
    </Sheet>
  );
}

export function PaymentRows({ payments, currency, canDelete, refund }: { payments: Payment[]; currency: string; canDelete: boolean; refund?: boolean }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  if (payments.length === 0) return <ListRow title={refund ? "No refunds recorded" : "No payments yet"} />;
  return (
    <>
      {payments.map((p) => (
        <ListRow
          key={p.id}
          title={centsToDisplay(p.amountCents, currency)}
          subtitle={[formatDate(p.paidOn), PAYMENT_METHOD[p.method] ?? p.method, p.reference].filter(Boolean).join(" · ")}
          onClick={
            canDelete
              ? async () => {
                  if (
                    await confirm({
                      title: `Remove this ${centsToDisplay(p.amountCents, currency)} ${refund ? "refund" : "payment"}?`,
                      message: refund ? undefined : "The invoice reopens if it was paid in full.",
                      destructive: true,
                      confirmLabel: refund ? "Remove Refund" : "Remove Payment",
                    })
                  )
                    await run(`/api/payments/${p.id}`, { method: "DELETE", success: "Removed" });
                }
              : undefined
          }
        />
      ))}
    </>
  );
}
