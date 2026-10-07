import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { fileMetaSchema } from "@/lib/validators/files";
import { deleteFile, updateFile } from "@/lib/data/files";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCompany }, async ({ req, params, session }) => ({
  file: await updateFile(params.id, await body(req, fileMetaSchema), session.user.id),
}));

export const DELETE = route<P>({ allow: canAccessCompany }, async ({ params, session }) => {
  await deleteFile(params.id, session.user.id);
  return { ok: true };
});
