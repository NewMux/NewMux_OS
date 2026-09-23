import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";

/**
 * One tiny query interface over two Postgres backends:
 *
 * - `DATABASE_URL` set → postgres.js against Supabase (use the pooled,
 *   transaction-mode connection string; prepared statements are disabled
 *   for that reason).
 * - otherwise → PGlite, an embedded WASM Postgres persisted to `.data/pglite`,
 *   which auto-applies `db/migrations/*.sql` and `db/seed.sql` on first use.
 *   Same SQL, same schema — local dev needs no credentials.
 *
 * Both backends parse int8/numeric → number, date → "YYYY-MM-DD",
 * timestamptz → ISO string, so rows map straight onto lib/data/types.ts.
 */

type Row = Record<string, unknown>;
type Executor = (text: string, params?: unknown[]) => Promise<Row[]>;

type Backend = {
  query: Executor;
  /** Runs a multi-statement SQL script (migrations, seed). */
  exec(script: string): Promise<void>;
  transaction<T>(fn: (exec: Executor) => Promise<T>): Promise<T>;
};

declare global {
  // eslint-disable-next-line no-var
  var __newmuxDb: Promise<Backend> | undefined;
}

const txStorage = new AsyncLocalStorage<Executor>();

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const SEED_FILE = path.join(process.cwd(), "db", "seed.sql");

async function createPostgresBackend(url: string): Promise<Backend> {
  const { default: postgres } = await import("postgres");
  const passthrough = (x: string) => x;
  const sql = postgres(url, {
    prepare: false,
    max: 5,
    types: {
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      date: { to: 1082, from: [1082], serialize: passthrough, parse: passthrough },
      timestamptz: {
        to: 1184,
        from: [1184, 1114],
        serialize: (x: string | Date) => (x instanceof Date ? x.toISOString() : x),
        parse: (x: string) => new Date(x).toISOString(),
      },
    },
  });
  const exec =
    (runner: typeof sql): Executor =>
    async (text, params = []) =>
      (await runner.unsafe(text, params as never[])) as unknown as Row[];
  return {
    query: exec(sql),
    exec: async (script) => {
      await sql.unsafe(script).simple();
    },
    transaction: (fn) => sql.begin((tx) => fn(exec(tx as unknown as typeof sql))) as never,
  };
}

async function createPgliteBackend(): Promise<Backend> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir, {
    parsers: {
      20: Number,
      1700: Number,
      1082: (x: string) => x,
      1114: (x: string) => new Date(x + "Z").toISOString(),
      1184: (x: string) => new Date(x).toISOString(),
    },
  });
  await db.waitReady;
  const exec =
    (runner: { query: typeof db.query }): Executor =>
    async (text, params = []) =>
      (await runner.query<Row>(text, params)).rows;

  const backend: Backend = {
    query: exec(db),
    exec: async (script) => {
      await db.exec(script);
    },
    transaction: (fn) => db.transaction((tx) => fn(exec(tx))),
  };
  await migrate(backend, { seed: true });
  return backend;
}

/** Applies pending db/migrations/*.sql in filename order; optionally seeds an empty database. */
async function migrate(backend: Backend, opts: { seed: boolean }): Promise<{ applied: string[]; seeded: boolean }> {
  const execScript = backend.exec;
  await execScript(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set((await backend.query("select name from schema_migrations")).map((r) => r.name as string));
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    await execScript(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    await backend.query("insert into schema_migrations (name) values ($1)", [file]);
    newlyApplied.push(file);
  }
  let seeded = false;
  const count = ((await backend.query("select count(*)::int as count from users"))[0]?.count as number) ?? 0;
  if (opts.seed && count === 0 && fs.existsSync(SEED_FILE)) {
    await execScript(fs.readFileSync(SEED_FILE, "utf8"));
    seeded = true;
    // eslint-disable-next-line no-console
    console.log("[NEWMUX OS] Seeded the database. Log in as info@newmux.com / changeme123 and change the password in Settings.");
  }
  return { applied: newlyApplied, seeded };
}

/** For scripts/db.ts: migrate (and optionally seed) whichever backend is configured. */
export async function migrateDatabase(opts: { seed: boolean }) {
  return migrate(await getBackend(), opts);
}

function getBackend(): Promise<Backend> {
  if (!global.__newmuxDb) {
    const url = process.env.DATABASE_URL;
    global.__newmuxDb = url ? createPostgresBackend(url) : createPgliteBackend();
    global.__newmuxDb.catch(() => {
      global.__newmuxDb = undefined;
    });
  }
  return global.__newmuxDb;
}

/** Runs a parameterized query ($1, $2 …). Inside `tx()`, runs on that transaction. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const inTx = txStorage.getStore();
  if (inTx) return (await inTx(text, params)) as T[];
  const backend = await getBackend();
  return (await backend.query(text, params)) as T[];
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** Runs `fn` in a transaction; every `query()` call inside it joins the transaction. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStorage.getStore()) return fn();
  const backend = await getBackend();
  return backend.transaction((exec) => txStorage.run(exec, fn));
}

export async function pingDb(): Promise<boolean> {
  try {
    await query("select 1");
    return true;
  } catch {
    return false;
  }
}
