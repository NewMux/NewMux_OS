import { route } from "@/lib/api";
import { canAccessKb } from "@/lib/rbac";
import { updatePageSchema } from "@/lib/validators/kb";
import { updatePage } from "@/lib/data/kb";
import type { KbContent } from "@/lib/data/types";

/**
 * Last-chance autosave from navigator.sendBeacon when the tab is hidden or
 * closed (beacons are POST with a text body).
 */
export const POST = route<{ id: string }>({ allow: canAccessKb }, async ({ req, params, session }) => {
  const parsed = updatePageSchema.safeParse(JSON.parse((await req.text()) || "{}"));
  if (!parsed.success) return { ok: false };
  const { content, ...patch } = parsed.data;
  await updatePage(params.id, { ...patch, content: content as KbContent | undefined }, session.user.id);
  return { ok: true };
});
