/**
 * Placeholder for the real Postgres/Supabase seed script.
 *
 * The backend was deferred for this build pass (see plan Section 2 /
 * db/migrations/*.sql) — right now the app runs entirely on the in-memory
 * mock layer in lib/data/*, which seeds itself automatically on first
 * access (see lib/data/store.ts). There is nothing to seed yet.
 *
 * Once a Supabase project is provisioned and the migrations in
 * db/migrations/ are applied, this script should insert the same seed data
 * store.ts generates today (users, sample clients/products, etc.) via `sql`
 * from lib/db.ts, with the admin password provided via env var rather than
 * generated at random.
 */
console.log(
  "[NEWMUX OS] No live database configured — the app uses the in-memory mock data layer, which seeds itself automatically. Nothing to do here yet.",
);
