import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { deleteActivity, setActivityCompleted } from "@/lib/data/crm";
import { activityCompletedSchema } from "@/lib/validators/crm";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCrm }, async ({ req, params }) => {
  const { completed } = await body(req, activityCompletedSchema);
  return { activity: await setActivityCompleted(params.id, completed) };
});

export const DELETE = route<P>({ allow: canAccessCrm }, async ({ params }) => {
  await deleteActivity(params.id);
  return { ok: true };
});
