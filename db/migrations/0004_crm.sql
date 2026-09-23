-- CRM: deals pipeline and the activity timeline (calls, emails, notes, follow-ups).

create type deal_stage as enum ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
create type activity_kind as enum ('call', 'email', 'meeting', 'note', 'whatsapp', 'follow_up');

create table deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references clients(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  stage deal_stage not null default 'lead',
  value_cents bigint not null default 0,
  currency text not null default 'BHD' check (currency in ('BHD', 'USD')),
  probability int not null default 10 check (probability between 0 and 100),
  expected_close date,
  owner_id uuid references users(id) on delete set null,
  source text,
  notes text,
  lost_reason text,
  sort_order int not null default 0,
  project_id uuid references projects(id) on delete set null,
  won_at timestamptz,
  closed_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deals_stage on deals(stage);
create index idx_deals_client on deals(client_id);

create table activities (
  id uuid primary key default gen_random_uuid(),
  kind activity_kind not null,
  subject text not null,
  body text,
  client_id uuid references clients(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete cascade,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_activities_client on activities(client_id);
create index idx_activities_deal on activities(deal_id);
create index idx_activities_due on activities(due_at) where completed_at is null;

alter table documents add column deal_id uuid references deals(id) on delete set null;
alter table meetings add column linked_deal_id uuid references deals(id) on delete set null;
