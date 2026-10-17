import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { listOsChanges, requestOsChange } from "@/lib/osChanges";
import { osChangeRequestSchema } from "@/lib/validators/osChanges";

/** OS updates (lib/osChanges.ts): anyone signed in can see them and ask for one. GitHub keeps the record. */
export const GET = route({ allow: canAccessWork }, async () => ({ changes: await listOsChanges() }));

export const POST = route({ allow: canAccessWork, status: 201 }, async ({ req, session }) => {
  const input = await body(req, osChangeRequestSchema);
  const change = await requestOsChange(input, { id: session.user.id, name: session.user.name ?? "Someone", role: session.user.role });
  return { change };
});
