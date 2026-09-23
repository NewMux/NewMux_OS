import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { activitySchema } from "@/lib/validators/crm";
import { createActivity } from "@/lib/data/crm";

export const POST = route({ allow: canAccessCrm, status: 201 }, async ({ req, session }) => ({
  activity: await createActivity(await body(req, activitySchema), session.user.id),
}));
