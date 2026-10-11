import { z } from "zod";
import { route, body } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/data/settings";
import { isPartnerAdmin } from "@/lib/rbac";
import { HAMAN_EFFORTS, HAMAN_MODELS, normalizeSettings, type HamanSettings } from "@/lib/haman/models";

const schema = z.object({
  model: z.enum(HAMAN_MODELS.map((m) => m.id) as [string, ...string[]]).optional(),
  effort: z.enum(HAMAN_EFFORTS.map((e) => e.id) as [string, ...string[]]).optional(),
});

/** Which model Haman runs on and how hard he thinks. Everyone can see it; partners can change it. */
export const GET = route({}, async ({ session }) => ({
  settings: normalizeSettings(await getSetting<Partial<HamanSettings> | null>("haman", null), process.env.HAMAN_MODEL),
  canChange: isPartnerAdmin(session),
}));

export const PATCH = route({ allow: isPartnerAdmin }, async ({ req }) => {
  const patch = await body(req, schema);
  const current = normalizeSettings(await getSetting<Partial<HamanSettings> | null>("haman", null), process.env.HAMAN_MODEL);
  const next = normalizeSettings({ ...current, ...patch } as Partial<HamanSettings>);
  await setSetting("haman", next);
  return { settings: next };
});
