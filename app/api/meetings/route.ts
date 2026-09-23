import { route, body } from "@/lib/api";
import { canAccessWork } from "@/lib/rbac";
import { meetingSchema } from "@/lib/validators/meeting";
import { createMeeting, listMeetings } from "@/lib/data/meetings";

export const GET = route({ allow: canAccessWork }, async () => ({ meetings: await listMeetings() }));

export const POST = route({ allow: canAccessWork, status: 201 }, async ({ req, session }) => ({
  meeting: await createMeeting({ ...(await body(req, meetingSchema)), createdBy: session.user.id }),
}));
