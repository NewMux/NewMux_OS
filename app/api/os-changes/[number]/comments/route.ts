import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { reviseOsChange } from "@/lib/osChanges";
import { osChangeCommentSchema, osChangeNumber } from "@/lib/validators/osChanges";

/** Asks Claude Code for more changes to a request. Anyone signed in. */
export const POST = route<{ number: string }>({ allow: canAccessWork }, async ({ req, params, session }) => {
  const { text } = await body(req, osChangeCommentSchema);
  return { change: await reviseOsChange(osChangeNumber(params.number), text, { id: session.user.id, name: session.user.name ?? "Someone", role: session.user.role }) };
});
