"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Building2, CircleCheckBig, FileSignature, FileText, Handshake, HandCoins, Plus, Receipt } from "lucide-react";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { NavButton } from "@/components/ui/Page";
import { Sheet, SheetIconButton } from "@/components/ui/Sheet";
import { ListRow, ListSection } from "@/components/ui/List";
import { SearchField } from "@/components/ui/SearchField";
import { PaymentSheet } from "@/components/documents/PaymentSheet";
import { centsToDisplay } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { DocumentListItem } from "@/lib/data/documents";
import type { UserRole } from "@/lib/data/types";

type Extra = { label: string; icon?: React.ComponentType<{ className?: string }>; onSelect?: () => void; href?: string };

/** The signed-in role, so any screen's "+" knows which creates to offer. Set in the shell layout. */
export const RoleContext = createContext<UserRole>("lead_dev");

export function RoleProvider({ role, children }: { role: UserRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/**
 * The one "+" (item 24): the same five creates everywhere — Invoice,
 * Expense, Payment, Task, Client — with anything specific to the current
 * screen listed first.
 */
export function QuickAddMenu({
  role: roleProp,
  extra = [],
  className,
  persistent,
}: {
  role?: UserRole;
  extra?: Extra[];
  className?: string;
  /** The sidebar's "+", always shown. A screen's "+" with nothing specific hides on iPad/Mac, where the sidebar has it. */
  persistent?: boolean;
}) {
  const router = useRouter();
  const contextRole = useContext(RoleContext);
  const role = roleProp ?? contextRole;
  const [paying, setPaying] = useState(false);
  const go = (href: string) => () => router.push(href);
  const admin = role === "partner_admin";

  const items: MenuItem[] = extra.map((e) => ({ label: e.label, icon: e.icon ?? Plus, onSelect: e.onSelect ?? (e.href ? go(e.href) : () => {}) }));
  if (extra.length) items.push("separator");
  if (admin) {
    items.push(
      { label: "Invoice", icon: FileText, onSelect: go("/documents/new?type=invoice") },
      { label: "Expense", icon: Receipt, onSelect: go("/finance/expenses?new=1") },
      { label: "Payment", icon: HandCoins, onSelect: () => setPaying(true) },
      { label: "Task", icon: CircleCheckBig, onSelect: go("/tasks?new=1") },
      { label: "Client", icon: Building2, onSelect: go("/clients?new=1") },
      "separator",
      { label: "Quote", icon: FileSignature, onSelect: go("/documents/new?type=quote") },
      { label: "Deal", icon: Handshake, onSelect: go("/crm/pipeline?new=1") },
      { label: "Wiki Page", icon: BookOpen, onSelect: go("/wiki?new=1") },
    );
  } else {
    items.push({ label: "Task", icon: CircleCheckBig, onSelect: go("/tasks?new=1") }, { label: "Wiki Page", icon: BookOpen, onSelect: go("/wiki?new=1") });
  }

  return (
    <>
      <Menu
        label="Create"
        trigger={
          <NavButton label="Create" className={cn(extra.length === 0 && !persistent && "md:hidden", className)}>
            <Plus className="h-5 w-5" />
          </NavButton>
        }
        items={items}
      />
      {admin && <PayInvoicePicker open={paying} onOpenChange={setPaying} />}
    </>
  );
}

/** "+ → Payment": pick an unpaid invoice, then record the payment. */
export function PayInvoicePicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [invoices, setInvoices] = useState<DocumentListItem[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<DocumentListItem | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setInvoices(null);
    fetch("/api/documents?type=invoice")
      .then((r) => r.json())
      .then((d: { documents?: DocumentListItem[] }) => setInvoices((d.documents ?? []).filter((x) => x.status === "sent" && x.totalCents - x.creditedCents - x.paidCents > 0)))
      .catch(() => setInvoices([]));
  }, [open]);

  const term = q.trim().toLowerCase();
  const visible = (invoices ?? []).filter(
    (d) => !term || [d.clientName, d.clientShortName, d.documentNumber, d.externalRef].some((v) => v?.toLowerCase().includes(term)),
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title="Record Payment" left={<SheetIconButton label="Cancel" onClick={() => onOpenChange(false)} />}>
        <div className="mb-4">
          <SearchField value={q} onChange={setQ} placeholder="Client or invoice number" />
        </div>
        <ListSection header="Unpaid invoices">
          {invoices === null && <ListRow title="Loading…" />}
          {invoices !== null && visible.length === 0 && <ListRow title="No unpaid invoices" />}
          {visible.map((d) => (
            <ListRow
              key={d.id}
              onClick={() => {
                setPicked(d);
                onOpenChange(false);
              }}
              title={d.clientShortName ?? d.clientName}
              subtitle={[d.documentNumber, d.externalRef, d.dueAt ? `due ${formatDate(d.dueAt, { day: "numeric", month: "short" })}` : null].filter(Boolean).join(" · ")}
              detail={centsToDisplay(d.totalCents - d.creditedCents - d.paidCents, d.currency)}
              chevron
            />
          ))}
        </ListSection>
      </Sheet>
      {picked && (
        <PaymentSheet
          open={!!picked}
          onOpenChange={(o) => !o && setPicked(null)}
          doc={picked}
          remainingCents={picked.totalCents - picked.creditedCents - picked.paidCents}
        />
      )}
    </>
  );
}
