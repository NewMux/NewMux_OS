import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { ventureSchema } from "@/lib/validators/finance";
import { deleteVenture, updateVenture } from "@/lib/data/finance";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCompany }, async ({ req, params }) => ({
  venture: await updateVenture(params.id, await body(req, ventureSchema)),
}));

export const DELETE = route<P>({ allow: canAccessCompany }, async ({ params }) => {
  await deleteVenture(params.id);
  return { ok: true };
});
