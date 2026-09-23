import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { clientSchema } from "@/lib/validators/client";
import { createClient, listClients } from "@/lib/data/clients";

export const GET = route({ allow: canAccessCrm }, async () => ({ clients: await listClients() }));

export const POST = route({ allow: canAccessCrm, status: 201 }, async ({ req }) => ({
  client: await createClient(await body(req, clientSchema)),
}));
