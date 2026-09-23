import { query } from "@/lib/db";
import { one } from "./sql";

/** Small app-wide key/value settings (JSON values). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await one<{ value: T }>("select value from app_settings where key = $1", [key]);
  return row?.value ?? fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await query(
    "insert into app_settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()",
    [key, JSON.stringify(value)],
  );
}
