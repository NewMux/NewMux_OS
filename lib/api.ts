import { NextResponse, type NextRequest } from "next/server";
import type { Session } from "next-auth";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { auth } from "@/lib/auth";
import { NotFoundError, ValidationError } from "@/lib/data/sql";
import { ForbiddenError } from "@/lib/rbac";

type Ctx<P> = { req: NextRequest; session: Session; params: P };

/**
 * Wraps a route handler with the app's standard pipeline: session check →
 * role check → handler, mapping thrown errors onto HTTP responses
 * (zod → 400, ValidationError → 409, NotFoundError → 404, ForbiddenError → 403).
 * A returned plain object is sent as JSON.
 */
export function route<P = Record<string, never>>(
  opts: { allow?: (session: Session) => boolean; status?: number },
  fn: (ctx: Ctx<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    if (opts.allow && !opts.allow(session)) return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
    try {
      const params = (context?.params ? await context.params : {}) as P;
      const result = await fn({ req, session, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { status: opts.status ?? 200 });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");
    return NextResponse.json(
      { error: issue ? `${field ? `${field}: ` : ""}${issue.message}` : "Invalid input", details: error.flatten() },
      { status: 400 },
    );
  }
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  // eslint-disable-next-line no-console
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Parses a JSON body against a zod schema (throws ZodError → 400). */
export async function body<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  return schema.parse(json);
}
