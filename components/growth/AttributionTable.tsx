import { Card } from "@/components/ui/Card";
import { centsToDisplay } from "@/lib/money";
import type { CampaignAttribution } from "@/lib/data/campaigns";

const CHANNEL_LABEL: Record<string, string> = {
  meta_ads: "Meta Ads",
  linkedin: "LinkedIn",
  google_search: "Google Search",
  outbound_email: "Outbound Email",
};

export function AttributionTable({ rows }: { rows: CampaignAttribution[] }) {
  if (rows.length === 0) {
    return <Card className="text-center text-sm text-muted-foreground">No campaigns yet.</Card>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="py-2 pr-4">Campaign</th>
            <th className="py-2 pr-4">Channel</th>
            <th className="py-2 pr-4 text-right">Spend</th>
            <th className="py-2 pr-4 text-right">Leads</th>
            <th className="py-2 pr-4 text-right">Conv. %</th>
            <th className="py-2 pr-4 text-right">CAC</th>
            <th className="py-2 pr-4 text-right">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.campaignId} className="border-b border-border/60">
              <td className="py-2 pr-4 font-medium text-foreground">{row.name}</td>
              <td className="py-2 pr-4 text-muted-foreground">{CHANNEL_LABEL[row.channel] ?? row.channel}</td>
              <td className="py-2 pr-4 text-right text-secondary-foreground">{centsToDisplay(row.spendCents)}</td>
              <td className="py-2 pr-4 text-right text-secondary-foreground">{row.leadsCaptured}</td>
              <td className="py-2 pr-4 text-right text-secondary-foreground">{(row.conversionRate * 100).toFixed(1)}%</td>
              <td className="py-2 pr-4 text-right text-secondary-foreground">
                {row.blendedCacCents !== null ? centsToDisplay(row.blendedCacCents) : "—"}
              </td>
              <td className="py-2 pr-4 text-right text-secondary-foreground">
                {row.roas !== null ? `${row.roas.toFixed(2)}x` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
