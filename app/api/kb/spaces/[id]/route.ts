import { route, body } from "@/lib/api";
import { canAccessKb, isPartnerAdmin } from "@/lib/rbac";
import { spaceSchema } from "@/lib/validators/kb";
import { deleteSpace, updateSpace } from "@/lib/data/kb";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessKb }, async ({ req, params }) => ({
  space: await updateSpace(params.id, await body(req, spaceSchema)),
}));

/** Deletes every page in the space — partners only. */
export const DELETE = route<P>({ allow: isPartnerAdmin }, async ({ params }) => {
  await deleteSpace(params.id);
  return { ok: true };
});
