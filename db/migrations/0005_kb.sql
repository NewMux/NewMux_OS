-- Knowledge base: spaces → nested pages (TipTap JSON), templates, favorites, recents.

create table kb_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text not null default 'book',
  color text not null default 'blue',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table kb_pages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references kb_spaces(id) on delete cascade,
  parent_id uuid references kb_pages(id) on delete cascade,
  title text not null default '',
  emoji text,
  content jsonb not null default '{"type":"doc","content":[]}',
  content_text text not null default '',
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content_text, '')), 'B')
  ) stored,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  is_template boolean not null default false,
  sort_order int not null default 0,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_kb_pages_space on kb_pages(space_id);
create index idx_kb_pages_parent on kb_pages(parent_id);
create index idx_kb_pages_search on kb_pages using gin(search);

create table kb_favorites (
  user_id uuid not null references users(id) on delete cascade,
  page_id uuid not null references kb_pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

create table kb_page_views (
  user_id uuid not null references users(id) on delete cascade,
  page_id uuid not null references kb_pages(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

alter table meetings add column kb_page_id uuid references kb_pages(id) on delete set null;
