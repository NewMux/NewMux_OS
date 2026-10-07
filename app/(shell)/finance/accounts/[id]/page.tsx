import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getAccountStatement } from "@/lib/data/ledger";
import { NotFoundError } from "@/lib/data/sql";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { AccountActions } from "@/components/finance/AccountActions";
import { centsToDisplay } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Account" };

/** A bank account's statement: opening balance, every movement since, running balance (item 1). */
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const { id } = await params;
  const statement = await getAccountStatement(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { account, rows, balanceCents, reconciliations } = statement;
  const money = (c: number) => centsToDisplay(c, account.currency);

  return (
    <Page title={account.name} back={{ href: "/finance", label: "Finance" }} actions={<AccountActions account={account} menuOnly />} subtitle={account.isDefault ? "Default account" : undefined}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 rounded-card bg-bg-elevated p-5">
          <div className="text-footnote font-medium text-label-2">Balance today</div>
          <div className={cn("mt-1 font-rounded text-[34px] font-semibold tabular", balanceCents < 0 && "text-ios-red")}>{money(balanceCents)}</div>
          <div className="mt-1 text-footnote text-label-2">
            {money(account.openingBalanceCents)} on {formatDate(account.openingBalanceDate)}, plus {rows.length} movement{rows.length === 1 ? "" : "s"} since
          </div>
        </div>
        <div className="mb-7">
          <AccountActions account={account} />
        </div>

        {reconciliations.length > 0 && (
          <ListSection header="Reconciliations">
            {reconciliations.slice(0, 5).map((r) => {
              const diff = r.statementBalanceCents - r.computedBalanceCents;
              return (
                <ListRow
                  key={r.id}
                  title={`${formatDate(r.statementDate)} statement`}
                  subtitle={[r.createdByName, r.note, r.adjustmentCents ? `adjusted ${money(r.adjustmentCents)}` : null].filter(Boolean).join(" · ") || undefined}
                  detail={<span className={diff === 0 ? "text-ios-green" : "text-ios-orange"}>{diff === 0 ? "Matched" : `Off by ${money(diff)}`}</span>}
                />
              );
            })}
          </ListSection>
        )}

        <ListSection header="Movements" info="Newest first. Payments in, expenses paid from this account, partner payouts, refunds and reconciliation adjustments.">
          {[...rows].reverse().map((m) => (
            <ListRow
              key={`${m.kind}-${m.refId}`}
              href={m.href ?? undefined}
              title={m.description}
              subtitle={formatDate(m.date)}
              detail={
                <span className="flex flex-col items-end">
                  <span className={m.amountCents >= 0 ? "text-ios-green" : "text-label"}>
                    {m.amountCents >= 0 ? "+" : "−"} {money(Math.abs(m.amountCents))}
                  </span>
                  <span className="text-caption1 text-label-2">{money(m.balanceCents)}</span>
                </span>
              }
            />
          ))}
          <ListRow title="Opening balance" subtitle={formatDate(account.openingBalanceDate)} detail={money(account.openingBalanceCents)} />
        </ListSection>
      </div>
    </Page>
  );
}
