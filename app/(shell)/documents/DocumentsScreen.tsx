"use client";

import { useContext, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, FileText, Plus, X } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchField } from "@/components/ui/SearchField";
import { ListRow, ListSection } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaymentSheet } from "@/components/documents/PaymentSheet";
import { SplitWideContext } from "@/components/shell/SplitView";
import { DOC_TYPE, docStatusLabel } from "@/lib/labels";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { addDaysYmd, addMonthsYmd, formatDate, monthStartYmd, todayYmd, toYmd } from "@/lib/time";
import { cn, plural } from "@/lib/utils";
import type { SysColor } from "@/lib/colors";
import type { DocumentListItem } from "@/lib/data/documents";
import type { DocumentType } from "@/lib/data/types";

type TypeFilter = "all" | DocumentType;
type StatusFilter = "any" | "open" | "unpaid" | "overdue" | "paid" | "draft" | "void";
type DateFilter = "any" | "this-month" | "last-month" | "this-year" | "last-year" | "custom";

const STATUS_LABEL: Record<StatusFilter, string> = {
  any: "Any status",
  open: "Open",
  unpaid: "Unpaid",
  overdue: "Overdue",
  paid: "Paid",
  draft: "Draft",
  void: "Void",
};
const DATE_LABEL: Record<DateFilter, string> = {
  any: "Any date",
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  "last-year": "Last year",
  custom: "Custom…",
};

const outstanding = (d: DocumentListItem) => (d.type === "invoice" && d.status === "sent" ? Math.max(d.totalCents - d.creditedCents - d.paidCents, 0) : 0);
const isOverdue = (d: DocumentListItem) => outstanding(d) > 0 && !!d.dueAt && d.dueAt < todayYmd();
const isClosed = (d: DocumentListItem) =>
  ["paid", "archived", "void", "declined"].includes(d.status) || (d.type === "invoice" && d.status === "sent" && outstanding(d) === 0) || (d.type === "credit_note" && d.status === "sent");

export function docBadge(d: DocumentListItem): { label: string; color: SysColor } {
  if (d.status === "void") return { label: "Void", color: "gray" };
  if (isOverdue(d)) return { label: "Overdue", color: "red" };
  if (d.type === "invoice" && d.status === "sent" && d.paidCents > 0 && outstanding(d) > 0) return { label: "Partly paid", color: "orange" };
  if (d.type === "invoice" && d.status === "sent" && outstanding(d) === 0) return { label: "Paid", color: "green" };
  const colors: Record<string, SysColor> = { draft: "gray", sent: "blue", accepted: "indigo", declined: "red", signed: "purple", paid: "green", archived: "gray" };
  return { label: docStatusLabel(d.type, d.status), color: colors[d.status] ?? "gray" };
}

function range(filter: DateFilter, custom: { from: string; to: string }): [string, string] | null {
  const month = monthStartYmd();
  const year = `${todayYmd().slice(0, 4)}-01-01`;
  switch (filter) {
    case "this-month":
      return [month, addMonthsYmd(month, 1)];
    case "last-month":
      return [addMonthsYmd(month, -1), month];
    case "this-year":
      return [year, addMonthsYmd(year, 12)];
    case "last-year":
      return [addMonthsYmd(year, -12), year];
    case "custom":
      // "To" is inclusive.
      return custom.from || custom.to ? [custom.from || "0000-01-01", custom.to ? addDaysYmd(custom.to, 1) : "9999-12-31"] : null;
    default:
      return null;
  }
}

