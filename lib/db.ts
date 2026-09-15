import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __newmuxSql: ReturnType<typeof postgres> | undefined;
}

function createSqlClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(connectionString, {
    prepare: true,
    // Supabase pooled connections use pgbouncer in transaction mode by default;
    // keep max low for serverless function concurrency.
    max: 5,
  });
}

// Reuse the client across hot reloads in dev / across invocations on the same
// serverless instance to avoid exhausting connections.
export const sql = global.__newmuxSql ?? createSqlClient();

if (process.env.NODE_ENV !== "production") {
  global.__newmuxSql = sql;
}
