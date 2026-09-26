"use client";

import { useState } from "react";
import { Globe, Server, Box } from "lucide-react";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/ui/Widget";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollectSheet, HostingSheet, type RecurringOption } from "@/components/hosting/HostingSheet";
import type { Option, ProjectOption } from "@/components/forms/Fields";
import { useNewParam } from "@/lib/hooks/useNewParam";
import type { HostingListItem } from "@/lib/data/hosting";
import { hostingAlertLevel, type HostingAlertLevel } from "@/lib/hosting-alerts";
import type { HostingFeeReport } from "@/lib/data/reports";
import type { BankAccount } from "@/lib/data/types";
import { amountOrTbd, centsToDisplay, compactMoney } from "@/lib/money";
import { relativeDay, formatDate } from "@/lib/time";
import { CYCLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const ITEM_ICON = { server: Server, domain: Globe, other: Box } as const;
const STATUS_BADGE = { paused: "Paused", not_started: "Not started" } as const;

type Row = { s: HostingListItem; level: HostingAlertLevel };

/** Margin per year: what the client pays less what the service costs NEWMUX (item 14). */
function margin(s: HostingListItem) {
  if (s.annualFeeBhdCents === null || s.annualCostBhdCents === null) return null;
  const cents = s.annualFeeBhdCents - s.annualCostBhdCents;
  return { cents, pct: s.annualFeeBhdCents > 0 ? Math.round((cents / s.annualFeeBhdCents) * 100) : null };
}

function MarginText({ s, compact }: { s: HostingListItem; compact?: boolean }) {
  const m = margin(s);
  if (!m) return <span className="text-label-2">{s.annualFeeBhdCents === null ? "—" : compact ? "No cost set" : "Set a cost"}</span>;
  return (
    <span className={cn(m.cents < 0 ? "text-ios-red" : "text-ios-green")}>
      {compact ? compactMoney(m.cents) : centsToDisplay(m.cents, "BHD")}
      {m.pct !== null && <span className="text-label-2"> · {m.pct}%</span>}
    </span>
  );
}

export function HostingScreen({
  subscriptions,
  report,
  clients,
  projects,
  recurring,
  accounts,
}: {
  subscriptions: HostingListItem[];
  report: HostingFeeReport;
  clients: Option[];
  projects: ProjectOption[];
  recurring: RecurringOption[];
  accounts: BankAccount[];
}) {
  const [editing, setEditing] = useState<HostingListItem | null | "new">(null);
  const [collecting, setCollecting] = useState<HostingListItem | null>(null);
  useNewParam(() => setEditing("new"));

  const withLevel = subscriptions.map((s) => ({ s, level: hostingAlertLevel(s) }));
  const attention = withLevel.filter((x) => x.level !== "ok");
  const idle = withLevel.filter((x) => x.level === "ok" && (x.s.status === "paused" || x.s.status === "not_started"));
  const rest = withLevel.filter((x) => x.level === "ok" && !idle.includes(x));
  const annualMargin = report.annualizedBhdCents - report.annualCostBhdCents;

  const due = (s: HostingListItem, level: HostingAlertLevel) =>
    s.status in STATUS_BADGE
      ? STATUS_BADGE[s.status as keyof typeof STATUS_BADGE]
      : s.nextDueDate
        ? level === "overdue"
          ? `overdue since ${formatDate(s.nextDueDate, { day: "numeric", month: "short" })}`
          : `due ${relativeDay(s.nextDueDate)}`
        : "no due date";

  const collectButton = (s: HostingListItem, level: HostingAlertLevel) =>
    s.status === "paused" ? null : (
      <Button
        size="sm"
        variant={level === "overdue" ? "destructive-tinted" : level === "ok" ? "secondary" : "tinted"}
        onClick={(e) => {
          e.stopPropagation();
          setCollecting(s);
        }}
      >
        Collect
      </Button>
    );

  const row = ({ s, level }: Row) => (
    <ListRow
      key={s.id}
      onClick={() => setEditing(s)}
      leading={<IconTile icon={ITEM_ICON[s.item]} color={level === "overdue" ? "red" : level === "ok" ? (s.status === "active" ? "teal" : "gray") : "orange"} />}
      title={s.clientName}
      subtitle={
        <>
          {`${s.label ?? s.item[0]!.toUpperCase() + s.item.slice(1)} · ${CYCLE_LABEL[s.cycle]} · ${due(s, level)}`}
          <span className="block text-footnote">
            Margin <MarginText s={s} compact />
          </span>
        </>
      }
      detail={<span className={s.amountCents === null ? "text-ios-orange" : undefined}>{amountOrTbd(s.amountCents, s.currency)}</span>}
      trailing={level !== "ok" ? collectButton(s, level) : s.status in STATUS_BADGE ? <Badge>{STATUS_BADGE[s.status as keyof typeof STATUS_BADGE]}</Badge> : undefined}
      multiline
    />
  );

  const table = (rows: Row[]) => (
    <div className="mb-7 hidden overflow-hidden rounded-card bg-bg-elevated md:block">
      <table className="w-full table-fixed text-left text-subhead">
        {/* Same widths in every section, so the columns line up down the page. */}
        <colgroup>
          <col className="w-[15%]" />
          <col className="w-[23%]" />
          <col className="w-[15%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          <col className="w-[15%]" />
          <col className="w-[104px]" />
        </colgroup>
        <thead className="text-footnote text-label-2">
          <tr className="shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
            <th className="py-2.5 pl-4 font-medium">Client</th>
            <th className="py-2.5 font-medium">Service</th>
            <th className="py-2.5 font-medium">Next due</th>
            <th className="py-2.5 text-right font-medium">Fee</th>
            <th className="py-2.5 text-right font-medium">Per year</th>
            <th className="py-2.5 text-right font-medium">Cost / year</th>
            <th className="py-2.5 text-right font-medium">Margin / year</th>
            <th className="py-2.5 pr-4" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, level }) => (
            <tr key={s.id} onClick={() => setEditing(s)} className="cursor-pointer shadow-[inset_0_-0.5px_0_rgb(var(--separator))] last:shadow-none hover:bg-fill/[0.06]">
              <td className="truncate py-2.5 pl-4 pr-2 font-medium">{s.clientName}</td>
              <td className="truncate py-2.5 pr-3 text-label-2">
                {s.label ?? s.item[0]!.toUpperCase() + s.item.slice(1)} · {CYCLE_LABEL[s.cycle]}
              </td>
              <td className={cn("whitespace-nowrap py-2.5 pr-3", level === "overdue" ? "text-ios-red" : level === "ok" ? "text-label-2" : "text-ios-orange")}>{due(s, level)}</td>
              <td className={cn("whitespace-nowrap py-2.5 text-right tabular", s.amountCents === null && "text-ios-orange")}>{amountOrTbd(s.amountCents, s.currency)}</td>
              <td className="whitespace-nowrap py-2.5 text-right tabular">{s.annualFeeBhdCents === null ? "—" : centsToDisplay(s.annualFeeBhdCents, "BHD")}</td>
              <td className="whitespace-nowrap py-2.5 text-right tabular text-label-2" title={s.recurringExpenseName ?? undefined}>
                {s.annualCostBhdCents === null ? "—" : centsToDisplay(s.annualCostBhdCents, "BHD")}
              </td>
              <td className="whitespace-nowrap py-2.5 text-right tabular">
                <MarginText s={s} />
              </td>
              <td className="py-2 pr-4 text-right">{collectButton(s, level)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const section = (header: string, rows: Row[], info?: string) =>
    rows.length > 0 && (
      <>
        <ListSection header={header} info={info} className="md:hidden">
          {rows.map(row)}
        </ListSection>
        <h2 className="mb-1.5 hidden px-4 text-footnote font-medium text-label-2 md:block">{header}</h2>
        {table(rows)}
      </>
    );

  return (
    <Page
      title="Hosting Fees"
      back={{ href: "/finance", label: "Finance" }}
      actions={
        <QuickAddMenu extra={[{ label: "Add hosting fee", onSelect: () => setEditing("new") }]} />
      }
    >
      <SummaryCard
        items={[
          { label: "Per year", value: compactMoney(report.annualizedBhdCents), caption: report.tbdCount ? `+ ${report.tbdCount} price TBD` : "recurring" },
          { label: "Margin", value: compactMoney(annualMargin), caption: `after ${compactMoney(report.annualCostBhdCents)} costs`, tone: annualMargin < 0 ? "negative" : undefined },
          { label: "Collected", value: compactMoney(report.collectedBhdCents), caption: "this year" },
          { label: "Alerts", value: String(attention.length), caption: "due in 14 days", tone: attention.some((a) => a.level === "overdue") ? "negative" : undefined },
        ]}
      />
      {subscriptions.length === 0 && <EmptyState icon={Server} title="No hosting fees" message="Track the hosting and domain fees you collect from clients." />}
      {section("Needs collecting", attention, "Alerts start 14 days before the due date, again at 3 days, then overdue. Collect creates the invoice, records the payment and moves the due date on.")}
      {section("All clients", rest)}
      {section("Not started or paused", idle)}
      <HostingSheet sub={editing} onClose={() => setEditing(null)} clients={clients} projects={projects} recurring={recurring} />
      {collecting && <CollectSheet sub={collecting} open={!!collecting} onOpenChange={(o) => !o && setCollecting(null)} accounts={accounts} />}
    </Page>
  );
}
