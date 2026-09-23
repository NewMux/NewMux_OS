import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { contactSchema } from "@/lib/validators/crm";
import { createContact, listContacts } from "@/lib/data/crm";

export const GET = route({ allow: canAccessCrm }, async ({ req }) => ({
  contacts: await listContacts({ clientId: req.nextUrl.searchParams.get("clientId") ?? undefined }),
}));

export const POST = route({ allow: canAccessCrm, status: 201 }, async ({ req }) => ({
  contact: await createContact(await body(req, contactSchema)),
}));
