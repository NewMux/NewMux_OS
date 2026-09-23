"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

type Options = {
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Toast shown on success. */
  success?: string;
  /** Re-render server components after success (default true). */
  refresh?: boolean;
};

/**
 * fetch() for app mutations: sends JSON, surfaces the server's error message
 * as a toast (instead of failing silently), and refreshes server data.
 * Returns the parsed JSON, or null when the request failed.
 */
export function useMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T = Record<string, unknown>>(url: string, opts: Options = {}): Promise<T | null> => {
      setPending(true);
      try {
        const res = await fetch(url, {
          method: opts.method ?? "POST",
          headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
        const json = (await res.json().catch(() => ({}))) as T & { error?: string };
        if (!res.ok) {
          toast.error(typeof json.error === "string" ? json.error : "Something went wrong. Please try again.");
          return null;
        }
        if (opts.success) toast.success(opts.success);
        if (opts.refresh !== false) router.refresh();
        return json;
      } catch {
        toast.error("You appear to be offline. Check your connection and try again.");
        return null;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending };
}
