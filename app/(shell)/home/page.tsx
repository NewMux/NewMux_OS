import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { auth } from "@/lib/auth";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection, SectionLink } from "@/components/ui/List";
import { SummaryCard } from "@/components/ui/Widget";
import { Avatar } from "@/components/ui/Avatar";
import { TaskRow } from "@/components/work/TaskRow";
import { QuickAddMenu } from "@/components/shell/QuickAdd";
import { AttentionList } from "@/components/home/AttentionList";
import { getAttentionItems } from "@/lib/data/attention";
import { getErpDashboardSummary } from "@/lib/data/finance";
import { getCompanyBalanceBhd, getPartyBalances, listBankAccounts } from "@/lib/data/ledger";
import { listTasks } from "@/lib/data/projects";
import { listUpcomingMeetings } from "@/lib/data/meetings";
import { isPartnerAdmin } from "@/lib/rbac";
import { compactMoney } from "@/lib/money";
import { addDaysYmd, formatDate, formatTime, relativeDay, todayYmd, toYmd } from "@/lib/time";
import { plural } from "@/lib/utils";

export const metadata = { title: "Today" };

/** Today answers one question: what needs me today? */
export default async function HomePage() {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const today = todayYmd();
  const tomorrow = addDaysYmd(today, 1);

  const [attention, myTasks, meetings, finance, balance, parties, accounts] = await Promise.all([
    getAttentionItems({ includeFinance: admin, includeCrm: admin }),
    listTasks({ assigneeId: session.user.id, openOnly: true }),
    listUpcomingMeetings(2),
    admin ? getErpDashboardSummary() : null,
    admin ? getCompanyBalanceBhd() : null,
    admin ? getPartyBalances() : null,
    admin ? listBankAccounts({ activeOnly: true }) : [],
  ]);

  const soonMeetings = meetings.filter((m) => toYmd(m.startsAt) <= tomorrow).slice(0, 3);
  const dueTasks = myTasks.filter((t) => t.dueAt && t.dueAt <= tomorrow).slice(0, 5);
  const owedToPartners = parties?.partners.reduce((s, p) => s + Math.max(p.remainingBhdCents, 0), 0) ?? 0;
  const reserve = parties?.funds[0];

  return (
    <Page
      title="Today"
      eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
      actions={<QuickAddMenu />}
      titleTrailing={
        <Link href="/settings" aria-label="Account and settings" className="press block md:hidden">
          <Avatar name={session.user.name ?? "?"} size={38} />
        </Link>
      }
    >
      {/* Item 25: four figures that each mean one thing, and open where they come from. */}
      {finance && parties && (
        <SummaryCard
          items={[
            balance
              ? { label: "Account balance", value: compactMoney(balance.balanceBhdCents, "BHD"), caption: "in the bank", href: "/finance", tone: balance.balanceBhdCents < 0 ? "negative" : undefined }
              : { label: "Account balance", value: "Set up", caption: "opening balance", href: "/finance" },
            {
              label: "Owed by clients",
              value: compactMoney(finance.totalOutstandingBhdCents),
              caption: plural(finance.unpaidInvoiceCount + finance.partiallyPaidInvoiceCount, "invoice"),
              href: "/documents?type=invoice&status=unpaid",
            },
            { label: "Owed to partners", value: compactMoney(owedToPartners), caption: plural(parties.partners.filter((p) => p.remainingBhdCents > 0).length, "partner"), href: "/finance/partners" },
            reserve
              ? { label: reserve.party.name, value: compactMoney(reserve.balanceBhdCents), caption: "available", href: `/finance/partners/${reserve.party.id}` }
              : { label: "Reserve", value: "—", caption: "no fund yet", href: "/settings#parties" },
          ]}
        />
      )}

      <div className="grid gap-x-6 lg:grid-cols-2 [&>*]:min-w-0">
        <ListSection variant="prominent" header="Up Next" action={<SectionLink href="/tasks" />}>
          {soonMeetings.map((m) => (
            <ListRow
              key={m.id}
              href="/meetings"
              leading={<CalendarDays className="h-[22px] w-[22px] text-label-2" strokeWidth={1.7} />}
              title={m.title}
              subtitle={[`${relativeDay(toYmd(m.startsAt))} ${formatTime(m.startsAt)}`, m.clientName ?? m.projectName].filter(Boolean).join(" · ")}
            />
          ))}
          {dueTasks.map((t) => (
            <TaskRow key={t.id} task={t} hideAssignee />
          ))}
          {soonMeetings.length === 0 && dueTasks.length === 0 && (
            <ListRow title="Nothing due today" subtitle={myTasks.length ? `${plural(myTasks.length, "open task")} later on` : "Enjoy the calm."} href="/tasks" />
          )}
        </ListSection>

        <AttentionList items={attention} accounts={accounts} canAct={admin} />
      </div>
    </Page>
  );
}
