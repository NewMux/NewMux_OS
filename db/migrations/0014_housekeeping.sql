-- Housekeeping and UX data (Improvements PRD items 19, 21, 26, 31).

-- 19. The seeded demo account has no place in production.
delete from users where full_name = 'Demo Limited-Access User' and role = 'lead_dev';

-- 21. Notion migration: everything is done except the Vault and archiving Notion.
insert into app_settings (key, value) values (
  'notion_migration_checklist',
  '["Export client list from Notion", "Import clients and primary contacts", "Recreate open deals in the pipeline", "Move SOPs into the Wiki", "Re-enter open invoices and payments", "Move hosting fee schedule"]'::jsonb
)
on conflict (key) do update set value = (
  select coalesce(jsonb_agg(distinct step), '[]'::jsonb)
  from jsonb_array_elements_text(app_settings.value || excluded.value) as t(step)
), updated_at = now();

-- 31. A short name for lists ("Marasi" instead of "Marasi Alsawadi Resort & …").
alter table clients add column short_name text;

-- 26. "Snooze" on Today's Needs Attention items (key = kind:id).
create table attention_snoozes (
  key text primary key,
  until date not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table attention_snoozes enable row level security;
