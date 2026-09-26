import { query } from "@/lib/db";
import { many, one, ValidationError } from "./sql";
import { listHostingSubscriptions, type HostingListItem } from "./hosting";
import { hostingAlertLevel } from "@/lib/hosting-alerts";
import { listOpenFollowUps } from "./crm";
import { listExpiringFiles } from "./files";
import { addDaysYmd, toYmd, todayYmd } from "@/lib/time";

/**
 * Today's "Needs Attention" (Improvements PRD item 26): hosting fees to
 * collect, renewals and expiring files, and CRM follow-ups — each with a
 * stable key so it can be snoozed, and the action that clears it.
 */
export type AttentionKind = "hosting" | "renewal" | "file" | "follow_up";

export type AttentionItem = {
  key: string;
  kind: AttentionKind;
  title: string;
  /** YYYY-MM-DD the item is due or expires. */
  date: string;
  overdue: boolean;
  href: string;
  detail?: string;
  hosting?: HostingListItem;
  activityId?: string;
};

export async function activeSnoozes(): Promise<Set<string>> {
  const rows = await many<{ key: string }>("select key from attention_snoozes where until > $1::date", [todayYmd()]);
  return new Set(rows.map((r) => r.key));
}

export async function getAttentionItems(opts: { includeFinance: boolean; includeCrm: boolean }): Promise<AttentionItem[]> {
  const today = todayYmd();
  const soon = addDaysYmd(today, 30);
  const [hosting, followUps, files, company, projects, certs, snoozed] = await Promise.all([
    opts.includeFinance ? listHostingSubscriptions() : Promise.resolve([] as HostingListItem[]),
    opts.includeCrm ? listOpenFollowUps() : Promise.resolve([]),
    opts.includeFinance ? listExpiringFiles() : Promise.resolve([]),
    one<{ crRenewalDate: string | null; mainDomain: string; mainDomainRenewalDate: string | null }>(
      "select cr_renewal_date, main_domain, main_domain_renewal_date from company_profile where id = 1",
    ),
    many<{ id: string; name: string; domainRenewalDate: string }>(
      "select id, name, domain_renewal_date from projects where domain_renewal_date is not null and domain_renewal_date <= $1::date",
      [soon],
    ),
    many<{ id: string; name: string; expiryDate: string }>("select id, name, expiry_date from certifications where expiry_date is not null and expiry_date <= $1::date", [soon]),
    activeSnoozes(),
  ]);

  const items: AttentionItem[] = [];
  for (const h of hosting) {
    const level = hostingAlertLevel(h);
    if (level === "ok") continue;
    items.push({ key: `hosting:${h.id}`, kind: "hosting", title: `${h.clientName} — ${h.label ?? h.item} fee`, date: h.nextDueDate!, overdue: level === "overdue", href: "/hosting", hosting: h });
  }
  const renewal = (key: string, title: string, date: string | null | undefined, href: string) => {
    if (date && date <= soon) items.push({ key, kind: "renewal", title, date, overdue: date < today, href });
  };
  renewal("renewal:cr", "Commercial Registration renewal", company?.crRenewalDate, "/company");
  renewal("renewal:domain", `${company?.mainDomain || "Main domain"} renewal`, company?.mainDomainRenewalDate, "/company");
  for (const p of projects) renewal(`renewal:project:${p.id}`, `${p.name} — domain renewal`, p.domainRenewalDate, `/projects/${p.id}`);
  for (const c of certs) renewal(`renewal:cert:${c.id}`, `${c.name} expiry`, c.expiryDate, "/company");
  for (const f of files) items.push({ key: `file:${f.id}`, kind: "file", title: `${f.name} expires`, date: f.expiryDate, overdue: f.daysLeft < 0, href: "/files" });
  for (const a of followUps) {
    const due = a.dueAt ? toYmd(a.dueAt) : null;
    if (!due || due > today) continue;
    items.push({
      key: `follow_up:${a.id}`,
      kind: "follow_up",
      title: a.subject,
      detail: a.dealTitle ?? a.clientName ?? a.contactName ?? undefined,
      date: due,
      overdue: due < today,
      href: a.dealId ? `/crm/deals/${a.dealId}` : a.clientId ? `/clients/${a.clientId}` : "/crm/activities",
      activityId: a.id,
    });
  }
  return items.filter((i) => !snoozed.has(i.key)).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date));
}

const KEY = /^(hosting|renewal|file|follow_up):[\w:-]+$/;

export async function snoozeAttention(key: string, days: number, by: string): Promise<void> {
  if (!KEY.test(key)) throw new ValidationError("Unknown item.");
  await query(
    `insert into attention_snoozes (key, until, created_by) values ($1, $2, $3)
     on conflict (key) do update set until = excluded.until, created_by = excluded.created_by, created_at = now()`,
    [key, addDaysYmd(todayYmd(), Math.min(Math.max(days, 1), 90)), by],
  );
}

/** "Renewed": moves the renewal or expiry date on a year. */
export async function markRenewed(key: string): Promise<void> {
  const [, what, id] = key.split(":");
  if (key === "renewal:cr") await query("update company_profile set cr_renewal_date = (cr_renewal_date + interval '1 year')::date where id = 1");
  else if (key === "renewal:domain") await query("update company_profile set main_domain_renewal_date = (main_domain_renewal_date + interval '1 year')::date where id = 1");
  else if (what === "project" && id) await query("update projects set domain_renewal_date = (domain_renewal_date + interval '1 year')::date where id = $1", [id]);
  else if (what === "cert" && id) await query("update certifications set expiry_date = (expiry_date + interval '1 year')::date, status = 'active' where id = $1", [id]);
  else throw new ValidationError("That item can't be renewed from here.");
  await query("delete from attention_snoozes where key = $1", [key]);
}

