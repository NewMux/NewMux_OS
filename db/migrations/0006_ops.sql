-- Vault, SaaS billing (Paddle), growth campaigns, company profile, BD pipeline, settings.

create type secret_type as enum ('api_token', 'db_connection', 'deploy_key', 'ssh_login', 'other');
create type saas_subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
create type campaign_channel as enum ('meta_ads', 'linkedin', 'google_search', 'outbound_email');

create table vault_master_config (
  id int primary key default 1 check (id = 1),
  kdf_salt bytea not null,
  passphrase_verifier bytea not null,
  created_at timestamptz not null default now()
);

create table secrets_vault (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  label text not null,
  secret_type secret_type not null,
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  masked_preview text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table vault_access_log (
  id uuid primary key default gen_random_uuid(),
  secret_id uuid,
  accessed_by uuid references users(id) on delete set null,
  action text not null,
  accessed_at timestamptz not null default now()
);

create table saas_customers (
  id uuid primary key default gen_random_uuid(),
  paddle_customer_id text unique not null,
  client_id uuid references clients(id) on delete set null,
  email text
);

create table saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  paddle_subscription_id text unique not null,
  saas_customer_id uuid not null references saas_customers(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  status saas_subscription_status not null,
  currency text not null default 'USD',
  recurring_amount_cents bigint not null default 0,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz
);

create table saas_transactions (
  id uuid primary key default gen_random_uuid(),
  paddle_transaction_id text unique not null,
  saas_subscription_id uuid references saas_subscriptions(id) on delete set null,
  saas_customer_id uuid references saas_customers(id) on delete set null,
  amount_cents bigint not null,
  currency text not null,
  status text not null,
  billed_at timestamptz
);

create table paddle_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel campaign_channel not null,
  product_id uuid references products(id) on delete set null,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  metric_date date not null,
  spend_cents bigint not null default 0,
  leads_captured int not null default 0,
  conversions int not null default 0,
  revenue_cents bigint not null default 0,
  unique (campaign_id, metric_date)
);

create table company_profile (
  id int primary key default 1 check (id = 1),
  legal_name text not null default 'NEWMUX',
  cr_number text not null default '',
  cr_renewal_date date,
  main_domain text not null default '',
  main_domain_renewal_date date,
  vat_number text,
  address text,
  phone text,
  email text
);

create table certifications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null check (status in ('active', 'pending', 'expired')),
  expiry_date date,
  created_at timestamptz not null default now()
);

create table partnerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table pipeline_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage text not null default 'in_progress' check (stage in ('in_progress', 'complete')),
  notes text,
  created_at timestamptz not null default now()
);

-- Small key/value store for app-wide settings (e.g. migration checklist state).
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
