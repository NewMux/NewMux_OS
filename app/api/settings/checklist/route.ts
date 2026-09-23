import { z } from "zod";
import { route, body } from "@/lib/api";
import { canAccessSettings } from "@/lib/rbac";
import { setSetting } from "@/lib/data/settings";

export const POST = route({ allow: canAccessSettings }, async ({ req }) => {
  const { checked } = await body(req, z.object({ checked: z.array(z.string().max(200)).max(200) }));
  await setSetting("notion_migration_checklist", checked);
  return { checked };
});
