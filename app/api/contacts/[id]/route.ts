import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { contactSchema } from "@/lib/validators/crm";
import { deleteContact, updateContact } from "@/lib/data/crm";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCrm }, async ({ req, params }) => ({
  contact: await updateContact(params.id, await body(req, contactSchema.partial())),
}));

export const DELETE = route<P>({ allow: canAccessCrm }, async ({ params }) => {
  await deleteContact(params.id);
  return { ok: true };
});
