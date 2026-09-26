-- Company files with expiry reminders (Improvements PRD items 18, 38).
-- Stored in Postgres so they are covered by the same backups and access rules
-- as everything else. Bytes live in file_blobs so listing files never loads them.

create table files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other'
    check (category in ('contract', 'registration', 'certificate', 'brand', 'legal', 'finance', 'receipt', 'other')),
  content_type text not null,
  size_bytes int not null,
  issue_date date,
  expiry_date date,
  remind_days_before int not null default 30 check (remind_days_before between 0 and 365),
  notes text,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  venture_id uuid references ventures(id) on delete set null,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_files_expiry on files(expiry_date) where expiry_date is not null;

create table file_blobs (
  file_id uuid primary key references files(id) on delete cascade,
  data bytea not null
);

alter table files enable row level security;
alter table file_blobs enable row level security;
