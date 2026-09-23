-- Documents (quotes/contracts/invoices), payments, expenses, hosting fees, audit log.

create type document_type as enum ('quote', 'contract', 'invoice');
create type document_status as enum ('draft', 'sent', 'accepted', 'signed', 'paid', 'archived');

-- Atomic per-type, per-year numbering (QUO-2026-2607, INV-2026-0266 …).
create table doc_sequences (
  doc_type document_type not null,
  year int not null,
  last_value int not null,
  primary key (doc_type, year)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  type document_type not null,
  status document_status not null default 'draft',
  client_id uuid not null references clients(id) on delete restrict,
  product_id uuid references products(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  converted_from_quotation_id uuid references documents(id) on delete set null,
  profit_split_rule_id uuid references profit_split_rules(id) on delete set null,
  document_number text unique not null,
  currency text not null default 'BHD' check (currency in ('BHD', 'USD')),
  subtotal_cents bigint not null default 0,
  tax_rate_bps int not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  payment_terms text,
  notes text,
  issued_at timestamptz,
  due_at date,
  accepted_at timestamptz,
  paid_at timestamptz,
  archived_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_documents_client on documents(client_id);
create index idx_documents_project on documents(project_id);
create index idx_documents_type_status on documents(type, status);

create table document_line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price_cents bigint not null default 0,
  sort_order int not null default 0
);
create index idx_line_items_document on document_line_items(document_id);

create table document_status_history (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  from_status document_status,
  to_status document_status not null,
  changed_by uuid references users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index idx_status_history_document on document_status_history(document_id);

-- Partial/full payments. Never changes the invoice's value (PRD 5.5).
create table payments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null default current_date,
  method text not null check (method in ('cash', 'transfer', 'card', 'cheque')),
  reference text,
  recorded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_payments_document on payments(document_id);
create index idx_payments_paid_on on payments(paid_on);

create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  amount_cents bigint not null,
  currency text not null check (currency in ('BHD', 'USD')),
  cycle billing_cycle not null,
  last_payment_date date,
  next_due_date date,
  linked_client_id uuid references clients(id) on delete set null,
  linked_project_id uuid references projects(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now()
);

-- Money actually spent (one-off, or a logged payment of a recurring expense).
create table expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null,
  vendor text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency in ('BHD', 'USD')),
  spent_on date not null default current_date,
  linked_client_id uuid references clients(id) on delete set null,
  linked_project_id uuid references projects(id) on delete set null,
  recurring_expense_id uuid references recurring_expenses(id) on delete set null,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_expenses_spent_on on expenses(spent_on);

-- Hosting/domain fees collected FROM clients (PRD 6).
create table hosting_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  item text not null check (item in ('server', 'domain', 'other')),
  label text,
  amount_cents bigint not null,
  currency text not null check (currency in ('BHD', 'USD')),
  cycle billing_cycle not null,
  last_collected_date date,
  next_due_date date,
  status text not null default 'active' check (status in ('active', 'overdue', 'paused')),
  linked_invoice_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Every change to money-affecting records (PRD 15.1).
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  summary text not null,
  changed_by uuid references users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index idx_audit_changed_at on audit_log(changed_at desc);
