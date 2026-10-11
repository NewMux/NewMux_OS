import { route, body } from "@/lib/api";
import { canAccessCompany, canSeeMoney } from "@/lib/rbac";
import { fileMetaSchema } from "@/lib/validators/files";
import { deleteFile, fileCategoriesFor, getFile, updateFile } from "@/lib/data/files";
import { NotFoundError, ValidationError } from "@/lib/data/sql";
import type { Session } from "next-auth";

type P = { id: string };

/** A file in a partners-only category (contracts, finance, receipts) doesn't exist for anyone else. */
async function visibleFile(id: string, session: Session) {
  const file = await getFile(id);
  if (!file || !fileCategoriesFor(canSeeMoney(session)).includes(file.category)) throw new NotFoundError("File");
  return file;
}

export const PATCH = route<P>({ allow: canAccessCompany }, async ({ req, params, session }) => {
  await visibleFile(params.id, session);
  const meta = await body(req, fileMetaSchema);
  if (!fileCategoriesFor(canSeeMoney(session)).includes(meta.category)) throw new ValidationError("That category is for partners only.");
  return { file: await updateFile(params.id, meta, session.user.id) };
});

export const DELETE = route<P>({ allow: canAccessCompany }, async ({ params, session }) => {
  await visibleFile(params.id, session);
  await deleteFile(params.id, session.user.id);
  return { ok: true };
});
