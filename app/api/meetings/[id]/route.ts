import { crudRoute } from "@/lib/api/crudRoute";
import { updateMeetingSchema } from "@/lib/validators/meeting";
import {
  updateMeeting,
  deleteMeeting,
  getMeetingById,
} from "@/lib/data/meetings";

export const { PATCH, DELETE } = crudRoute({
  kind: "meeting",
  label: "meeting",
  schema: updateMeetingSchema,
  // Meetings are shared team context, not finance: any signed-in user manages them.
  can: () => true,
  load: (id) => getMeetingById(id).then((m) => m && { name: m.title }),
  update: (id, patch) => updateMeeting(id, patch),
  remove: (id) => deleteMeeting(id),
});
