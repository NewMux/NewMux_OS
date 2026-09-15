create table saas_customers (
  id uuid primary key default gen_random_uuid(),
  paddle_customer_id text unique not null,
  client_id uuid references clients(id) on delete set null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  paddle_subscription_id text unique not null,
  saas_customer_id uuid not null references saas_customers(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  status saas_subscription_status not null,
  currency char(3) not null default 'USD',
  recurring_amount_cents bigint not null default 0,
  billing_interval text not null default 'month',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subscriptions_status on saas_subscriptions(status);

create table saas_transactions (
  id uuid primary key default gen_random_uuid(),
  paddle_transaction_id text unique not null,
  saas_subscription_id uuid references saas_subscriptions(id) on delete set null,
  saas_customer_id uuid references saas_customers(id) on delete set null,
  amount_cents bigint not null,
  currency char(3) not null default 'USD',
  status text not null,
  billed_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table paddle_webhook_events (
  id uuid primary key default gen_random_uuid(),
  paddle_event_id text unique not null,
  event_type text not null,
  processed_at timestamptz,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
