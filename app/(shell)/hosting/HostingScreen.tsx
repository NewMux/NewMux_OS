"use client";

import { useState } from "react";
import { Globe, Plus, Server, Box } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { ListRow, ListSection, IconTile } from "@/components/ui/List";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/ui/Widget";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/Confirm";
import { HostingSheet } from "@/components/hosting/HostingSheet";
import type { Option, ProjectOption } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { useNewParam } from "@/lib/hooks/useNewParam";
import type { HostingListItem } from "@/lib/data/hosting";
import { hostingAlertLevel } from "@/lib/hosting-alerts";
import type { HostingFeeReport } from "@/lib/data/reports";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { relativeDay, formatDate } from "@/lib/time";
import { CYCLE_LABEL } from "@/lib/labels";

const ITEM_ICON = { server: Server, domain: Globe, other: Box } as const;

export function HostingScreen({
  subscriptions,
  report,
  clients,
  projects,
}: {
  subscriptions: HostingListItem[];
  report: HostingFeeReport;
  clients: Option[];
  projects: ProjectOption[];
}) {
  const [editing, setEditing] = useState<HostingListItem | null | "new">(null);
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  useNewParam(() => setEditing("new"));

  const withLevel = subscriptions.map((s) => ({ s, level: hostingAlertLevel(s) }));
  const attention = withLevel.filter((x) => x.level !== "ok");
  const rest = withLevel.filter((x) => x.level === "ok");

  const collect = async (s: HostingListItem) => {
    const ok = await confirm({
      title: `Collected ${centsToDisplay(s.amountCents, s.currency)} from ${s.clientName}?`,
      message: "This issues a paid invoice for the fee and moves the next due date forward one cycle.",
      confirmLabel: "Mark Collected",
    });
    if (ok) await run(`/api/hosting/${s.id}/collect`, { success: "Collected — invoice created" });
  };

  const row = ({ s, level }: { s: HostingListItem; level: ReturnType<typeof hostingAlertLevel> }) => (
    <ListRow
      key={s.id}
      onClick={() => setEditing(s)}
      leading={<IconTile icon={ITEM_ICON[s.item]} color={level === "overdue" ? "red" : level === "ok" ? "teal" : "orange"} />}
      title={s.clientName}
      subtitle={`${level !== "ok" ? `${centsToDisplay(s.amountCents, s.currency)} · ` : ""}${s.label ?? s.item[0]!.toUpperCase() + s.item.slice(1)} · ${CYCLE_LABEL[s.cycle]} · ${
        s.status === "paused" ? "Paused" : s.nextDueDate ? (level === "overdue" ? `overdue since ${formatDate(s.nextDueDate, { day: "numeric", month: "short" })}` : `due ${relativeDay(s.nextDueDate)}`) : "no due date"
      }`}
      // With a Collect button beside it, the amount reads first in the subtitle instead of being squeezed.
      detail={level !== "ok" ? undefined : centsToDisplay(s.amountCents, s.currency)}
      trailing={
        level !== "ok" ? (
          <Button
            size="sm"
            variant={level === "overdue" ? "destructive-tinted" : "tinted"}
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              void collect(s);
            }}
          >
            Collect
          </Button>
        ) : s.status === "paused" ? (
          <Badge>Paused</Badge>
        ) : undefined
      }
    />
  );

  return (
    <Page
      title="Hosting Fees"
      back={{ href: "/finance", label: "Finance" }}
      actions={
        <NavButton label="Add hosting fee" onClick={() => setEditing("new")}>
          <Plus className="h-5 w-5" />
        </NavButton>
      }
    >
      <SummaryCard
        items={[
          { label: "Per year", value: compactMoney(report.annualizedBhdCents), caption: "recurring" },
          { label: "Collected", value: compactMoney(report.collectedBhdCents), caption: "this year" },
          { label: "Alerts", value: String(attention.length), caption: "due in 14 days", tone: attention.some((a) => a.level === "overdue") ? "negative" : undefined },
        ]}
      />
      {subscriptions.length === 0 && <EmptyState icon={Server} title="No hosting fees" message="Track the hosting and domain fees you collect from clients." />}
      {attention.length > 0 && (
        <ListSection header="Needs collecting" footer="Alerts start 14 days before the due date, again at 3 days, then overdue.">
          {attention.map(row)}
        </ListSection>
      )}
      {rest.length > 0 && <ListSection header="All clients">{rest.map(row)}</ListSection>}
      <HostingSheet sub={editing} onClose={() => setEditing(null)} clients={clients} projects={projects} />
    </Page>
  );
}