/** A native <select> dressed as a filter chip. */
function Chip<T extends string>({ value, onChange, options, active, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; active: boolean; label: string }) {
  return (
    <label className={cn("relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full pl-3 pr-2 text-subhead font-medium", active ? "bg-accent text-white" : "bg-fill/[0.12] text-label")}>
      <span className="max-w-[160px] truncate">{options.find(([v]) => v === value)?.[1] ?? label}</span>
      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Invoices, quotes, contracts and credit notes (item 23: one name — Documents — everywhere). */
export function DocumentsScreen({ documents }: { documents: DocumentListItem[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const wide = useContext(SplitWideContext);
  const initialType = (params.get("type") as TypeFilter | null) ?? "all";
  const [type, setType] = useState<TypeFilter>(["all", "quote", "invoice", "contract", "credit_note"].includes(initialType) ? initialType : "all");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter | null) ?? "any");
  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [projectId, setProjectId] = useState(params.get("project") ?? "");
  const [dates, setDates] = useState<DateFilter>("any");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [q, setQ] = useState("");
  const [paying, setPaying] = useState<DocumentListItem | null>(null);

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of documents) m.set(d.clientId, d.clientShortName ?? d.clientName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [documents]);
  const projects = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of documents) if (d.projectId && d.projectName && (!clientId || d.clientId === clientId)) m.set(d.projectId, d.projectName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [documents, clientId]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const window = range(dates, custom);
    return documents.filter((d) => {
      if (type !== "all" && d.type !== type) return false;
      if (clientId && d.clientId !== clientId) return false;
      if (projectId && d.projectId !== projectId) return false;
      if (status === "any" && d.status === "void") return false;
      if (status === "open" && isClosed(d)) return false;
      if (status === "unpaid" && outstanding(d) === 0) return false;
      if (status === "overdue" && !isOverdue(d)) return false;
      if (status === "paid" && !(d.type === "invoice" && (d.status === "paid" || d.status === "archived" || (d.status === "sent" && outstanding(d) === 0)))) return false;
      if (status === "draft" && d.status !== "draft") return false;
      if (status === "void" && d.status !== "void") return false;
      if (window) {
        const issued = d.issuedAt ? toYmd(d.issuedAt) : null;
        if (!issued || issued < window[0] || issued >= window[1]) return false;
      }
      if (term && ![d.documentNumber, d.externalRef, d.clientName, d.clientShortName, d.projectName].some((v) => v?.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [documents, type, status, clientId, projectId, dates, custom, q]);

  const totals = useMemo(() => {
    const bhd = (d: DocumentListItem, v: number) => convertMinorUnits(d.type === "credit_note" ? -v : v, d.currency, "BHD");
    return {
      value: visible.reduce((s, d) => s + bhd(d, d.totalCents), 0),
      outstanding: visible.reduce((s, d) => s + bhd(d, outstanding(d)), 0),
    };
  }, [visible]);

  const filtered = status !== "any" || !!clientId || !!projectId || dates !== "any" || type !== "all" || !!q;
  const clear = () => {
    setType("all");
    setStatus("any");
    setClientId("");
    setProjectId("");
    setDates("any");
    setCustom({ from: "", to: "" });
    setQ("");
    router.replace("/documents", { scroll: false });
  };
  const newType = type === "all" || type === "credit_note" ? "invoice" : type;
  const open = visible.filter((d) => !isClosed(d));
  const closed = visible.filter(isClosed);

  const payButton = (d: DocumentListItem) =>
    outstanding(d) > 0 ? (
      <Button
        size="sm"
        variant={isOverdue(d) ? "destructive-tinted" : "tinted"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPaying(d);
        }}
      >
        Pay
      </Button>
    ) : null;

  const row = (d: DocumentListItem) => {
    const badge = docBadge(d);
    const owed = outstanding(d);
    return (
      <ListRow
        key={d.id}
        href={`/documents/${d.id}`}
        multiline
        title={<span className="line-clamp-2">{d.clientShortName ?? d.clientName}</span>}
        subtitle={[
          d.externalRef ?? d.documentNumber,
          DOC_TYPE[d.type],
          d.projectName,
          owed > 0 && d.paidCents > 0 ? `${centsToDisplay(owed, d.currency)} left` : null,
          d.dueAt && owed > 0 ? `due ${formatDate(d.dueAt, { day: "numeric", month: "short" })}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        detail={
          <span className="flex flex-col items-end gap-0.5">
            <span className="text-label">
              {d.type === "credit_note" ? "− " : ""}
              {centsToDisplay(d.totalCents, d.currency)}
            </span>
            <Badge color={badge.color}>{badge.label}</Badge>
          </span>
        }
        trailing={payButton(d)}
      />
    );
  };

  const filters = (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      <Chip label="Status" value={status} onChange={setStatus} active={status !== "any"} options={(Object.keys(STATUS_LABEL) as StatusFilter[]).map((k) => [k, STATUS_LABEL[k]])} />
      <Chip
        label="Client"
        value={clientId}
        onChange={(v) => {
          setClientId(v);
          setProjectId("");
        }}
        active={!!clientId}
        options={[["", "Any client"], ...clients]}
      />
      {projects.length > 0 && <Chip label="Project" value={projectId} onChange={setProjectId} active={!!projectId} options={[["", "Any project"], ...projects]} />}
      <Chip label="Issued" value={dates} onChange={setDates} active={dates !== "any"} options={(Object.keys(DATE_LABEL) as DateFilter[]).map((k) => [k, DATE_LABEL[k]])} />
      {dates === "custom" && (
        <span className="flex shrink-0 items-center gap-1 text-subhead">
          <input type="date" aria-label="From" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 rounded-full bg-fill/[0.12] px-3" />
          <span className="text-label-2">–</span>
          <input type="date" aria-label="To" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 rounded-full bg-fill/[0.12] px-3" />
        </span>
      )}
      {filtered && (
        <button type="button" onClick={clear} className="press flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-subhead text-accent">
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );

  return (
    <Page
      title="Documents"
      wide={wide}
      back={{ href: "/finance", label: "Finance" }}
      actions={
        <NavButton label={`New ${DOC_TYPE[newType]}`} href={`/documents/new?type=${newType}`}>
          <Plus className="h-5 w-5" />
        </NavButton>
      }
      accessory={
        <div className="space-y-3">
          <SegmentedControl
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "All" },
              { value: "invoice", label: "Invoices" },
              { value: "quote", label: "Quotes" },
              { value: "contract", label: "Contracts" },
              ...(wide || documents.some((d) => d.type === "credit_note") ? [{ value: "credit_note" as const, label: "Credits" }] : []),
            ]}
          />
          <SearchField value={q} onChange={setQ} placeholder="Client, number or original number" />
          {filters}
          <p className="px-1 text-footnote text-label-2 tabular" aria-live="polite">
            {plural(visible.length, "document")} · {centsToDisplay(totals.value, "BHD")}
            {totals.outstanding > 0 && <> · <span className="text-label">{centsToDisplay(totals.outstanding, "BHD")} outstanding</span></>}
          </p>
        </div>
      }
    >
      {visible.length === 0 && (
        <EmptyState icon={FileText} title={filtered ? "No matching documents" : "Nothing here yet"} message={filtered ? "Try another filter." : "Create a quote or invoice with the + button."} />
      )}
      {wide ? (
        visible.length > 0 && <DocumentTable documents={visible} payButton={payButton} />
      ) : (
        <>
          {open.length > 0 && <ListSection header="Open">{open.map(row)}</ListSection>}
          {closed.length > 0 && <ListSection header="Closed">{closed.map(row)}</ListSection>}
        </>
      )}
      {status === "any" && documents.some((d) => d.status === "void") && (
        <button type="button" onClick={() => setStatus("void")} className="mx-auto block text-subhead text-accent">
          Show {plural(documents.filter((d) => d.status === "void").length, "void document")}
        </button>
      )}
      {paying && (
        <PaymentSheet open={!!paying} onOpenChange={(o) => !o && setPaying(null)} doc={paying} remainingCents={outstanding(paying)} />
      )}
    </Page>
  );
}

/** iPad landscape / Mac with nothing open: the whole list as a table (item 32). */
function DocumentTable({ documents, payButton }: { documents: DocumentListItem[]; payButton: (d: DocumentListItem) => React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-card bg-bg-elevated">
      <table className="w-full text-left text-subhead">
        <thead className="text-footnote text-label-2">
          <tr className="shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
            <th className="py-2.5 pl-4 font-medium">Number</th>
            <th className="py-2.5 font-medium">Client</th>
            <th className="py-2.5 font-medium">Project</th>
            <th className="py-2.5 font-medium">Issued</th>
            <th className="py-2.5 font-medium">Due</th>
            <th className="py-2.5 text-right font-medium">Amount</th>
            <th className="py-2.5 text-right font-medium">Outstanding</th>
            <th className="py-2.5 pl-4 font-medium">Status</th>
            <th className="py-2.5 pr-4" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => {
            const badge = docBadge(d);
            const owed = outstanding(d);
            return (
              <tr
                key={d.id}
                onClick={() => router.push(`/documents/${d.id}`)}
                className="cursor-pointer shadow-[inset_0_-0.5px_0_rgb(var(--separator))] last:shadow-none hover:bg-fill/[0.06]"
              >
                <td className="py-2.5 pl-4">
                  <Link href={`/documents/${d.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-label">
                    {d.documentNumber}
                  </Link>
                  <span className="block text-footnote text-label-2">{[DOC_TYPE[d.type], d.externalRef].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="max-w-[220px] py-2.5 pr-3" title={d.clientName}>
                  <span className="line-clamp-2">{d.clientShortName ?? d.clientName}</span>
                </td>
                <td className="max-w-[200px] truncate py-2.5 pr-3 text-label-2">{d.projectName ?? "—"}</td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-label-2 tabular">{formatDate(d.issuedAt, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className={cn("whitespace-nowrap py-2.5 pr-3 tabular", isOverdue(d) ? "text-ios-red" : "text-label-2")}>
                  {d.type === "invoice" ? formatDate(d.dueAt, { day: "numeric", month: "short" }) : "—"}
                </td>
                <td className="whitespace-nowrap py-2.5 text-right tabular">{d.type === "credit_note" ? "− " : ""}{centsToDisplay(d.totalCents, d.currency)}</td>
                <td className="whitespace-nowrap py-2.5 text-right tabular">{owed > 0 ? centsToDisplay(owed, d.currency) : <span className="text-label-2">—</span>}</td>
                <td className="py-2.5 pl-4">
                  <Badge color={badge.color}>{badge.label}</Badge>
                </td>
                <td className="py-2.5 pr-4 text-right">{payButton(d)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
