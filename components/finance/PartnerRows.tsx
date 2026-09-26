import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { centsToDisplay, formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { FundBalance, PartnerBalance } from "@/lib/data/ledger";

/** Three labelled figures side by side — Entitled · Paid · Remaining. */
function Figures({ items }: { items: { label: string; cents: number; strong?: boolean; tone?: "negative" | "positive" }[] }) {
  return (
    <span className="mt-1.5 grid grid-cols-3 gap-2">
      {items.map((i) => (
        <span key={i.label} className="min-w-0">
          <span className="block truncate text-caption1 text-label-2">{i.label}</span>
          <span
            className={cn(
              "block truncate text-subhead tabular",
              i.strong ? "font-semibold text-label" : "text-label",
              i.tone === "negative" && "text-ios-red",
              i.tone === "positive" && "text-ios-green",
            )}
          >
            {formatAmount(i.cents, "BHD")}
          </span>
        </span>
      ))}
    </span>
  );
}

function Row({ href, name, children }: { href: string; name: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex w-full items-stretch transition-colors active:bg-fill/20 md:hover:bg-fill/[0.06] [&:last-child_.row-sep]:shadow-none">
      <span className="flex shrink-0 items-start py-3 pl-4">
        <Avatar name={name} size={32} />
      </span>
      <span className="row-sep ml-3 flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 shadow-[inset_0_-0.5px_0_rgb(var(--separator))]">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-body">{name}</span>
            <span className="shrink-0 text-caption2 font-medium text-label-2">BHD</span>
          </span>
          {children}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.5} aria-hidden />
      </span>
    </Link>
  );
}

/** Per partner: what they're entitled to, what they've been paid, what's still owed (items 2, 28). */
export function PartnerRows({ partners }: { partners: PartnerBalance[] }) {
  return (
    <>
      {partners.map((p) => (
        <Row key={p.party.id} href={`/finance/partners/${p.party.id}`} name={p.party.name}>
          <Figures
            items={[
              { label: "Entitled", cents: p.entitledBhdCents },
              { label: "Paid", cents: p.paidBhdCents },
              { label: p.remainingBhdCents < 0 ? "Overpaid" : "Remaining", cents: Math.abs(p.remainingBhdCents), strong: true, tone: p.remainingBhdCents < 0 ? "negative" : undefined },
            ]}
          />
          {p.reimbursementDueBhdCents > 0 && (
            <span className="mt-1 block text-caption1 text-label-2">Remaining includes {centsToDisplay(p.reimbursementDueBhdCents, "BHD")} of costs they paid personally.</span>
          )}
        </Row>
      ))}
    </>
  );
}

/** Per fund (the Newmux reserve): set aside, spent, balance (item 6). */
export function FundRows({ funds }: { funds: FundBalance[] }) {
  return (
    <>
      {funds.map((f) => (
        <Row key={f.party.id} href={`/finance/partners/${f.party.id}`} name={f.party.name}>
          <Figures
            items={[
              { label: "Set aside", cents: f.accruedBhdCents },
              { label: "Spent", cents: f.spentBhdCents },
              { label: "Balance", cents: f.balanceBhdCents, strong: true, tone: f.balanceBhdCents < 0 ? "negative" : undefined },
            ]}
          />
        </Row>
      ))}
    </>
  );
}
