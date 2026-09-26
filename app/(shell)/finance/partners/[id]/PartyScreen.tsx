"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/ui/Widget";
import { useConfirm } from "@/components/ui/Confirm";
import { PAYOUT_TYPE, PayoutSheet, type InvoiceOption } from "@/components/finance/LedgerSheets";
import { useMutation } from "@/lib/useMutation";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { FundBalance, PartnerBalance, PayoutListItem } from "@/lib/data/ledger";
import type { BankAccount, Party } from "@/lib/data/types";

type Entitlement = { invoiceId: string; label: string; subtitle: string; bhdCents: number };
type Reimbursable = { id: string; description: string; spentOn: string; bhdCents: number };
type Spending = { id: string; description: string; spentOn: string; bhdCents: number };

/** One partner's (or fund's) ledger: what each invoice added, what was paid or spent. */
export function PartyScreen(props: {
  party: Party;
  partner?: PartnerBalance;
  fund?: FundBalance;
  entitlements: Entitlement[];
  payouts: PayoutListItem[];
  reimbursable: Reimbursable[];
  spending: Spending[];
  parties: Party[];
  accounts: BankAccount[];
  invoices: InvoiceOption[];
}) {
  const { party, partner, fund, entitlements, payouts, reimbursable, spending } = props;
  const [editing, setEditing] = useState<PayoutListItem | "new" | null>(null);
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const isFund = party.kind === "fund";

  const reimburse = async (e: Reimbursable) => {
    if (await confirm({ title: `Pay ${party.name} back ${centsToDisplay(e.bhdCents, "BHD")}?`, message: `Records a reimbursement payout from the company account for “${e.description}”.`, confirmLabel: "Reimburse" }))
      await run(`/api/expenses/${e.id}/reimburse`, { body: {}, success: "Reimbursed" });
  };

  return (
    <Page
      title={party.name}
      back={{ href: "/finance/partners", label: "Payouts" }}
      actions={
        isFund ? undefined : (
          <NavButton label="Record payout" onClick={() => setEditing("new")}>
            <Plus className="h-5 w-5" />
          </NavButton>
        )
      }
    >
      <div className="mx-auto max-w-2xl">
        {partner && (
          <SummaryCard
            items={[
              { label: "Entitled", value: compactMoney(partner.entitledBhdCents), caption: partner.uncollectedBhdCents > 0 ? `${compactMoney(partner.uncollectedBhdCents)} not collected yet` : "all collected" },
              { label: "Paid", value: compactMoney(partner.paidBhdCents), caption: "shares & advances" },
              {
                label: partner.remainingBhdCents < 0 ? "Overpaid" : "Remaining",
                value: compactMoney(Math.abs(partner.remainingBhdCents)),
                caption: partner.reimbursementDueBhdCents > 0 ? `incl. ${compactMoney(partner.reimbursementDueBhdCents)} costs` : "owed to them",
                tone: partner.remainingBhdCents < 0 ? "negative" : undefined,
              },
            ]}
          />
        )}
        {fund && (
          <SummaryCard
            items={[
              { label: "Set aside", value: compactMoney(fund.accruedBhdCents) },
              { label: "Spent", value: compactMoney(fund.spentBhdCents) },
              { label: "Balance", value: compactMoney(fund.balanceBhdCents), tone: fund.balanceBhdCents < 0 ? "negative" : undefined },
            ]}
          />
        )}

        {!isFund && (
          <div className="mb-7">
            <Button className="w-full" onClick={() => setEditing("new")}>
              Record Payout
            </Button>
          </div>
        )}
        {isFund && (
          <div className="mb-7">
            <Button className="w-full" onClick={() => (window.location.href = `/finance/expenses?new=1&fund=${party.id}`)}>
              Spend from {party.name}
            </Button>
          </div>
        )}

        {reimbursable.length > 0 && (
          <ListSection header="Costs to pay back" info={`Company costs ${party.name} paid personally. Reimbursing records a payout from the company account.`}>
            {reimbursable.map((e) => (
              <ListRow
                key={e.id}
                title={e.description}
                subtitle={formatDate(e.spentOn)}
                detail={centsToDisplay(e.bhdCents, "BHD")}
                trailing={
                  <Button size="sm" variant="tinted" disabled={pending} onClick={() => reimburse(e)}>
                    Reimburse
                  </Button>
                }
              />
            ))}
          </ListSection>
        )}

        {!isFund && (
          <ListSection header="Payouts">
            {payouts.map((p) => (
              <ListRow
                key={p.id}
                onClick={() => setEditing(p)}
                title={PAYOUT_TYPE[p.type]}
                subtitle={[formatDate(p.paidOn), p.documentNumber, p.reference].filter(Boolean).join(" · ")}
                detail={centsToDisplay(p.amountCents, p.currency)}
              />
            ))}
            {payouts.length === 0 && <ListRow title="Nothing paid yet" />}
          </ListSection>
        )}

        {isFund && (
          <ListSection header="Spent">
            {spending.map((s) => (
              <ListRow key={s.id} href={`/finance/expenses?id=${s.id}`} title={s.description} subtitle={formatDate(s.spentOn)} detail={`− ${centsToDisplay(s.bhdCents, "BHD")}`} />
            ))}
            {spending.length === 0 && <ListRow title="Nothing spent yet" />}
          </ListSection>
        )}

        <ListSection header={isFund ? "Set aside from invoices" : "Share of each invoice"}>
          {entitlements.map((e) => (
            <ListRow key={e.invoiceId} href={`/documents/${e.invoiceId}`} title={e.label} subtitle={e.subtitle} detail={centsToDisplay(e.bhdCents, "BHD")} />
          ))}
          {entitlements.length === 0 && <ListRow title="No invoices with a split for this party" />}
        </ListSection>
      </div>
      {!isFund && (
        <PayoutSheet
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          payout={editing && editing !== "new" ? editing : undefined}
          parties={props.parties}
          accounts={props.accounts}
          invoices={props.invoices}
          defaultPartyId={party.id}
        />
      )}
    </Page>
  );
}
