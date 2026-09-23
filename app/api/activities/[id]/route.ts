import { z } from "zod";
import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { deleteActivity, setActivityCompleted } from "@/lib/data/crm";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCrm }, async ({ req, params }) => {
  const { completed } = await body(req, z.object({ completed: z.boolean() }));
  return { activity: await setActivityCompleted(params.id, completed) };
});

export const DELETE = route<P>({ allow: canAccessCrm }, async ({ params }) => {
  await deleteActivity(params.id);
  return { ok: true };
});
