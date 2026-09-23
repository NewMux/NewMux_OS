import { many, one } from "./sql";
import { hostingAlertLevel, listHostingSubscriptions, type HostingListItem } from "./hosting";
import { listTasks } from "./projects";
import type { TaskWithMeta } from "./types";
import type { MeetingListItem } from "./meetings";
import { addDaysYmd, daysUntil, todayYmd } from "@/lib/time";

export type DashboardAlerts = {
  todaysMeetings: MeetingListItem[];
  tasksDueTodayOrOverdue: (TaskWithMeta & { overdue: boolean })[];
  renewalsWithin30Days: { label: string; dueDate: string; overdue: boolean }[];
  hostingAlerts: { subscription: HostingListItem; overdue: boolean }[];
  activeProjectCount: number;
  completedProjectCount: number;
};

/** Everything that needs attention today, in Bahrain time. */
export async function getDashboardAlerts(opts: { includeFinance?: boolean } = {}): Promise<DashboardAlerts> {
  const today = todayYmd();
  const tomorrow = addDaysYmd(today, 1);

  const [todaysMeetings, openTasks, projectRenewals, company, certs, counts, hosting] = await Promise.all([
    many<MeetingListItem>(
      `select m.*, p.name as project_name, c.name as client_name, k.title as kb_page_title from meetings m
       left join projects p on p.id = m.linked_project_id left join clients c on c.id = m.linked_client_id
       left join kb_pages k on k.id = m.kb_page_id
       where (m.starts_at at time zone 'Asia/Bahrain')::date = $1::date order by m.starts_at`,
      [today],
    ),
    listTasks({ openOnly: true }),
    many<{ name: string; domainRenewalDate: string }>(
      "select name, domain_renewal_date from projects where domain_renewal_date is not null and domain_renewal_date <= $1::date + 30",
      [today],
    ),
    one<{ crRenewalDate: string | null; mainDomain: string; mainDomainRenewalDate: string | null }>(
      "select cr_renewal_date, main_domain, main_domain_renewal_date from company_profile where id = 1",
    ),
    many<{ name: string; expiryDate: string }>(
      "select name, expiry_date from certifications where expiry_date is not null and expiry_date <= $1::date + 30",
      [today],
    ),
    one<{ active: number; completed: number }>(
      `select count(*) filter (where status = 'active_sprint')::int as active,
              count(*) filter (where status = 'completed')::int as completed from projects`,
    ),
    opts.includeFinance === false ? Promise.resolve([] as HostingListItem[]) : listHostingSubscriptions(),
  ]);

  const tasksDueTodayOrOverdue = openTasks
    .filter((t) => t.dueAt && t.dueAt < tomorrow)
    .map((t) => ({ ...t, overdue: t.dueAt! < today }));

  const renewalsWithin30Days: DashboardAlerts["renewalsWithin30Days"] = [];
  const pushRenewal = (label: string, date: string | null | undefined) => {
    if (date && daysUntil(date) <= 30) renewalsWithin30Days.push({ label, dueDate: date, overdue: daysUntil(date) < 0 });
  };
  for (const p of projectRenewals) pushRenewal(`${p.name} — domain renewal`, p.domainRenewalDate);
  pushRenewal("Commercial Registration renewal", company?.crRenewalDate);
  pushRenewal(`${company?.mainDomain ?? "Main domain"} renewal`, company?.mainDomainRenewalDate);
  for (const c of certs) pushRenewal(`${c.name} expiry`, c.expiryDate);
  renewalsWithin30Days.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const hostingAlerts = hosting
    .map((subscription) => ({ subscription, level: hostingAlertLevel(subscription) }))
    .filter((x) => x.level !== "ok")
    .map((x) => ({ subscription: x.subscription, overdue: x.level === "overdue" }));

  return {
    todaysMeetings,
    tasksDueTodayOrOverdue,
    renewalsWithin30Days,
    hostingAlerts,
    activeProjectCount: counts?.active ?? 0,
    completedProjectCount: counts?.completed ?? 0,
  };
}
