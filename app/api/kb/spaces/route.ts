import { route, body } from "@/lib/api";
import { canAccessKb } from "@/lib/rbac";
import { spaceSchema } from "@/lib/validators/kb";
import { createSpace, listSpaces } from "@/lib/data/kb";

export const GET = route({ allow: canAccessKb }, async () => ({ spaces: await listSpaces() }));

export const POST = route({ allow: canAccessKb, status: 201 }, async ({ req }) => ({
  space: await createSpace(await body(req, spaceSchema)),
}));
