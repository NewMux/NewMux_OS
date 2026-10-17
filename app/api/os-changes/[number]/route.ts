import { route } from "@/lib/api";
import { ForbiddenError, canAccessWork, isPartnerAdmin } from "@/lib/rbac";
import { closeOsChange, getOsChange } from "@/lib/osChanges";
import { osChangeNumber } from "@/lib/validators/osChanges";

type P = { number: string };

export const GET = route<P>({ allow: canAccessWork }, async ({ params }) => ({ change: await getOsChange(osChangeNumber(params.number)) }));

/** Withdraws a request: whoever asked for it, or a partner. */
export const DELETE = route<P>({ allow: canAccessWork }, async ({ params, session }) => {
  const number = osChangeNumber(params.number);
  const change = await getOsChange(number);
  if (!isPartnerAdmin(session) && change.requesterId !== session.user.id) throw new ForbiddenError();
  await closeOsChange(number);
  return { ok: true };
});
