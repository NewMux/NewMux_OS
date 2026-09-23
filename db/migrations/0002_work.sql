-- Projects, tasks (with subtasks + comments), meetings, profit-split rules.

create type project_status as enum ('planning', 'active_sprint', 'paused', 'completed', 'archived');
create type task_priority as enum ('urgent', 'high', 'medium', 'low');
create type task_status as enum ('todo', 'in_progress', 'in_review', 'done');

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  name text not null,
  description text,
  color text not null default 'blue',
  status project_status not null default 'planning',
  started_at date,
  target_end_at date,
  created_by uuid references users(id) on delete set null,
  -- Technical detail (PRD 10.2). Credentials live in the vault, never here.
  tech_stack text,
  hosting_provider text,
  control_panel_url text,
  domain text,
  domain_renewal_date date,
  github_url text,
  profit_split_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_client on projects(client_id);

-- Fully editable in Settings (PRD 5.3.1). splits: [{partyId, percentageBps}],
-- deductions: [{deductionTypeId, value}] (fixed → minor units, percentage → bps).
create table profit_split_rules (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('project', 'venture')),
  scope_id uuid not null,
  splits jsonb not null default '[]',
  deductions jsonb not null default '[]',
  is_default boolean not null default false,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_id)
);

alter table projects
  add constraint projects_profit_split_rule_fk
  foreign key (profit_split_rule_id) references profit_split_rules(id) on delete set null;
alter table ventures
  add constraint ventures_profit_split_rule_fk
  foreign key (profit_split_rule_id) references profit_split_rules(id) on delete set null;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  priority task_priority not null default 'medium',
  status task_status not null default 'todo',
  assignee_id uuid references users(id) on delete set null,
  due_at date,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_assignee on tasks(assignee_id);

create table subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_subtasks_task on subtasks(task_id);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_task_comments_task on task_comments(task_id);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  duration_minutes int not null default 60,
  location text,
  linked_project_id uuid references projects(id) on delete set null,
  linked_client_id uuid references clients(id) on delete set null,
  notes text,
  recurring text not null default 'none' check (recurring in ('none', 'weekly', 'monthly')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_meetings_starts on meetings(starts_at);
