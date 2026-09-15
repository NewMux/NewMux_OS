create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  name text not null,
  status project_status not null default 'planning',
  started_at timestamptz,
  target_end_at timestamptz,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_status on projects(status);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  priority task_priority not null default 'medium',
  status task_status not null default 'todo',
  assignee_id uuid references users(id) on delete set null,
  due_at timestamptz,
  sort_order int not null default 0,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_status_priority on tasks(status, priority);
