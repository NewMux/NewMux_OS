import { query } from "@/lib/db";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/** Business-rule violation (e.g. overpayment) — surfaced to the user as a 400/409. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function camel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

/** Runs a query and maps snake_case columns onto camelCase fields. */
export async function many<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await query<Record<string, unknown>>(text, params);
  return rows.map((r) => camel<T>(r));
}

export async function one<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await many<T>(text, params))[0];
}

/** Like `one`, but throws NotFoundError (→ HTTP 404) when there is no row. */
export async function must<T>(what: string, text: string, params: unknown[] = []): Promise<T> {
  const row = await one<T>(text, params);
  if (!row) throw new NotFoundError(what);
  return row;
}

/**
 * Builds `SET a = $n, b = $n+1` from a patch object, skipping undefined keys.
 * Keys are camelCase field names; only names in `allowed` are accepted, so
 * user input can never inject a column name.
 */
export function buildUpdate(
  patch: Record<string, unknown>,
  allowed: readonly string[],
  startIndex = 1,
): { set: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    const col = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    values.push(patch[key]);
    parts.push(`${col} = $${startIndex + values.length - 1}`);
  }
  return { set: parts.join(", "), values };
}
