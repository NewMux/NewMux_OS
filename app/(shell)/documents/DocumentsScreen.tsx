"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchField } from "@/components/ui/SearchField";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import { centsToDisplay } from "@/lib/money";
import { formatDate, daysUntil } from "@/lib/time";
import type { DocumentListItem } from "@/lib/data/documents";
import type { DocumentType } from "@/lib/data/types";

type Filter = "all" | DocumentType;

export function DocumentsScreen({ documents }: { documents: DocumentListItem[] }) {
  const params = useSearchParams();
  const initial = (params.get("type") as Filter | null) ?? "all";
  const [filter, setFilter] = useState<Filter>(["all", "quote", "invoice", "contract"].includes(initial) ? initial : "all");
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return documents.filter(
      (d) =>
        (filter === "all" || d.type === filter) &&
        (showArchived || d.status !== "archived") &&
        (!term || d.documentNumber.toLowerCase().includes(term) || d.clientName.toLowerCase().includes(term)),
    );
  }, [documents, filter, q, showArchived]);

  const open = visible.filter((d) => d.status !== "paid" && d.status !== "archived");
  const closed = visible.filter((d) => d.status === "paid" || d.status === "archived");
  const newType = filter === "all" ? "invoice" : filter;
  const archivedCount = documents.filter((d) => d.status === "archived").length;

  const row = (d: DocumentListItem) => {
    const status = DOC_STATUS[d.status];
    const overdue = d.type === "invoice" && d.dueAt && !["paid", "archived", "draft"].includes(d.status) && daysUntil(d.dueAt) < 0;
    const partial = d.type === "invoice" && d.paidCents > 0 && d.paidCents < d.totalCents;
    return (
      <ListRow
        key={d.id}
        href={`/documents/${d.id}`}
        title={
          <span className="flex items-center gap-2">
            <span className="truncate">{d.clientName}</span>
          </span>
        }
        subtitle={`${d.documentNumber} · ${DOC_TYPE[d.type]}${d.dueAt && d.type === "invoice" ? ` · due ${formatDate(d.dueAt, { day: "numeric", month: "short" })}` : ""}`}
        detail={
          <span className="flex flex-col items-end gap-0.5">
            <span className="text-label">{centsToDisplay(d.totalCents, d.currency)}</span>
            {overdue ? <Badge color="red">Overdue</Badge> : partial ? <Badge color="orange">Partly paid</Badge> : <Badge color={status.color}>{status.label}</Badge>}
          </span>
        }
      />
    );
  };

  return (
    <Page
      title="Invoices & Quotes"
      back={{ href: "/finance", label: "Finance" }}
      actions={
        <NavButton label={`New ${DOC_TYPE[newType]}`} href={`/documents/new?type=${newType}`}>
          <Plus className="h-5 w-5" />
        </NavButton>
      }
      accessory={
        <div className="space-y-3">
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "invoice", label: "Invoices" },
              { value: "quote", label: "Quotes" },
              { value: "contract", label: "Contracts" },
            ]}
          />
          <SearchField value={q} onChange={setQ} placeholder="Number or client" />
        </div>
      }
    >
      {visible.length === 0 && <EmptyState icon={FileText} title="Nothing here yet" message="Create a quote or invoice with the + button." />}
      {open.length > 0 && <ListSection header="Open">{open.map(row)}</ListSection>}
      {closed.length > 0 && <ListSection header="Closed">{closed.map(row)}</ListSection>}
      {archivedCount > 0 && (
        <button type="button" onClick={() => setShowArchived((s) => !s)} className="mx-auto block text-subhead text-accent">
          {showArchived ? "Hide archived" : `Show ${archivedCount} archived`}
        </button>
      )}
    </Page>
  );
}
