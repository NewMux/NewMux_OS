import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getCashFlowForecast } from "@/lib/data/reports";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { SummaryCard } from "@/components/ui/Widget";
import { centsToDisplay, compactMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

/** What makes up one forecast month (item 29). */
export default async function ForecastMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/home");
  const { month } = await params;
  const forecast = (await getCashFlowForecast(12)).find((f) => f.month === month);
  if (!forecast) notFound();
  const ins = forecast.items.filter((i) => i.direction === "in");
  const outs = forecast.items.filter((i) => i.direction === "out");
  const net = forecast.expectedBhdCents - forecast.expectedOutBhdCents;

  return (
    <Page title={forecast.label} back={{ href: "/finance", label: "Finance" }} subtitle="Expected, in BHD">
      <div className="mx-auto max-w-2xl">
        <SummaryCard
          items={[
            { label: "In", value: compactMoney(forecast.expectedBhdCents) },
            { label: "Out", value: compactMoney(forecast.expectedOutBhdCents) },
            { label: "Net", value: compactMoney(net), tone: net < 0 ? "negative" : undefined },
          ]}
        />
        <ListSection header="Coming in" info="Open invoice balances due this month and hosting fees scheduled for collection.">
          {ins.map((i, k) => (
            <ListRow key={k} href={i.href} title={i.label} subtitle={`${i.detail} · ${formatDate(i.date, { day: "numeric", month: "short" })}`} detail={centsToDisplay(i.bhdCents, "BHD")} />
          ))}
          {ins.length === 0 && <ListRow title="Nothing scheduled" />}
        </ListSection>
        <ListSection header="Going out" info="Active recurring expenses due this month.">
          {outs.map((i, k) => (
            <ListRow key={k} href={i.href} title={i.label} subtitle={`${i.detail} · ${formatDate(i.date, { day: "numeric", month: "short" })}`} detail={centsToDisplay(i.bhdCents, "BHD")} />
          ))}
          {outs.length === 0 && <ListRow title="Nothing scheduled" />}
        </ListSection>
      </div>
    </Page>
  );
}
