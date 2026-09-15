"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ApiErrorBody, ApiErrorCode } from "./errors";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string[]>,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

/**
 * The only way client code should call the API. Throws an ApiError on any
 * non-2xx response, so a failed request can never be mistaken for a successful
 * one — which is what used to happen when callers ignored the response and just
 * closed the modal.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      "internal",
      "Could not reach the server. Check your connection.",
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (isApiErrorBody(body)) {
      throw new ApiError(
        body.error.code,
        body.error.message,
        body.error.fields,
        res.status,
      );
    }
    throw new ApiError(
      "internal",
      `Request failed (${res.status}).`,
      undefined,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Non-throwing mutation helper: toasts on failure and reports whether it
 * worked. Lets a call site that previously ignored the response keep its shape
 * while no longer treating a 4xx as success.
 */
export async function apiMutate(
  url: string,
  init?: RequestInit,
  options: { successMessage?: string } = {},
): Promise<boolean> {
  try {
    await apiFetch(url, init);
    if (options.successMessage) toast.success(options.successMessage);
    return true;
  } catch (err) {
    toast.error(
      err instanceof ApiError ? err.message : "Something went wrong.",
    );
    return false;
  }
}

/**
 * Wraps a mutation with the feedback the app was missing: a pending flag, a
 * toast on failure, per-field errors for forms, and a refresh on success.
 */
export function useApiMutation<TArgs extends unknown[], TResult>(
  mutate: (...args: TArgs) => Promise<TResult>,
  options: {
    onSuccess?: (result: TResult) => void;
    successMessage?: string;
    refresh?: boolean;
  } = {},
) {
  const { onSuccess, successMessage, refresh = true } = options;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setPending(true);
      setFieldErrors({});
      try {
        const result = await mutate(...args);
        if (successMessage) toast.success(successMessage);
        onSuccess?.(result);
        if (refresh) router.refresh();
        return result;
      } catch (err) {
        if (err instanceof ApiError) {
          setFieldErrors(err.fields ?? {});
          toast.error(err.message);
        } else {
          toast.error("Something went wrong.");
        }
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [mutate, onSuccess, successMessage, refresh, router],
  );

  return { run, pending, fieldErrors };
}
