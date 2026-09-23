-- The app talks to Postgres only from the server, as the table owner, and
-- enforces access in lib/rbac.ts. Enabling RLS with NO policies means the
-- Supabase REST/anon/authenticated roles can read or write nothing at all.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
