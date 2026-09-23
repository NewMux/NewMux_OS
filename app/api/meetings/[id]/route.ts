import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { meetingSchema } from "@/lib/validators/meeting";
import { deleteMeeting, updateMeeting } from "@/lib/data/meetings";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessWork }, async ({ req, params }) => ({
  meeting: await updateMeeting(params.id, await body(req, meetingSchema)),
}));

export const DELETE = route<P>({ allow: canAccessWork }, async ({ params }) => {
  await deleteMeeting(params.id);
  return { ok: true };
});
