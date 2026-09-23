import { route, body } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { createPartySchema } from "@/lib/validators/finance";
import { createParty, listParties } from "@/lib/data/finance";

export const GET = route({ allow: canAccessSettings }, async () => ({ parties: await listParties() }));

export const POST = route({ allow: canAccessSettings, status: 201 }, async ({ req }) => ({
  party: await createParty((await body(req, createPartySchema)).name),
}));
