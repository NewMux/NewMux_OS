import Link from "next/link";
import { ListRow, ListSection } from "@/components/ui/List";
import { SummaryCard } from "@/components/ui/Widget";
import { centsToDisplay, compactMoney } from "@/lib/money";

export type ProjectMoney = {
  invoicedBhdCents: number;
  collectedBhdCents: number;
  outstandingBhdCents: number;
  costsBhdCents: number;
  reserveBhdCents: number;
  profitBhdCents: number;
  shares: { partyId: string; partyName: string; bhdCents: number }[];
};

/**
 * Item 36: the project's money at a glance — invoiced, collected, costs,
 * profit and each partner's share — as the Notion completed-projects table had.
 */
export function ProjectMoneySummary({ money }: { money: ProjectMoney }) {
  return (
    <>
      <SummaryCard
        items={[
          { label: "Invoiced", value: compactMoney(money.invoicedBhdCents), caption: money.outstandingBhdCents > 0 ? `${compactMoney(money.outstandingBhdCents)} to collect` : "all collected" },
          { label: "Collected", value: compactMoney(money.collectedBhdCents) },
          { label: "Costs", value: compactMoney(money.costsBhdCents), caption: "expenses & deductions" },
          { label: "Profit", value: compactMoney(money.profitBhdCents), tone: money.profitBhdCents < 0 ? "negative" : undefined, caption: money.reserveBhdCents ? `${compactMoney(money.reserveBhdCents)} to reserve` : undefined },
        ]}
      />
      {money.shares.length > 0 && (
        <ListSection
          header="Partner shares"
          info="Each party's share of profit across this project's invoices, after costs and the reserve. See each invoice for its own split."
          action={
            <Link href="/finance/partners" className="text-subhead text-accent">
              Payouts
            </Link>
          }
        >
          {money.shares.map((s) => (
            <ListRow key={s.partyId} href={`/finance/partners/${s.partyId}`} title={s.partyName} detail={centsToDisplay(s.bhdCents, "BHD")} />
          ))}
        </ListSection>
      )}
    </>
  );
}
