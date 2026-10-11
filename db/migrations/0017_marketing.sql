-- Marketing: campaigns get a plan (status, goal, budget, owner), a content
-- calendar of posts, deals remember the campaign that brought them, and
-- files get a category for marketing assets.

alter table campaigns add column status text not null default 'active'
  check (status in ('planned', 'active', 'paused', 'completed'));
update campaigns set status = case when is_active then 'active' else 'completed' end;
alter table campaigns add column goal text;
alter table campaigns add column budget_cents bigint;
alter table campaigns add column currency text not null default 'BHD' check (currency in ('BHD', 'USD'));
-- Campaigns before this were the SaaS ones on Growth, logged in USD.
update campaigns set currency = 'USD';
alter table campaigns add column owner_id uuid references users(id) on delete set null;
alter table campaigns add column notes text;

create table marketing_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'instagram'
    check (channel in ('instagram', 'linkedin', 'x', 'tiktok', 'facebook', 'youtube', 'website', 'newsletter', 'other')),
  status text not null default 'idea'
    check (status in ('idea', 'drafting', 'review', 'scheduled', 'published')),
  publish_at timestamptz,
  owner_id uuid references users(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  caption text,
  link text,
  notes text,
  asset_file_id uuid references files(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_posts_publish_at on marketing_posts(publish_at);
alter table marketing_posts enable row level security;

-- Which campaign a deal came from ("Leads from marketing"); deals.source keeps the channel or referrer.
alter table deals add column campaign_id uuid references campaigns(id) on delete set null;
create index deals_campaign on deals(campaign_id);

-- Post images, templates and other marketing assets.
alter table files drop constraint if exists files_category_check;
alter table files add constraint files_category_check
  check (category in ('contract', 'registration', 'certificate', 'brand', 'marketing', 'legal', 'finance', 'receipt', 'other'));
