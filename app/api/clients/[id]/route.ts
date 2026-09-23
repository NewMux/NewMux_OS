import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { updateClientSchema } from "@/lib/validators/client";
import { deleteClient, updateClient } from "@/lib/data/clients";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCrm }, async ({ req, params }) => ({
  client: await updateClient(params.id, await body(req, updateClientSchema)),
}));

export const DELETE = route<P>({ allow: canAccessCrm }, async ({ params }) => {
  await deleteClient(params.id);
  return { ok: true };
});
