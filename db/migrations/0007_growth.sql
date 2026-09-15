create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel campaign_channel not null,
  product_id uuid references products(id) on delete set null,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  metric_date date not null,
  spend_cents bigint not null default 0,
  leads_captured int not null default 0,
  conversions int not null default 0,
  revenue_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, metric_date)
);
create index idx_campaign_metrics_campaign on campaign_metrics(campaign_id);

create view campaign_attribution_view as
select
  c.id as campaign_id,
  c.name,
  c.channel,
  c.is_active,
  coalesce(sum(m.spend_cents), 0) as spend_cents,
  coalesce(sum(m.leads_captured), 0) as leads_captured,
  coalesce(sum(m.conversions), 0) as conversions,
  coalesce(sum(m.revenue_cents), 0) as revenue_cents,
  case when coalesce(sum(m.leads_captured), 0) = 0 then 0
       else round(sum(m.conversions)::numeric / sum(m.leads_captured), 4) end as conversion_rate,
  case when coalesce(sum(m.conversions), 0) = 0 then null
       else round(sum(m.spend_cents)::numeric / sum(m.conversions), 2) end as blended_cac_cents,
  case when coalesce(sum(m.spend_cents), 0) = 0 then null
       else round(sum(m.revenue_cents)::numeric / sum(m.spend_cents), 4) end as roas
from campaigns c
left join campaign_metrics m on m.campaign_id = c.id
group by c.id, c.name, c.channel, c.is_active;
