import { query } from "@/lib/db";
import { many, must, one } from "./sql";
import { logAudit } from "./audit";
import { todayYmd } from "@/lib/time";
import { convertMinorUnits } from "@/lib/money";
import type { CampaignChannel, Currency } from "./types";
import type { CampaignStatus, PostChannel, PostStatus } from "@/lib/marketing";

/**
 * Marketing: a content calendar of posts, campaigns with a plan (goal,
 * budget, dates, owner) and their numbers, and where deals came from
 * (deals.source and deals.campaign_id). Open to partners and the Marketing
 * role; deal values only ever reach partners (see lib/rbac.ts).
 */

export { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, POST_CHANNELS, POST_STATUSES } from "@/lib/marketing";
export type { CampaignStatus, PostChannel, PostStatus } from "@/lib/marketing";

export type MarketingPost = {
  id: string;
  title: string;
  channel: PostChannel;
  status: PostStatus;
  publishAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  caption: string | null;
  link: string | null;
  notes: string | null;
  assetFileId: string | null;
  assetFileName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostInput = {
  title: string;
  channel: PostChannel;
  status: PostStatus;
  publishAt: string | null;
  ownerId: string | null;
  campaignId: string | null;
  caption: string | null;
  link: string | null;
  notes: string | null;
  assetFileId: string | null;
};

const POST_SELECT = `
  select p.*, u.full_name as owner_name, c.name as campaign_name, f.name as asset_file_name
  from marketing_posts p
  left join users u on u.id = p.owner_id
  left join campaigns c on c.id = p.campaign_id
  left join files f on f.id = p.asset_file_id`;

/** Posts, soonest first; ones without a date (ideas) come last. */
export async function listPosts(filter: { from?: string; to?: string; campaignId?: string } = {}): Promise<MarketingPost[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.from) where.push(`(p.publish_at is null or p.publish_at >= $${params.push(filter.from)})`);
  if (filter.to) where.push(`(p.publish_at is null or p.publish_at < $${params.push(filter.to)})`);
  if (filter.campaignId) where.push(`p.campaign_id = $${params.push(filter.campaignId)}`);
  return many<MarketingPost>(`${POST_SELECT} ${where.length ? `where ${where.join(" and ")}` : ""} order by p.publish_at nulls last, p.created_at desc limit 500`, params);
}

export async function getPost(id: string): Promise<MarketingPost | undefined> {
  return one<MarketingPost>(`${POST_SELECT} where p.id = $1`, [id]);
}

