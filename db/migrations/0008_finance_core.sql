-- Finance core (Improvements PRD, items 1–6): bank accounts with an opening
-- balance and statement reconciliation, partner payouts, funds (the Newmux
-- reserve), ordered deductions with an explicit base, invoice-level split
-- rules, and expenses that can be charged to one invoice.

-- 1. Company bank accounts. The running balance is the opening balance plus
--    every movement dated on or after opening_balance_date.
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'BHD' check (currency in ('BHD', 'USD')),
  opening_balance_cents bigint not null default 0,
  opening_balance_date date not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most one default account: payments and expenses without an account land there.
create unique index bank_accounts_one_default on bank_accounts (is_default) where is_default;

-- A check against a bank statement. A non-zero adjustment is posted as a
-- movement on the statement date, so the balance then matches the bank.
create table bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references bank_accounts(id) on delete cascade,
  statement_date date not null,
  statement_balance_cents bigint not null,
  computed_balance_cents bigint not null,
  adjustment_cents bigint not null default 0,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_reconciliations_account on bank_reconciliations(account_id, statement_date desc);

alter table payments add column account_id uuid references bank_accounts(id) on delete set null;
alter table expenses add column account_id uuid references bank_accounts(id) on delete set null;

-- 6. A party is a partner or a fund (the Newmux reserve). A deduction type
--    can credit a fund, and an expense can be charged to one (spending it).
alter table parties add column kind text not null default 'partner' check (kind in ('partner', 'fund'));
alter table deduction_types add column fund_party_id uuid references parties(id) on delete set null;
alter table expenses add column fund_party_id uuid references parties(id) on delete set null;

-- 2. What was actually paid to each party.
create table payouts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties(id) on delete restrict,
  type text not null check (type in ('share', 'advance', 'withdrawal', 'reimbursement')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BHD' check (currency in ('BHD', 'USD')),
  paid_on date not null,
  document_id uuid references documents(id) on delete set null,
  account_id uuid references bank_accounts(id) on delete set null,
  reference text,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_payouts_party on payouts(party_id);
create index idx_payouts_paid_on on payouts(paid_on);

-- 5. A split rule can belong to a single invoice (an override of the project's rule).
alter table profit_split_rules drop constraint profit_split_rules_scope_type_check;
alter table profit_split_rules add constraint profit_split_rules_scope_type_check
  check (scope_type in ('project', 'venture', 'document'));

-- 3/4. Pass-through costs: an expense charged to one invoice comes off that
--      invoice before any percentage deduction.
alter table expenses add column document_id uuid references documents(id) on delete set null;
create index idx_expenses_project on expenses(linked_project_id);
create index idx_expenses_document on expenses(document_id);

-- 17. Expenses keep their BHD value at the payment date's rate, so BHD totals
--     can't drift. Existing rows get the official peg (1 BHD = 2.6596 USD).
alter table expenses add column fx_rate numeric(12, 6);
alter table expenses add column amount_bhd_cents bigint;
update expenses set fx_rate = 1, amount_bhd_cents = amount_cents where currency = 'BHD';
update expenses set fx_rate = round(1 / 2.6596, 6), amount_bhd_cents = round(amount_cents * 10 / 2.6596) where currency = 'USD';
-- Any insert that doesn't say (seed data, older code paths) gets the peg.
create function expenses_fill_bhd() returns trigger language plpgsql as $$
begin
  if new.amount_bhd_cents is null then
    new.amount_bhd_cents := case when new.currency = 'BHD' then new.amount_cents else round(new.amount_cents * 10 / 2.6596) end;
    new.fx_rate := case when new.currency = 'BHD' then 1 else round(1 / 2.6596, 6) end;
  end if;
  return new;
end $$;
create trigger expenses_fill_bhd before insert or update on expenses for each row execute function expenses_fill_bhd();
alter table expenses alter column amount_bhd_cents set not null;

-- The reserve fund, and the deduction types that feed it.
insert into parties (name, kind)
select 'Newmux Reserve', 'fund'
where not exists (select 1 from parties where kind = 'fund');

update deduction_types
set fund_party_id = (select id from parties where kind = 'fund' order by created_at limit 1)
where fund_party_id is null and name ilike '%newmux reserve%';

alter table bank_accounts enable row level security;
alter table bank_reconciliations enable row level security;
alter table payouts enable row level security;
