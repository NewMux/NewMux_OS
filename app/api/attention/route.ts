import { z } from "zod";
import { route, body } from "@/lib/api";
import { isPartnerAdmin } from "@/lib/rbac";
import { markRenewed, snoozeAttention } from "@/lib/data/attention";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("snooze"), key: z.string().max(120), days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal("renewed"), key: z.string().max(120) }),
]);

/** Snooze a Needs Attention item, or mark a renewal done (item 26). Partners only. */
export const POST = route({ allow: isPartnerAdmin }, async ({ req, session }) => {
  const input = await body(req, schema);
  if (input.action === "snooze") await snoozeAttention(input.key, input.days, session.user.id);
  else await markRenewed(input.key);
  return { ok: true };
});
