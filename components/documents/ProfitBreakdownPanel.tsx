import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { centsToDisplay } from "@/lib/money";
import type { ProfitBreakdown } from "@/lib/data/finance";

export function ProfitBreakdownPanel({ breakdown, currency }: { breakdown: ProfitBreakdown; currency: string }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Profit Distribution</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between text-slate-400">
          <span>Invoice total</span>
          <span>{centsToDisplay(breakdown.invoiceTotalCents, currency)}</span>
        </div>
        {breakdown.deductions.map((d, i) => (
          <div key={i} className="flex justify-between text-slate-500">
            <span>− {d.name}</span>
            <span>{centsToDisplay(d.amountCents, currency)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-white/10 pt-1 font-semibold text-white">
          <span>Net profit</span>
          <span>{centsToDisplay(breakdown.netProfitCents, currency)}</span>
        </div>
        <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
          {breakdown.splits.map((s) => (
            <div key={s.partyId} className="flex justify-between text-slate-300">
              <span>
                {s.partyName} ({(s.percentageBps / 100).toFixed(0)}%)
              </span>
              <span>{centsToDisplay(s.amountCents, currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
