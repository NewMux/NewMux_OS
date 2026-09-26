"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Landmark, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { AccountSheet, ReconcileSheet } from "./LedgerSheets";
import { centsToDisplay } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AccountBalance } from "@/lib/data/ledger";

/**
 * Finance's headline (item 1): what is actually in the bank — opening
 * balance plus every movement since — with the reconcile action beside it.
 */
export function BalanceCard({ accounts, totalBhdCents }: { accounts: AccountBalance[]; totalBhdCents: number | null }) {
  const [adding, setAdding] = useState(false);
  const [reconciling, setReconciling] = useState<AccountBalance | null>(null);
  const active = accounts.filter((a) => a.account.isActive);
  const primary = active.find((a) => a.account.isDefault) ?? active[0];

  if (!primary || totalBhdCents === null) {
    return (
      <div className="mb-6 rounded-card bg-bg-elevated p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Landmark className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-headline">Show the account balance</p>
            <p className="mt-0.5 text-subhead text-label-2">Enter the balance from a bank statement and its date. Payments, expenses and payouts from then on keep it up to date.</p>
          </div>
        </div>
        <Button className="mt-4 w-full md:w-auto" onClick={() => setAdding(true)}>
          Set Opening Balance
        </Button>
        <AccountSheet open={adding} onOpenChange={setAdding} />
      </div>
    );
  }

  const rec = primary.lastReconciliation;
  const recOk = rec && rec.statementBalanceCents === rec.computedBalanceCents + rec.adjustmentCents;
  return (
    <div className="mb-6 rounded-card bg-bg-elevated p-5">
      <div className="flex items-center gap-1.5 text-footnote font-medium text-label-2">
        Account balance
        <InfoTip>Opening balance plus payments received, minus expenses paid from the account, partner payouts and refunds. Void documents don&apos;t count.</InfoTip>
      </div>
      <div className={cn("mt-1 font-rounded text-[34px] font-semibold leading-tight tabular md:text-[40px]", totalBhdCents < 0 && "text-ios-red")}>
        {centsToDisplay(totalBhdCents, "BHD")}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-footnote text-label-2">
        <span>Today</span>
        {rec && (
          <span className={cn("inline-flex items-center gap-1", recOk ? "text-ios-green" : "text-ios-orange")}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {recOk ? "Matched" : "Checked"} with the {formatDate(rec.statementDate, { day: "numeric", month: "short" })} statement
          </span>
        )}
      </div>

      {active.length > 1 && (
        <div className="mt-4 overflow-hidden rounded-[14px] bg-fill/[0.06]">
          {active.map((a) => (
            <Link key={a.account.id} href={`/finance/accounts/${a.account.id}`} className="flex min-h-[40px] items-center gap-2 px-3 text-subhead hairline-b last:shadow-none hover:bg-fill/[0.06]">
              <span className="min-w-0 flex-1 truncate">{a.account.name}</span>
              <span className="tabular text-label-2">{centsToDisplay(a.balanceCents, a.account.currency)}</span>
              <ChevronRight className="h-4 w-4 text-label-3" />
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="tinted" onClick={() => setReconciling(primary)}>
          <Scale className="h-4 w-4" />
          Reconcile with Bank Statement
        </Button>
        {active.length === 1 && (
          <Link href={`/finance/accounts/${primary.account.id}`} className="press inline-flex h-8 items-center gap-1 rounded-full bg-fill/[0.14] px-3.5 text-subhead font-semibold">
            Statement
          </Link>
        )}
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} aria-label="Add account">
          <Plus className="h-4 w-4" />
          Account
        </Button>
      </div>
      <AccountSheet open={adding} onOpenChange={setAdding} />
      {reconciling && <ReconcileSheet account={reconciling.account} open={!!reconciling} onOpenChange={(o) => !o && setReconciling(null)} />}
    </div>
  );
}
