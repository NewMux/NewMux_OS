import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { centsToDisplay } from "@/lib/money";
import type { PipelineAnalytics as Analytics } from "@/lib/data/deals";

function bps(value: number | null): string {
  return value === null ? "—" : `${(value / 100).toFixed(0)}%`;
}

/** Single-series magnitude bar: one hue, rounded data end, recessive track. */
function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted/40">
      <div
        className="h-2 rounded-full bg-success/70"
        style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

export function PipelineAnalytics({ analytics }: { analytics: Analytics }) {
  const maxReached = Math.max(
    ...analytics.funnel.map((f) => f.reachedCount),
    1,
  );
  const maxForecast = Math.max(
    ...analytics.forecast.map((f) => f.valueBhdCents),
    1,
  );
  const maxReason = Math.max(...analytics.lostReasons.map((r) => r.count), 1);

  const openValue = analytics.stages
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((sum, s) => sum + s.valueBhdCents, 0);
  const openCount = analytics.stages
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Stage Funnel</CardTitle>
          <span className="text-xs text-muted-foreground">
            conversion from previous
          </span>
        </CardHeader>
        <div className="flex flex-col gap-3">
          {analytics.funnel.map((row) => (
            <div key={row.stage}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-secondary-foreground">{row.label}</span>
                <span className="text-muted-foreground">
                  {row.reachedCount} reached ·{" "}
                  {bps(row.conversionFromPreviousBps)}
                </span>
              </div>
              <Bar ratio={row.reachedCount / maxReached} />
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          Counts every deal that has ever entered the stage, so conversion
          reflects history, not just today&apos;s board.
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open Pipeline</CardTitle>
        </CardHeader>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">Open deal value</p>
          <p className="text-2xl font-semibold text-foreground">
            {centsToDisplay(openValue, "BHD")}
          </p>
          <p className="text-xs text-muted-foreground">
            across {openCount} open deal{openCount === 1 ? "" : "s"}
          </p>
        </div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Average days in stage
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {analytics.avgDaysInStage.map((row) => (
            <div key={row.stage}>
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="text-sm font-medium text-foreground">
                {row.avgDays === null ? "—" : `${row.avgDays}d`}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forecast by Expected Close</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          {analytics.forecast.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-secondary-foreground">{row.label}</span>
                <span className="text-muted-foreground">
                  {centsToDisplay(row.valueBhdCents, "BHD")} · {row.dealCount}{" "}
                  deal{row.dealCount === 1 ? "" : "s"}
                </span>
              </div>
              <Bar ratio={row.valueBhdCents / maxForecast} />
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          Open deals only — quoted value, not yet weighted by stage. Anything
          past its expected close date counts in the current month.
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Win / Loss</CardTitle>
        </CardHeader>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Win rate</p>
            <p className="text-lg font-semibold text-foreground">
              {bps(analytics.winLoss.winRateBps)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Won</p>
            <p className="text-lg font-semibold text-brand">
              {analytics.winLoss.wonCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lost</p>
            <p className="text-lg font-semibold text-danger">
              {analytics.winLoss.lostCount}
            </p>
          </div>
        </div>
        <p className="mb-1 text-xs text-muted-foreground">
          Won value:{" "}
          <span className="text-secondary-foreground">
            {centsToDisplay(analytics.winLoss.wonValueBhdCents, "BHD")}
          </span>
        </p>

        {analytics.lostReasons.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Why deals were lost
            </p>
            <div className="flex flex-col gap-2">
              {analytics.lostReasons.map((row) => (
                <div key={row.reason}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-secondary-foreground">
                      {row.reason}
                    </span>
                    <span className="text-muted-foreground">{row.count}</span>
                  </div>
                  <Bar ratio={row.count / maxReason} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
