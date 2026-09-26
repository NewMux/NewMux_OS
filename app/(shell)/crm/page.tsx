import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessCrm } from "@/lib/rbac";
import { getPipelineSummary, listDeals, listOpenFollowUps, openPipelineTotals } from "@/lib/data/crm";
import { one } from "@/lib/data/sql";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection, SectionLink } from "@/components/ui/List";
import { SummaryCard } from "@/components/ui/Widget";
import { FollowUpRow } from "@/components/crm/FollowUpRow";
import { DEAL_STAGE } from "@/lib/labels";
import { OPEN_DEAL_STAGES } from "@/lib/data/types";
import { compactMoney, convertMinorUnits } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { plural } from "@/lib/utils";

export const metadata = { title: "CRM" };

export default async function CrmPage() {
  const session = await auth();
  if (!canAccessCrm(session)) redirect("/home");
  const [summary, followUps, openDeals, counts] = await Promise.all([
    getPipelineSummary(),
    listOpenFollowUps(),
    listDeals({ open: true }),
    one<{ clients: number; contacts: number }>("select (select count(*)::int from clients) as clients, (select count(*)::int from contacts) as contacts"),
  ]);
  const totals = openPipelineTotals(summary);
  const won = summary.find((s) => s.stage === "won")!;
  const maxStage = Math.max(...summary.filter((s) => OPEN_DEAL_STAGES.includes(s.stage)).map((s) => s.totalBhdCents), 1);
  const closingSoon = [...openDeals].filter((d) => d.expectedClose).sort((a, b) => a.expectedClose!.localeCompare(b.expectedClose!)).slice(0, 5);

  return (
    <Page
      title="CRM"
      actions={
        <QuickAddMenu extra={[{ label: "New Deal", href: "/crm/pipeline?new=1" }]} />
      }
    >
      <SummaryCard
        items={[
          { label: "Open pipeline", value: compactMoney(totals.totalBhdCents), caption: plural(totals.count, "deal"), href: "/crm/pipeline" },
          { label: "Weighted", value: compactMoney(totals.weightedBhdCents), caption: "by probability", href: "/crm/pipeline" },
          { label: "Won", value: compactMoney(won.totalBhdCents), caption: plural(won.count, "deal") },
        ]}
      />

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <ListSection>
            <ListRow href="/clients" title="Clients" detail={counts?.clients} />
            <ListRow href="/contacts" title="Contacts" detail={counts?.contacts} />
          </ListSection>

          <ListSection variant="prominent" header="By Stage" action={<SectionLink href="/crm/pipeline">Board</SectionLink>}>
            {summary
              .filter((s) => OPEN_DEAL_STAGES.includes(s.stage))
              .map((s) => (
                <ListRow
                  key={s.stage}
                  href="/crm/pipeline"
                  title={
                    <span className="flex items-baseline gap-2">
                      {DEAL_STAGE[s.stage].label}
                      <span className="text-subhead text-label-2">{s.count}</span>
                    </span>
                  }
                  subtitle={
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-fill/15">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(s.totalBhdCents / maxStage) * 100}%` }} />
                    </span>
                  }
                  detail={compactMoney(s.totalBhdCents)}
                />
              ))}
          </ListSection>

          <ListSection variant="prominent" header="Closing Soon">
            {closingSoon.map((d) => (
              <ListRow
                key={d.id}
                href={`/crm/deals/${d.id}`}
                title={d.title}
                subtitle={`${d.clientName ?? d.contactName ?? "New prospect"} · closes ${formatDate(d.expectedClose, { day: "numeric", month: "short" })}`}
                detail={compactMoney(convertMinorUnits(d.valueCents, d.currency, "BHD"))}
              />
            ))}
            {closingSoon.length === 0 && <ListRow title="No open deals with a close date" />}
          </ListSection>
        </div>
        <div>
          <ListSection variant="prominent" header="Follow-ups" action={<SectionLink href="/crm/activities" />}>
            {followUps.slice(0, 8).map((a) => (
              <FollowUpRow key={a.id} activity={a} />
            ))}
            {followUps.length === 0 && <ListRow title="You're all caught up" />}
          </ListSection>
        </div>
      </div>
    </Page>
  );
}
