create table vault_master_config (
  id int primary key default 1,
  kdf_salt bytea not null,
  passphrase_verifier bytea not null,
  created_at timestamptz not null default now(),
  check (id = 1)
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
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_vault_client on secrets_vault(client_id);
create index idx_vault_project on secrets_vault(project_id);

create table vault_access_log (
  id uuid primary key default gen_random_uuid(),
  secret_id uuid not null references secrets_vault(id) on delete cascade,
  accessed_by uuid not null references users(id) on delete restrict,
  action text not null,
  accessed_at timestamptz not null default now()
);
