create sequence document_number_quote_seq;
create sequence document_number_contract_seq;
create sequence document_number_invoice_seq;

create table documents (
  id uuid primary key default gen_random_uuid(),
  type document_type not null,
  status document_status not null default 'draft',
  client_id uuid not null references clients(id) on delete restrict,
  product_id uuid references products(id) on delete set null,
  document_number text unique not null,
  currency char(3) not null default 'USD',
  subtotal_cents bigint not null default 0,
  tax_rate_bps int not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  payment_terms text,
  notes text,
  issued_at timestamptz,
  due_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  archived_at timestamptz,
  pdf_storage_path text,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_documents_client on documents(client_id);
create index idx_documents_status on documents(status);

create table document_line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price_cents bigint not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
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
