/**
 * Database CLI.
 *
 *   npm run db:migrate   apply pending db/migrations/*.sql
 *   npm run seed         migrate, then load db/seed.sql if the database is empty
 *
 * Targets DATABASE_URL (Supabase: use the pooled connection string) when set,
 * otherwise the local PGlite database in .data/pglite — which also migrates
 * and seeds itself automatically the first time the app starts.
 */
import { migrateDatabase } from "../lib/db";

const command = process.argv[2] ?? "migrate";
const target = process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "local PGlite (.data/pglite)";

migrateDatabase({ seed: command === "seed" })
  .then(({ applied, seeded }) => {
    console.log(`[NEWMUX OS] ${target}: ${applied.length ? `applied ${applied.join(", ")}` : "schema up to date"}${seeded ? "; seeded demo data" : ""}.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