export async function createPost(input: PostInput, createdBy: string): Promise<MarketingPost> {
  const row = await must<{ id: string }>(
    "Post",
    `insert into marketing_posts (title, channel, status, publish_at, owner_id, campaign_id, caption, link, notes, asset_file_id, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [input.title, input.channel, input.status, input.publishAt, input.ownerId ?? createdBy, input.campaignId, input.caption, input.link, input.notes, input.assetFileId, createdBy],
  );
  return (await getPost(row.id))!;
}

export async function updatePost(id: string, input: PostInput): Promise<MarketingPost> {
  await must(
    "Post",
    `update marketing_posts set title = $2, channel = $3, status = $4, publish_at = $5, owner_id = $6, campaign_id = $7,
       caption = $8, link = $9, notes = $10, asset_file_id = $11, updated_at = now()
     where id = $1 returning id`,
    [id, input.title, input.channel, input.status, input.publishAt, input.ownerId, input.campaignId, input.caption, input.link, input.notes, input.assetFileId],
  );
  return (await getPost(id))!;
}

/** Moves a post along the board (idea → … → published) without touching anything else. */
export async function setPostStatus(id: string, status: PostStatus): Promise<MarketingPost> {
  await must("Post", "update marketing_posts set status = $2, updated_at = now() where id = $1 returning id", [id, status]);
  return (await getPost(id))!;
}

export async function deletePost(id: string): Promise<void> {
  await query("delete from marketing_posts where id = $1", [id]);
}

// --- Campaigns ---

export type MarketingCampaign = {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number | null;
  currency: Currency;
  ownerId: string | null;
  ownerName: string | null;
  notes: string | null;
  productId: string | null;
  /** From the logged numbers (campaign_metrics). Spend is in the campaign's currency. */
  spendCents: number;
  leadsCaptured: number;
  conversions: number;
  /** Partners only: revenue logged against it, and the value of deals it won. Zero for everyone else. */
  revenueCents: number;
  wonValueBhdCents: number;
  posts: number;
  deals: number;
  wonDeals: number;
};

export type CampaignInput = {
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number | null;
  currency: Currency;
  ownerId: string | null;
  notes: string | null;
};

export async function listMarketingCampaigns(opts: { money: boolean }): Promise<MarketingCampaign[]> {
  const rows = await many<MarketingCampaign & { wonValueUsdCents: number }>(
    `select c.id, c.name, c.channel, c.status, c.goal, c.start_date, c.end_date, c.budget_cents, c.currency, c.owner_id, c.notes, c.product_id,
       u.full_name as owner_name,
       coalesce(m.spend_cents, 0)::int8 as spend_cents, coalesce(m.leads, 0)::int8 as leads_captured, coalesce(m.conversions, 0)::int8 as conversions,
       coalesce(m.revenue_cents, 0)::int8 as revenue_cents,
       coalesce(d.won_value, 0)::int8 as won_value_bhd_cents, coalesce(d.won_value_usd, 0)::int8 as won_value_usd_cents,
       coalesce(p.posts, 0)::int8 as posts, coalesce(d.deals, 0)::int8 as deals, coalesce(d.won, 0)::int8 as won_deals
     from campaigns c
     left join users u on u.id = c.owner_id
     left join (select campaign_id, sum(spend_cents) as spend_cents, sum(leads_captured) as leads, sum(conversions) as conversions, sum(revenue_cents) as revenue_cents
                from campaign_metrics group by campaign_id) m on m.campaign_id = c.id
     left join (select campaign_id, count(*) as posts from marketing_posts group by campaign_id) p on p.campaign_id = c.id
     left join (select campaign_id, count(*) as deals, count(*) filter (where stage = 'won') as won,
                  sum(case when stage = 'won' and currency = 'BHD' then value_cents else 0 end) as won_value,
                  sum(case when stage = 'won' and currency = 'USD' then value_cents else 0 end) as won_value_usd
                from deals where campaign_id is not null group by campaign_id) d on d.campaign_id = c.id
     order by case c.status when 'active' then 0 when 'planned' then 1 when 'paused' then 2 else 3 end, c.start_date desc nulls last, c.name`,
  );
  return rows.map(({ wonValueUsdCents, ...r }) =>
    opts.money ? { ...r, wonValueBhdCents: r.wonValueBhdCents + convertMinorUnits(wonValueUsdCents, "USD", "BHD") } : { ...r, revenueCents: 0, wonValueBhdCents: 0 },
  );
}

export async function createMarketingCampaign(input: CampaignInput, createdBy: string): Promise<{ id: string }> {
  const row = await must<{ id: string }>(
    "Campaign",
    `insert into campaigns (name, channel, status, is_active, goal, start_date, end_date, budget_cents, currency, owner_id, notes, created_by)
     values ($1, $2, $3, $3 in ('active', 'planned'), $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [input.name, input.channel, input.status, input.goal, input.startDate ?? todayYmd(), input.endDate, input.budgetCents, input.currency, input.ownerId ?? createdBy, input.notes, createdBy],
  );
  return row;
}

export async function updateMarketingCampaign(id: string, input: CampaignInput): Promise<void> {
  await must(
    "Campaign",
    `update campaigns set name = $2, channel = $3, status = $4, is_active = $4 in ('active', 'planned'), goal = $5, start_date = $6, end_date = $7,
       budget_cents = $8, currency = $9, owner_id = $10, notes = $11
     where id = $1 returning id`,
    [id, input.name, input.channel, input.status, input.goal, input.startDate, input.endDate, input.budgetCents, input.currency, input.ownerId, input.notes],
  );
}

export async function deleteMarketingCampaign(id: string, deletedBy: string): Promise<void> {
  const row = await one<{ name: string }>("delete from campaigns where id = $1 returning name", [id]);
  if (row) await logAudit({ entityType: "campaign", entityId: id, action: "delete", summary: `Deleted campaign "${row.name}"`, changedBy: deletedBy });
}

/**
 * A day's numbers for a campaign. Revenue is only written when given (partners):
 * someone without money access logging spend and leads leaves it as it was.
 */
export async function logCampaignNumbers(input: { campaignId: string; metricDate: string; spendCents: number; leadsCaptured: number; conversions: number; revenueCents?: number }): Promise<void> {
  await query(
    `insert into campaign_metrics (campaign_id, metric_date, spend_cents, leads_captured, conversions, revenue_cents)
     values ($1, $2, $3, $4, $5, coalesce($6, 0))
     on conflict (campaign_id, metric_date) do update set spend_cents = excluded.spend_cents, leads_captured = excluded.leads_captured,
       conversions = excluded.conversions, revenue_cents = coalesce($6, campaign_metrics.revenue_cents)`,
    [input.campaignId, input.metricDate, input.spendCents, input.leadsCaptured, input.conversions, input.revenueCents ?? null],
  );
}

// --- Leads from marketing ---

export type LeadSourceRow = {
  /** The source as typed on the deal, or "Not recorded". */
  source: string;
  deals: number;
  open: number;
  won: number;
  lost: number;
  /** Partners only; zero for everyone else. */
  wonValueBhdCents: number;
};

export type LeadCampaignRow = LeadSourceRow & { campaignId: string; campaignName: string };

/** Deals created since `from`, grouped by where they came from and by campaign. */
export async function getLeadsReport(opts: { from: string | null; money: boolean }): Promise<{ bySource: LeadSourceRow[]; byCampaign: LeadCampaignRow[]; total: LeadSourceRow }> {
  const params: unknown[] = [];
  const since = opts.from ? `and d.created_at >= $${params.push(opts.from)}::date` : "";
  const counts = `count(*)::int8 as deals,
       count(*) filter (where d.stage not in ('won', 'lost'))::int8 as open,
       count(*) filter (where d.stage = 'won')::int8 as won,
       count(*) filter (where d.stage = 'lost')::int8 as lost,
       coalesce(sum(case when d.stage = 'won' and d.currency = 'BHD' then d.value_cents else 0 end), 0)::int8 as won_value_bhd_cents,
       coalesce(sum(case when d.stage = 'won' and d.currency = 'USD' then d.value_cents else 0 end), 0)::int8 as won_value_usd_cents`;
  const [bySource, byCampaign, total] = await Promise.all([
    many<LeadSourceRow>(
      `select coalesce(nullif(trim(d.source), ''), 'Not recorded') as source, ${counts}
       from deals d where true ${since} group by 1 order by deals desc, source`,
      params,
    ),
    many<LeadCampaignRow>(
      `select c.id as campaign_id, c.name as campaign_name, c.name as source, ${counts}
       from deals d join campaigns c on c.id = d.campaign_id where true ${since} group by c.id, c.name order by deals desc`,
      params,
    ),
    one<LeadSourceRow>(`select 'All' as source, ${counts} from deals d where true ${since}`, params),
  ]);
  // Won value in BHD (USD deals converted), and only for partners.
  const hide = <T extends LeadSourceRow & { wonValueUsdCents?: number }>({ wonValueUsdCents = 0, ...r }: T): T =>
    ({ ...r, wonValueBhdCents: opts.money ? r.wonValueBhdCents + convertMinorUnits(wonValueUsdCents, "USD", "BHD") : 0 }) as T;
  return { bySource: bySource.map(hide), byCampaign: byCampaign.map(hide), total: hide(total ?? { source: "All", deals: 0, open: 0, won: 0, lost: 0, wonValueBhdCents: 0 }) };
}

/** What the marketing sheets pick from: people, campaigns, and brand/marketing files to attach. */
export async function marketingOptions(): Promise<{ users: { id: string; name: string }[]; campaigns: { id: string; name: string }[]; assets: { id: string; name: string }[] }> {
  const [users, campaigns, assets] = await Promise.all([
    many<{ id: string; name: string }>("select id, full_name as name from users where is_active order by full_name"),
    many<{ id: string; name: string }>("select id, name from campaigns order by status = 'completed', name"),
    many<{ id: string; name: string }>("select id, name from files where category in ('brand', 'marketing') order by name"),
  ]);
  return { users, campaigns, assets };
}
