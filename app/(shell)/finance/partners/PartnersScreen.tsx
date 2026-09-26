"use client";

import { useState } from "react";
import { HandCoins, Plus } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { EmptyState } from "@/components/ui/EmptyState";
import { FundRows, PartnerRows } from "@/components/finance/PartnerRows";
import { PAYOUT_TYPE, PayoutSheet, type InvoiceOption } from "@/components/finance/LedgerSheets";
import { useNewParam } from "@/lib/hooks/useNewParam";
import { centsToDisplay } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { FundBalance, PartnerBalance, PayoutListItem } from "@/lib/data/ledger";
import type { BankAccount, Party } from "@/lib/data/types";

/** Partner balances and the payouts ledger (item 2). */
export function PartnersScreen({
  partners,
  funds,
  payouts,
  parties,
  accounts,
  invoices,
}: {
  partners: PartnerBalance[];
  funds: FundBalance[];
  payouts: PayoutListItem[];
  parties: Party[];
  accounts: BankAccount[];
  invoices: InvoiceOption[];
}) {
  const [editing, setEditing] = useState<PayoutListItem | "new" | null>(null);
  useNewParam(() => setEditing("new"));

  return (
    <Page
      title="Partner Payouts"
      back={{ href: "/finance", label: "Finance" }}
      actions={
        <NavButton label="Record payout" onClick={() => setEditing("new")}>
          <Plus className="h-5 w-5" />
        </NavButton>
      }
    >
      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection header="Partners" info="Entitled: each partner's share of profit on every issued invoice. Paid: shares, advances and withdrawals. Remaining: still owed by the company, including costs they paid personally.">
            <PartnerRows partners={partners} />
          </ListSection>
          {funds.length > 0 && (
            <ListSection header="Funds">
              <FundRows funds={funds} />
            </ListSection>
          )}
        </div>
        <div>
          <ListSection header="Payouts" info="Every payout reduces the account balance.">
            {payouts.map((p) => (
              <ListRow
                key={p.id}
                onClick={() => setEditing(p)}
                title={p.partyName}
                subtitle={[formatDate(p.paidOn), PAYOUT_TYPE[p.type], p.documentNumber].filter(Boolean).join(" · ")}
                detail={centsToDisplay(p.amountCents, p.currency)}
              />
            ))}
          </ListSection>
          {payouts.length === 0 && <EmptyState icon={HandCoins} title="No payouts yet" message="Record shares, advances and reimbursements as they're paid." />}
        </div>
      </div>
      <PayoutSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        payout={editing && editing !== "new" ? editing : undefined}
        parties={parties}
        accounts={accounts}
        invoices={invoices}
      />
    </Page>
  );
}
