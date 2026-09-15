import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side use only (Route Handlers,
 * Server Components). Never import this from a client component — the
 * service role key bypasses RLS entirely. All authorization in this app is
 * enforced at the Next.js route/query layer (see lib/rbac.ts), not via RLS.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server env vars are not set");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
