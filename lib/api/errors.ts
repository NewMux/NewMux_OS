import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * One shape for every API failure.
 *
 * Previously the `error` key held a bare string on auth failures but a zod
 * `flatten()` object on validation failures, so any client rendering it printed
 * "[object Object]" on the validation path. `error` is now always an object:
 * `code` for branching, `message` for humans, `fields` for per-input errors.
 */
export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "internal";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string[]>;
  };
};

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  internal: 500,
};

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  unauthorized: "You need to sign in to do that.",
  forbidden: "You do not have access to this.",
  not_found: "That record no longer exists.",
  validation: "Some fields need attention.",
  conflict: "That change conflicts with existing records.",
  internal: "Something went wrong on our side.",
};

/** Thrown from the data layer; `withRoute` turns it into the right response. */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message?: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = "AppError";
  }
}

export function apiError(
  code: ApiErrorCode,
  message?: string,
  fields?: Record<string, string[]>,
) {
  const body: ApiErrorBody = {
    error: {
      code,
      message: message ?? DEFAULT_MESSAGE[code],
      ...(fields ? { fields } : {}),
    },
  };
  return NextResponse.json(body, { status: STATUS[code] });
}

export const unauthorized = (message?: string) =>
  apiError("unauthorized", message);
export const forbidden = (message?: string) => apiError("forbidden", message);
export const notFound = (message?: string) => apiError("not_found", message);
export const conflict = (message?: string, fields?: Record<string, string[]>) =>
  apiError("conflict", message, fields);

export function validationError(error: ZodError) {
  const { fieldErrors, formErrors } = error.flatten();
  const fields: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages?.length) fields[key] = messages;
  }
  const message =
    formErrors[0] ??
    Object.values(fields)[0]?.[0] ??
    DEFAULT_MESSAGE.validation;
  return apiError(
    "validation",
    message,
    Object.keys(fields).length ? fields : undefined,
  );
}

/**
 * Wraps a route handler so a thrown AppError becomes its matching status and
 * anything unexpected becomes a logged 500 instead of an unhandled crash.
 */
export function withRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AppError)
        return apiError(err.code, err.message, err.fields);
      console.error("[api] unhandled error", err);
      return apiError("internal");
    }
  };
}
