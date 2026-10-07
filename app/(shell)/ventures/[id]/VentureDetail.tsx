"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ListRow, ListSection } from "@/components/ui/List";
import { VENTURE_STATUS, VentureSheet } from "@/components/company/VentureSheet";
import { ProfitSplitRuleSheet } from "@/components/settings/ProfitSplitRuleSheet";
import { SummaryCard } from "@/components/ui/Widget";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { CYCLE_LABEL } from "@/lib/labels";
import type { ExpenseListItem, getVentureSpend } from "@/lib/data/expenses";
import type { DeductionType, Party, ProfitSplitRule, Venture } from "@/lib/data/types";

type Spend = Awaited<ReturnType<typeof getVentureSpend>>;

export function VentureDetail({
  venture,
  rule,
  parties,
  deductionTypes,
  spend,
  expenses,
}: {
  venture: Venture;
  rule?: ProfitSplitRule;
  parties: Party[];
  deductionTypes: DeductionType[];
  spend: Spend;
  expenses: ExpenseListItem[];
}) {
  const [editing, setEditing] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const status = VENTURE_STATUS[venture.launchStatus];
  return (
    <Page
      title={venture.name}
      back={{ href: "/ventures", label: "Ventures" }}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Avatar name={venture.name} size={84} square />
          <div className="mt-3">
            <Badge color={status.color}>{status.label}</Badge>
          </div>
          {venture.brandDescription && <p className="mt-3 max-w-md text-body text-label-2">{venture.brandDescription}</p>}
          {venture.websiteUrl && (
            <a href={venture.websiteUrl.startsWith("http") ? venture.websiteUrl : `https://${venture.websiteUrl}`} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-subhead text-accent">
              {venture.websiteUrl}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <SummaryCard
          items={[
            { label: "Spent", value: compactMoney(spend.allTimeBhdCents), caption: `${spend.count} expense${spend.count === 1 ? "" : "s"}` },
            { label: "This year", value: compactMoney(spend.thisYearBhdCents) },
            { label: "Recurring", value: compactMoney(spend.monthlyRunRateBhdCents), caption: "per month" },
          ]}
        />
        <ListSection header="Spending" info="Expenses and recurring costs linked to this venture." action={<a href="/finance/expenses?new=1" className="text-subhead text-accent">Add</a>}>
          {spend.recurring.map((r) => (
            <ListRow key={r.id} href="/finance/expenses?tab=recurring" title={r.name} subtitle={`${CYCLE_LABEL[r.cycle]}${r.status === "paused" ? " · Paused" : ""}`} detail={centsToDisplay(r.amountCents, r.currency)} />
          ))}
          {expenses.map((e) => (
            <ListRow
              key={e.id}
              href={`/finance/expenses?id=${e.id}`}
              title={e.description}
              subtitle={[formatDate(e.spentOn), e.paidByName ? `paid by ${e.paidByName}` : null].filter(Boolean).join(" · ")}
              detail={centsToDisplay(e.amountBhdCents ?? e.amountCents, e.amountBhdCents !== null ? "BHD" : e.currency)}
            />
          ))}
          {expenses.length === 0 && spend.recurring.length === 0 && <ListRow title="No spending linked yet" />}
        </ListSection>

        <ListSection header="Ownership & Profit Split" footer="Ventures are held personally by the founders — the split is set here, not assumed.">
          {rule ? (
            rule.splits.map((s) => <ListRow key={s.partyId} title={parties.find((p) => p.id === s.partyId)?.name ?? "?"} detail={`${s.percentageBps / 100}%`} />)
          ) : (
            <ListRow title="Not configured yet" />
          )}
          <ListRow title={<span className="text-accent">{rule ? "Edit Split" : "Set Up Split"}</span>} onClick={() => setSplitOpen(true)} />
        </ListSection>
      </div>
      <VentureSheet venture={venture} open={editing} onOpenChange={setEditing} />
      <ProfitSplitRuleSheet open={splitOpen} onOpenChange={setSplitOpen} scope={{ scopeType: "venture", scopeId: venture.id, name: venture.name }} rule={rule} parties={parties} deductionTypes={deductionTypes} />
    </Page>
  );
}
