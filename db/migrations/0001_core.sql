-- NEWMUX OS — core entities: users, clients (companies), contacts, products,
-- payout parties, deduction types, ventures.
-- gen_random_uuid() is built into Postgres 13+, no extension needed.

create type user_role as enum ('partner_admin', 'lead_dev');
create type billing_cycle as enum ('monthly', 'quarterly', 'annual');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  full_name text not null,
  role user_role not null default 'lead_dev',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence client_code_seq;

create table clients (
  id uuid primary key default gen_random_uuid(),
  client_code text unique not null default ('CL-' || lpad(nextval('client_code_seq')::text, 3, '0')),
  name text not null,
  industry text,
  website text,
  email text,
  phone text,
  billing_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  full_name text not null,
  title text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contacts_client on contacts(client_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  is_saas boolean not null default false,
  paddle_product_id text unique,
  created_at timestamptz not null default now()
);

-- Payout parties in a profit split (PRD 5.3) — not login users.
create table parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table deduction_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('fixed', 'percentage')),
  created_at timestamptz not null default now()
);

-- Ventures personally held by the founders (PRD 14).
create table ventures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  brand_description text,
  website_url text,
  launch_status text not null default 'planning'
    check (launch_status in ('planning', 'in_development', 'launched', 'paused')),
  profit_split_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
