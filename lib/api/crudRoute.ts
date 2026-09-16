import { NextResponse, type NextRequest } from "next/server";
import type { Session } from "next-auth";
import type { ZodSchema } from "zod";
import { auth } from "@/lib/auth";
import {
  conflict,
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "./errors";
import { archiveSchema } from "@/lib/validators/client";
import {
  describeReferences,
  getReferences,
  type EntityKind,
} from "@/lib/data/integrity";

/** Empty strings from cleared date/url/text inputs mean "cleared", not "unchanged". */
function nullifyEmptyStrings<T extends object>(patch: T): T {
  return Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      value === "" ? null : value,
    ]),
  ) as T;
}

/**
 * The PATCH/DELETE pair every entity needs, in one place.
 *
 * Deletes always consult lib/data/integrity.ts first and refuse with a 409 that
 * names what is blocking, so no route can forget the check and orphan records.
 */
export function crudRoute<TPatch extends object>(config: {
  kind: EntityKind;
  /** Noun used in the conflict message, e.g. "client". */
  label: string;
  schema: ZodSchema<TPatch>;
  can: (session: Session | null) => boolean;
  load: (id: string) => Promise<{ name?: string } | undefined | null>;
  update: (id: string, patch: TPatch, session: Session) => Promise<unknown>;
  remove: (id: string, session: Session) => Promise<unknown>;
  /** Entities that carry history are archived instead of deleted. */
  setArchived?: (
    id: string,
    archived: boolean,
    session: Session,
  ) => Promise<unknown>;
}) {
  const PATCH = withRoute(
    async (
      req: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) => {
      const session = await auth();
      if (!session) return unauthorized();
      if (!config.can(session)) return forbidden();

      const { id } = await params;
      const body = await req.json();

      // Archive/restore is a PATCH too, distinguished by carrying only `archived`.
      if (config.setArchived) {
        const archive = archiveSchema.safeParse(body);
        if (archive.success) {
          const record = await config.setArchived(
            id,
            archive.data.archived,
            session,
          );
          return NextResponse.json({ record });
        }
      }

      const parsed = config.schema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const record = await config.update(
        id,
        nullifyEmptyStrings(parsed.data),
        session,
      );
      return NextResponse.json({ record });
    },
  );

  const DELETE = withRoute(
    async (
      _req: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) => {
      const session = await auth();
      if (!session) return unauthorized();
      if (!config.can(session)) return forbidden();

      const { id } = await params;
      const existing = await config.load(id);
      // Already gone is the desired end state, so this is not an error.
      if (!existing) return NextResponse.json({ ok: true });

      const references = getReferences(config.kind, id);
      if (references.length > 0) {
        const suffix = config.setArchived
          ? " Archive it instead to keep the history."
          : "";
        return conflict(
          `${existing.name ?? `This ${config.label}`} still has linked records.${suffix}`,
          {
            references: describeReferences(references),
          },
        );
      }

      await config.remove(id, session);
      return NextResponse.json({ ok: true });
    },
  );

  return { PATCH, DELETE };
}
